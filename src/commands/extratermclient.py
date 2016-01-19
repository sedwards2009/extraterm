#

import os
import sys
import json

INTRO = "\x1b&"

def cookie():
    if "EXTRATERM_COOKIE" in os.environ:
        return os.environ["EXTRATERM_COOKIE"]
    else:
        return None

def isExtraterm():
    return cookie() is not None

def startHtml():
    print(INTRO + cookie() + "\x07", end="")

def endHtml():
    print("\x00", end="")

def startCommand():
    pass

def markEndCommand(rc=None):
    print(INTRO + cookie() + ";3\x07", end="")
    if rc is not None:
        print(rc, end="")
    print("\x00", end="")

def startFileTransfer(mimeType, filename):
    payload = json.dumps({ "mimeType": mimeType, "filename": filename })
    print(INTRO + cookie() + ";5;" + str(len(payload)) + "\x07" + payload, end="")

def endFileTransfer():
    print("\x00", end="")
    
def requestFrame(frameName):
    print(INTRO + cookie() + ";4\x07" + frameName + "\x00", end="", file=sys.stderr)
    sys.stderr.flush()
