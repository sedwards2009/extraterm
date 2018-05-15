@echo off
rem This batch file rebuilds all of the native node modules by using electron-rebuild
rem

set PATH=c:\python27\;%PATH%
call "c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat" amd64
echo -
echo Rebuilding all Node native modules
echo -
call node_modules\.bin\electron-rebuild.cmd -s -f -v 2.0.0 -t prod,optional,dev
echo -
echo Done rebuilding
echo -
