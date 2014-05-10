#

import os

def cookie():
    if "EXTRATERM_COOKIE" in os.environ:
        return os.environ["EXTRATERM_COOKIE"]
    else:
        return None

def isExtraterm():
    return cookie() is not None

def startHtml():
    print("\x1b&" + cookie() + "\x07", end="")

def endHtml():
    print("\x00", end="")

def startCommand():
    pass

def markEndCommand(rc=None):
    print("\x1b&" + cookie() + ";3\x07", end="")
    if rc is not None:
        print(rc, end="")
    print("\x00", end="")
