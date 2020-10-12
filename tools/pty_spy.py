#!env python3
#
# pty_spy.py
# Simon Edwards <simon@simonzone.com>
#
# Tool like `ttyrec` except that it records the traffic from the terminal back to the application.
#

import argparse
import os
import pty

parser = argparse.ArgumentParser(description='Capture input to a terminal application and write it to a file.')
parser.add_argument('-a', dest='append', action='store_true', help='Append to the output file.')
parser.add_argument('-e', dest='command', help='Command to run. Defaults to a shell.')
parser.add_argument('filename', nargs='?', default='pty_spy_output.txt', help='File to write the captured data to.')
options = parser.parse_args()

mode = 'ab' if options.append else 'wb'
if options.command is not None:
    shell = ['/bin/sh','-c', options.command]
else:
    shell = os.environ.get('SHELL', 'sh')
filename = options.filename

with open(filename, mode) as stdin_script:
    def read(fd):
        data = os.read(fd, 1024)
        return data

    def stdin_read(fd):
        data = os.read(fd, 1024)
        stdin_script.write(data)
        return data

    print('Running ', shell, ' and capturing data to file ', filename)
    pty.spawn(shell, read, stdin_read)
    print('')
    print('Done. Data captured to file ', filename)
