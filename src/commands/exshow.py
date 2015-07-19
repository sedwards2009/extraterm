#!/usr/bin/python3
import sys
import os.path
import base64

import extratermclient

def SendMimeTypeData(filename, mimeType):
    extratermclient.startMimeType(mimeType)
    with open(filename,'rb') as fhandle:
        contents = fhandle.read(3*10240)    # This must be a multiple of 3 to keep concatinated base64 working.
        print(base64.b64encode(contents).decode(),end='')
    extratermclient.endMimeType()

mimeTypeMap = {
    "png": "image/png",
    "git": "image/git",
    "jpg": "image/jpg",
    "md": "text/markdown"
}

def Show(filename):
    if os.path.exists(filename):
        lowerfilename = os.path.basename(filename).lower()
        if '.' in lowerfilename:
            extension = lowerfilename.split('.')[-1]
            if extension in mimeTypeMap:
                SendMimeTypeData(filename, mimeTypeMap[extension])
            else:
                print("Unrecognised file extension.")
        else:
            print("Unrecognised file extension.")
    else:
        print("Unable to open file {0}.".format(filename))

def main():
    if not extratermclient.isExtraterm():
        print("Sorry, you're not using Extraterm.")
        return

    for filename in sys.argv[1:]:
        Show(filename)

main()
