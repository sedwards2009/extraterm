#!/usr/bin/python3

import sys
import os
import tty
import termios
import atexit
import base64
from signal import signal, SIGPIPE, SIG_DFL 

import extratermclient

BUFFER_SIZE = 2048

def processRequest(frame_name):
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

    # Read stdin until an empty buffer is returned.
    try:
        b64data = sys.stdin.readline()
        while len(b64data) != 0:
#            print(repr(b64data), file=sys.stderr)
            # Send the input to stdout.
            
            data = base64.b64decode(b64data).decode('utf-8') # FIXME handle utf8 decode errors.
            sys.stdout.write(data)
            sys.stdout.flush()
            b64data = sys.stdin.readline()
    except OSError as ex:
        print(ex.strerror, file=sys.stderr)
        
        #Ignore further SIG_PIPE signals and don't throw exceptions
        signal(SIGPIPE,SIG_DFL)
        
def main():
    if len(sys.argv) != 2:
        print("[Error] 'from' command requires one argument: frame ID.", file=sys.stderr)
        sys.exit(1)
    if not extratermclient.isExtraterm():
        print("[Error] 'from' command can only be run inside Extraterm.", file=sys.stderr)
        sys.exit(1)

    # make sure that stdin is a tty.
    if not os.isatty(sys.stdin.fileno()):
        print("[Error] 'from' command must be connected to tty on stdin.", file=sys.stderr)
        sys.exit(1)
    processRequest(sys.argv[1])

main()
