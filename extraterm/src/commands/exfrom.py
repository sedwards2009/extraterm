#!/usr/bin/env python3
#
# Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

import argparse
import atexit
import base64
import hashlib
import json
import os
import sys
import tempfile
import termios
import time
import tty
import uuid
from signal import signal, SIGPIPE, SIG_DFL, SIGTSTP, SIG_IGN, SIGTTOU


##@inline
from extratermclient import extratermclient

HASH_LENGTH = 20
COMMAND_PREFIX_LENGTH = 3


class Metadata:
    def __init__(self, metadata):
        self.metadata = metadata


class BodyData:
    def __init__(self, data):
        self.data = data


class FrameReadError:
    def __init__(self, message):
        self.message = message


class FrameWriter:
    def __init__(self, writeFunction, outputFlushFunction, errorWriteFunction, errorFlushFunction):
        self.write = writeFunction
        self.flush = outputFlushFunction
        self.errorWrite = errorWriteFunction
        self.errorFlush = errorFlushFunction


def readStdinLine():
    line = sys.stdin.readline()
    return line.strip()


def requestFrame(frame_name):
    """Returns a generator which outputs the frame contents as blocks of binary data.
    """
    # We use plain old cooked mode for the transfer. Cygwin is a bit buggy
    # and corrupts input when in cbreak or raw mode. Cooked mode also means
    # that input lines have limited length defined by the size of the input
    # buffer in the terminal driver. Linux supports up to about 4K, OS X is
    # about 1K. Cygwin is ???.

    # Turn off echo on the tty.
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    new_settings = termios.tcgetattr(fd)
    new_settings[3] = new_settings[3] & ~termios.ECHO          # lflags
    termios.tcsetattr(fd, termios.TCSADRAIN, new_settings)

    # Set up a hook to restore the tty settings at exit.
    def restoreTty():
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        sys.stderr.flush()
    atexit.register(restoreTty)
    
    # Request the frame contents from the terminal.
    extratermclient.requestFrame(frame_name)

    line = readStdinLine()

    if not line.startswith("#M:"):
        yield FrameReadError("Error while reading in frame data. Expected '#M:...', but didn't receive it.")
        return

    if len(line) < COMMAND_PREFIX_LENGTH + 1 + HASH_LENGTH:
        yield FrameReadError("Error while reading in metadata. Line is too short.")
        return
        
    b64data = line[COMMAND_PREFIX_LENGTH:-HASH_LENGTH-1]
    lineHash = line[-HASH_LENGTH:]

    contents = base64.b64decode(b64data)

    hash = hashlib.sha256()
    hash.update(contents)
    previousHash = hash.digest()
    hashHex = hash.hexdigest()

    # Check the hash.
    if lineHash.lower() != hash.hexdigest()[:HASH_LENGTH].lower():
        yield FrameReadError("Error: Hash didn't match for metadata line. '"+lineHash+"'")
        return

    # Decode the metadata.
    yield Metadata(json.loads(str(contents, encoding="utf-8")))

    # Read stdin until an empty buffer is returned.
    try:
        while True:
            line = readStdinLine()

            if len(line) < COMMAND_PREFIX_LENGTH + 1 + HASH_LENGTH:
                return FrameReadError("Error while reading frame body data. Line is too short.")

            if line.startswith("#D:") or line.startswith("#E:") or line.startswith("#A:"):
                # Data
                b64data = line[COMMAND_PREFIX_LENGTH:-HASH_LENGTH-1]
                contents = base64.b64decode(b64data)
                lineHash = line[-HASH_LENGTH:].lower()

                hash = hashlib.sha256()
                hash.update(previousHash)
                hash.update(contents)
                previousHash = hash.digest()

                # Check the hash.
                computedHashHex = hash.hexdigest()[:HASH_LENGTH].lower()
                if lineHash != computedHashHex:
                    yield FrameReadError("Error: Upload failed. (Hash didn't match for data line. Expected " + computedHashHex + " got " + lineHash + ")")
                    return

                if line.startswith("#E:"):
                    # EOF
                    break
                elif line.startswith("#A:"):
                    yield FrameReadError("Upload aborted")
                    return
                else:
                    # Send the input to stdout.
                    yield BodyData(contents)


            else:
                yield FrameReadError("Error while reading frame body data. Line didn't start with '#D:' or '#E:'.")
                return

    except OSError as ex:
        print(ex.strerror, file=sys.stderr)
        
        #Ignore further SIG_PIPE signals and don't throw exceptions
        signal(SIGPIPE,SIG_DFL)


def outputFrame(frame_name):
    writer = FrameWriter(sys.stdout.buffer.write, sys.stdout.flush, sys.stderr.buffer.write, sys.stderr.flush)
    rc, metadata = writeFrame(frame_name, writer)
    return rc


def writeFrameToDisk(frame_name):
    tmpFileName = str(uuid.uuid4()) + ".tmp"
    with open(tmpFileName, "wb") as fhandle:
        writer = FrameWriter(fhandle.write, fhandle.flush, sys.stderr.buffer.write, sys.stderr.flush)
        rc, metadata = writeFrame(frame_name, writer)

    # Compute the final filename
    filename = None
    if "filename" in metadata:
        filename = os.path.basename(metadata["filename"])

    else:
        if "mimeType" in metadata:
            filename = metadata["mimeType"].replace("/", "-")
        else:
            return rc, tmpFileName
    
    counter = 0
    basename = filename

    while os.path.exists(filename):
        parts = os.path.splitext(basename)
        filename = parts[0] + " (" + str(counter) + ")" + parts[1]
        counter += 1
    os.rename(tmpFileName, filename)

    return rc, filename    

def writeFrame(frame_name, frameWriter):
    rc = 0
    metadata = None
    for block in requestFrame(frame_name):
        if isinstance(block, Metadata):
            metadata = block.metadata
        elif isinstance(block, BodyData):
            frameWriter.write(block.data)
        else:
            # FrameReadError
            frameWriter.errorWrite.write(bytes(block.message, 'utf8'))
            frameWriter.errorWrite.write(bytes("\n", "utf8"))
            frameWriter.errorFlush.flush()
            rc = 1
    frameWriter.flush()
    return rc, metadata


def xargs(frame_names, command_list):
    temp_files = []
    rc = 0
    try:
        # Fetch the contents of each frame and put them in tmp files.
        for frame_name in frame_names:
            rc, next_temp_file = readFrameToTempFile(frame_name)
            temp_files.append(next_temp_file)
            if rc != 0:
                break
        else:
            # Build the complete command and args.
            args = command_list[:]
            for temp_file in temp_files:
                args.append(temp_file.name)
            
            os.spawnvp(os.P_WAIT, args[0], [os.path.basename(args[0])] + args[1:])

    finally:
        # Clean up any temp files.
        for temp_file in temp_files:
            os.unlink(temp_file.name)
    return rc


def readFrameToTempFile(frame_name):
    fhandle = tempfile.NamedTemporaryFile('w+b', delete=False)
    def noop(): pass
    writer = FrameWriter(fhandle.write, noop, sys.stderr.buffer.write, sys.stderr.flush)
    rc, metadata = writeFrame(writer)
    fhandle.close()
    return rc, fhandle


def main():
    parser = argparse.ArgumentParser(prog='from', description='Fetch data from an Extraterm frame.')
    parser.add_argument('frames', metavar='frame_ID', type=str, nargs='+', help='a frame ID')
    parser.add_argument('-s', '--save', dest='save', action='store_true', default=None, help='write frames to disk')
    parser.add_argument('--xargs', metavar='xargs', type=str, nargs=argparse.REMAINDER, help='execute a command with frame contents as temp file names')
    args = parser.parse_args()

    if not extratermclient.isExtraterm():
        print("[Error] 'from' command can only be run inside Extraterm.", file=sys.stderr)
        sys.exit(1)

    # make sure that stdin is a tty.
    if not os.isatty(sys.stdin.fileno()):
        print("[Error] 'from' command must be connected to tty on stdin.", file=sys.stderr)
        sys.exit(1)

    if args.xargs is None:
        # Normal execution. Output the frames.
        for frame_name in args.frames:
            if args.save:
                rc, filename = writeFrameToDisk(frame_name)
                print("Wrote " +filename)
            else:
                rc = outputFrame(frame_name)
            if rc != 0:
                sys.exit(rc)
        sys.exit(0)
    else:
        sys.exit(xargs(args.frames, args.xargs))

main()
