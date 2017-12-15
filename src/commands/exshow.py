#!/usr/bin/env python3
#
# Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 
import sys
import os.path
import argparse
import base64
import hashlib

##@inline
from extratermclient import extratermclient

MAX_CHUNK_BYTES = 3 * 1024  # This is kept a multiple of 3 to avoid padding in the base64 representation.

def SendMimeTypeDataFromFile(filename, mimeType, charset, filenameMeta=None):
    with open(filename,'rb') as fhandle:
        SendMimeTypeData(fhandle, filename if filenameMeta is None else filenameMeta, mimeType, charset)

def SendMimeTypeDataFromStdin(mimeType, charset, filenameMeta=None):
    SendMimeTypeData(sys.stdin.buffer, filenameMeta, mimeType, charset)

def SendMimeTypeData(fhandle, filename, mimeType, charset):
    extratermclient.startFileTransfer(mimeType, charset, filename)
    contents = fhandle.read(MAX_CHUNK_BYTES)
    hash = hashlib.sha256()
    while len(contents) != 0:
        hash.update(contents)
        print(base64.b64encode(contents).decode(), end='')
        print(":", end='')
        print(hash.hexdigest())
        contents = fhandle.read(MAX_CHUNK_BYTES)
    extratermclient.endFileTransfer()

def ShowFile(filename, mimeType=None, charset=None, filenameMeta=None):
    if os.path.exists(filename):
        SendMimeTypeDataFromFile(filename, mimeType, charset, filenameMeta)
        return 0
    else:
        print("Unable to open file {0}.".format(filename))
        return 3

def ShowStdin(mimeType=None, charset=None, filenameMeta=None):
    SendMimeTypeDataFromStdin(mimeType, charset, filenameMeta)

def main():
    parser = argparse.ArgumentParser(prog='show', description='Show a file inside Extraterm.')
    parser.add_argument('--mimetype', dest='mimetype', action='store', default=None, help='the mime-type of the input file (default: auto-detect)')
    parser.add_argument('--charset', dest='charset', action='store', default=None, help='the character set of the input file (default: UTF8)')
    parser.add_argument('--filename', dest='filename', action='store', default=None, help='sets the file name in the metadata sent to the terminal (useful when reading from stdin).')
    
    parser.add_argument('files', metavar='file', type=str, nargs='*', help='file name. The file data is read from stdin if no files are specified.')
    args = parser.parse_args()
 
    if not extratermclient.isExtraterm():
        print("Sorry, you're not using Extraterm as your terminal.")
        return 1

    if len(args.files) != 0:
        for filename in args.files:
            result = ShowFile(filename, mimeType=args.mimetype, charset=args.charset, filenameMeta=args.filename)
            if result != 0:
                return result
        return 0
    else:
        return ShowStdin(mimeType=args.mimetype, charset=args.charset, filenameMeta=args.filename)

main()
