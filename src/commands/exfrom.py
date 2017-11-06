#!/usr/bin/env python3
#
# Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

import argparse
import atexit
import base64
import json
import os
import sys
import tempfile
import termios
import tty
from signal import signal, SIGPIPE, SIG_DFL 

##@inline
from extratermclient import extratermclient

class Metadata:
    def __init__(self, metadata):
        self.metadata = metadata


class BodyData:
    def __init__(self, data):
        self.data = data


class FrameReadError:
    def __init__(self, message):
        self.message = message


def requestFrame(frame_name):
    """Returns a generator which outputs the frame contents as blocks of binary data.
    """
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

    line = sys.stdin.readline()
    if line.strip() != "#metadata":
        return FrameReadError("Error while reading in frame data. Expected '#metadata', but didn't receive it.")

    metadata_buffer = ""
    b64data = sys.stdin.readline().strip()
    while len(b64data) != 0:
        if b64data[0] != '#':
            return FrameReadError("Error while reading in metadata. Line didn't start with '#'.")
        elif len(b64data) == 1:
            # Decode the metadata.
            yield Metadata(json.loads(str(base64.b64decode(metadata_buffer), encoding="utf-8")))
            break
        else:
            metadata_buffer += b64data[1:]
            b64data = sys.stdin.readline().strip()
    
    line = sys.stdin.readline().strip()
    if line != "#body":
        return FrameReadError("Error while reading in frame data. Expected '#body', but didn't receive it.")

    # Read stdin until an empty buffer is returned.
    try:
        b64data = sys.stdin.readline().strip()
        while len(b64data) != 0:
            if b64data[0] != '#':
                return FrameReadError("Error while reading in metadata. Line didn't start with '#'.")
            elif len(b64data) == 1:
                break   # Reached the end
            else:
                # Send the input to stdout.
                yield BodyData(base64.b64decode(b64data[1:])) # Strip the leading # and decode.
                b64data = sys.stdin.readline().strip()
    except OSError as ex:
        print(ex.strerror, file=sys.stderr)
        
        #Ignore further SIG_PIPE signals and don't throw exceptions
        signal(SIGPIPE,SIG_DFL)

def outputFrame(frame_name):
    for block in requestFrame(frame_name):
        if isinstance(block, Metadata):
            pass
        elif isinstance(block, BodyData):
            sys.stdout.buffer.write(block.data)
        else:
            # FrameReadError
            sys.stdout.buffer.write(bytes(block.message, 'utf8'))
            break
    sys.stdout.flush()

def xargs(frame_names, command_list):
    temp_files = []
    try:
        # Fetch the contents of each frame and put them in tmp files.
        for frame_name in frame_names:
            next_temp_file = readFrameToTempFile(frame_name)
            temp_files.append(next_temp_file)

        # Build the complete command and args.
        args = command_list[:]
        for temp_file in temp_files:
            args.append(temp_file.name)
        
        os.spawnvp(os.P_WAIT, args[0], [os.path.basename(args[0])] + args[1:])

    finally:
        # Clean up any temp files.
        for temp_file in temp_files:
            os.unlink(temp_file.name)

def readFrameToTempFile(frame_name):
    fhandle = tempfile.NamedTemporaryFile('w+b', delete=False)
    for block in requestFrame(frame_name):
        if isinstance(block, Metadata):
            pass
        elif isinstance(block, BodyData):
            fhandle.write(block.data)
        else:
            # FrameReadError
            sys.stdout.buffer.write(bytes(block.message, 'utf8'))
            break
    fhandle.close()

    return fhandle 

def main():
    parser = argparse.ArgumentParser(prog='from', description='Fetch data from an Extraterm frame.')
    parser.add_argument('frames', metavar='frame_ID', type=str, nargs='+', help='a frame ID')
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
            outputFrame(frame_name)
    else:
        xargs(args.frames, args.xargs)

    sys.exit(0)
main()
