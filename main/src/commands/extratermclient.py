#
# Copyright 2014-2022 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

import os
import sys
import json


class extratermclient:

    INTRO = "\x1b&"

    @staticmethod
    def cookie():
        if "LC_EXTRATERM_COOKIE" in os.environ:
            return os.environ["LC_EXTRATERM_COOKIE"]
        else:
            return None

    @staticmethod
    def isExtraterm():
        return extratermclient.cookie() is not None

    @staticmethod
    def startFileTransfer(mimeType, charset, filename, filesize=-1, download=False):
        payload = {}
        if mimeType is not None:
            payload["mimeType"] = mimeType
        if filename is not None:
            payload["filename"] = filename
        if charset is not None:
            payload["charset"] = charset
        if filesize != -1:
            payload["filesize"] = filesize
        if download:
            payload["download"] = "true"
        jsonPayload = json.dumps(payload)
        print(extratermclient.INTRO + extratermclient.cookie() + ";5;" + str(len(jsonPayload)) + "\x07" + jsonPayload,
            end="")

    @staticmethod
    def endFileTransfer():
        print("\x00", end="")
        
    @staticmethod
    def requestFrame(frameName):
        print(extratermclient.INTRO + extratermclient.cookie() + ";4\x07" + frameName + "\x00", end="", file=sys.stderr)
        sys.stderr.flush()
