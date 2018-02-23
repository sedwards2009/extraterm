#!/usr/bin/env python3
#
# Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 
import argparse
import atexit
import base64
import hashlib
import os
import os.path
import sys
import termios

##@inline
from extratermclient import extratermclient

MAX_CHUNK_BYTES = 3 * 1024  # This is kept a multiple of 3 to avoid padding in the base64 representation.

def SendMimeTypeDataFromFile(filename, mimeType, charset, filenameMeta=None, download=False):
    filesize = os.path.getsize(filename)
    with open(filename,'rb') as fhandle:
        SendMimeTypeData(fhandle,
                         filename if filenameMeta is None else filenameMeta,
                         mimeType,
                         charset,
                         filesize=filesize,
                         download=download)

def SendMimeTypeDataFromStdin(mimeType, charset, filenameMeta=None, download=False):
    SendMimeTypeData(sys.stdin.buffer, filenameMeta, mimeType, charset, download)

def SendMimeTypeData(fhandle, filename, mimeType, charset, filesize=-1, download=False):
    TurnOffEcho()
    
    extratermclient.startFileTransfer(mimeType, charset, filename, filesize=filesize, download=download)
    contents = fhandle.read(MAX_CHUNK_BYTES)

    previousHash = b""
    previousHashHex = ""
    while len(contents) != 0:
        hash = hashlib.sha256()
        hash.update(previousHash)
        hash.update(contents)
        print("D:", end='')
        print(base64.b64encode(contents).decode(), end='')
        print(":", end='')
        previousHashHex = hash.hexdigest()
        print(previousHashHex)
        previousHash = hash.digest()
        contents = fhandle.read(MAX_CHUNK_BYTES)
    print("E::", end='')
    hash = hashlib.sha256()
    hash.update(previousHash)
    print(hash.hexdigest())

    extratermclient.endFileTransfer()

def ShowFile(filename, mimeType=None, charset=None, filenameMeta=None, download=False):
    if os.path.exists(filename):
        SendMimeTypeDataFromFile(filename, mimeType, charset, filenameMeta, download)
        return 0
    else:
        print("Unable to open file {0}.".format(filename))
        return 3

def ShowStdin(mimeType=None, charset=None, filenameMeta=None, download=False):
    SendMimeTypeDataFromStdin(mimeType, charset, filenameMeta, download)

def TurnOffEcho():
    # Turn off echo on the tty.
    fd = sys.stdin.fileno()
    if not os.isatty(fd):
        return
    old_settings = termios.tcgetattr(fd)
    new_settings = termios.tcgetattr(fd)
    new_settings[3] = new_settings[3] & ~termios.ECHO          # lflags
    termios.tcsetattr(fd, termios.TCSADRAIN, new_settings)

    # Set up a hook to restore the tty settings at exit.
    def restoreTty():
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        sys.stderr.flush()
    atexit.register(restoreTty)

def main():
    parser = argparse.ArgumentParser(prog='show', description='Show a file inside Extraterm.')
    parser.add_argument('--charset', dest='charset', action='store', default=None, help='the character set of the input file (default: UTF8)')
    parser.add_argument('-d', '--download', dest='download', action='store_true', default=None, help='download the file and don\'t show it')
    parser.add_argument('--mimetype', dest='mimetype', action='store', default=None, help='the mime-type of the input file (default: auto-detect)')
    parser.add_argument('--filename', dest='filename', action='store', default=None, help='sets the file name in the metadata sent to the terminal (useful when reading from stdin).')
    
    parser.add_argument('files', metavar='file', type=str, nargs='*', help='file name. The file data is read from stdin if no files are specified.')
    args = parser.parse_args()
 
    if not extratermclient.isExtraterm():
        print("Sorry, you're not using Extraterm as your terminal.")
        return 1

    if len(args.files) != 0:
        for filename in args.files:
            result = ShowFile(filename, mimeType=args.mimetype, charset=args.charset, filenameMeta=args.filename,
                              download=args.download)
            if result != 0:
                return result
        return 0
    else:
        return ShowStdin(mimeType=args.mimetype, charset=args.charset, filenameMeta=args.filename,
                         download=args.download)

main()
