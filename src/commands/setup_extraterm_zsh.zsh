# This file should be sourced from your .zshrc file.
#
# Copyright 2016 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

if [ -n "$EXTRATERM_COOKIE" ]; then
    echo "Setting up Extraterm support."

    # Put our enhanced commands at the start of the PATH.
    filedir=`dirname "${(%):-%x}"`
    export PATH="$PWD/$filedir:$PATH"

    # Insert our special code to communicate to Extraterm the status of the last command.
    export PS1=`echo -n -e "\033&${EXTRATERM_COOKIE};3\007%?\000${PS1}"`
    
    preexec () {
        echo -n -e "\033&${EXTRATERM_COOKIE};2;zsh\007"
        echo -n $1
        echo -n -e "\000"
    }

    # Look for Python 3 support.
    if ! which python3 > /dev/null; then
        echo "Unable to find the Python3 executable!"
    else
        alias from="exfrom.py"
        alias show="exshow.py"
    fi
fi
