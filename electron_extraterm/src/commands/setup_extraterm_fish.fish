# This file should be sourced from your ~/.config/config.fish file.
#
# Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
#
# This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
# 

if test -z "$LC_EXTRATERM_COOKIE"
  exit 0
end

if echo "$TERM" | grep -q -E '^screen'
  set -e LC_EXTRATERM_COOKIE
  exit 0
end

echo "Setting up Extraterm support."

set -l filedir (dirname (status -f))
set COMMAND_DIR (python3 -c import\ os.path\nimport\ sys\nprint\(os.path.abspath\(sys.argv\[1\]\)\)\n "$filedir")

function extraterm_preexec -e fish_preexec
  echo -n -e -s "\033&" $LC_EXTRATERM_COOKIE ";2;fish\007"
  echo -n $argv[1]
  echo -n -e "\000"
end

function extraterm_postexec -e fish_postexec
  set -l status_backup $status
  echo -n -e -s "\033" "&" $LC_EXTRATERM_COOKIE ";3\007"
  echo -n $status_backup
  echo -n -e "\000"
end

function from 
    python3 $COMMAND_DIR/exfrom.py $argv
end

function show
    python3 $COMMAND_DIR/exshow.py $argv
end
