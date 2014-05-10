#!/usr/bin/python3
import os
import os.path
import sys

import extratermclient

def FormatPath(name, path):
    return "<span data-extraterm-type='directory' data-extraterm-value='{0}'>{1}</span>".format(path, name)

def EnhanceTail(path):
    (head, tail) = os.path.split(path)
    if tail == "" or tail is None:
        return FormatPath(head, head)
    else:
        return EnhanceTail(head) + FormatPath(tail + "/", path)

def main():
    cwd = os.getcwd()

    if extratermclient.isExtraterm():
        extratermclient.markEndCommand(sys.argv[1] if len(sys.argv) >=2 else None)

        extratermclient.startHtml()
        print(EnhanceTail(cwd))
        extratermclient.endHtml()

main()
