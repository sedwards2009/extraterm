# This file should be sourced from your .zshrc file.
#
# Copyright 2016 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

if [ -n "$LC_EXTRATERM_COOKIE" ]; then
    autoload -Uz add-zsh-hook

    echo "Setting up Extraterm support."

    # Put our enhanced commands at the start of the PATH.
    filedir=`dirname "${(%):-%x}"`
    export PATH="$PWD/$filedir:$PATH"

    # Insert our special code to communicate to Extraterm the status of the last command.
    extraterm_install_prompt_integration () {
        local prefix
        
        if [[ ! "$PS1" =~ "$LC_EXTRATERM_COOKIE" ]] ; then
            prefix=`echo -n -e "%{\0033&${LC_EXTRATERM_COOKIE};3\0007%}%?%{\0000%}"`
            export PS1="${prefix}${PS1}"
        fi
    }
    extraterm_install_prompt_integration
    add-zsh-hook precmd extraterm_install_prompt_integration

    preexec () {
        echo -n -e "\0033&${LC_EXTRATERM_COOKIE};2;zsh\0007"
        echo -n $1
        echo -n -e "\0000"
    }

    # Look for Python 3 support.
    if ! which python3 > /dev/null; then
        echo "Unable to find the Python3 executable!"
    else
        alias from="exfrom.py"
        alias show="exshow.py"
    fi
fi
