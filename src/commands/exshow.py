#!/usr/bin/python3
import sys
import os.path
import base64

import extratermclient

def ShowImage(filename, format):
    extratermclient.startHtml()
    print("<img src=\"data:image/",end='')
    print(format,end='')
    print(";base64,",end='')
    with open(filename,'rb') as fhandle:
        contents = fhandle.read()
    print(base64.b64encode(contents).decode(),end='')
    print("\" />")
    extratermclient.endHtml()

def Show(filename):

    if os.path.exists(filename):
        lowerfilename = filename.lower()
        if lowerfilename.endswith(".png"):
            ShowImage(filename, "png")
        elif lowerfilename.endswith(".gif"):
            ShowImage(filename, "gif")
        elif lowerfilename.endswith(".jpg"):
            ShowImage(filename, "jpg")
        else:
            print("Unsupported file format.")
    else:
        print("Unable to open file {0}.".format(filename))

def main():
    if not extratermclient.isExtraterm():
        print("Sorry, you're not using Extraterm.")
        return

    for filename in sys.argv[1:]:
        Show(filename)

main()
