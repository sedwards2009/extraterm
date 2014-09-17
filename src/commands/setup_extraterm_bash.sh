# This file should be sourced from your .bashrc file.


if [ -n "$EXTRATERM_COOKIE" ]; then
    echo "Setting up Extraterm support."

    # Put our enhanced commands at the start of the PATH.
    filedir=`dirname "$BASH_SOURCE"`
    export PATH="$PWD/$filedir:$PATH"

    # Look for Python 3 support.
    if ! which python3 > /dev/null; then
        echo "Unable to find the Python3 executable!"
    else
        # Found Python3
        export PROMPT_COMMAND="exbashpostcommand.py \$?"

        preexec () {
            echo -n -e "\033&${EXTRATERM_COOKIE};2;bash\007$1\000"
        }

        preexec_invoke_exec () {
            [ -n "$COMP_LINE" ] && return                     # do nothing if completing
            [ "$BASH_COMMAND" = "$PROMPT_COMMAND" ] && return # don't cause a preexec for $PROMPT_COMMAND
            local this_command=`history 1`; # obtain the command from the history
            preexec "$this_command"
        }
        trap 'preexec_invoke_exec' DEBUG

        alias from="exfrom.py"
    fi
fi
