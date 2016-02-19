# This file should be sourced from your ~/.config/config.fish file.
#
# Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

if test -n "$EXTRATERM_COOKIE"
    echo "Setting up Extraterm support."
    
    # Put our enhanced commands at the start of the PATH.
    set -l filedir (dirname (status -f))
    set -x PATH $PWD/$filedir $PATH

    function extraterm_preexec -e fish_preexec
      echo -n -e -s "\033&" $EXTRATERM_COOKIE ";2;fish\007"
      echo -n $argv[1]
      echo -n -e "\000"
    end

    function extraterm_postexec -e fish_postexec
      set -l status_backup $status
      echo -n -e -s "\033" "&" $EXTRATERM_COOKIE ";3\007"
      echo -n $status_backup
      echo -n -e "\000"
    end
    
    function from 
        exfrom.py $argv
    end
    
    function show
        exshow.py $argv
    end
end
