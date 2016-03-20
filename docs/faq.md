FAQ
===


Extraterm won't start on my cygwin
----------------------------------

### Make sure Python 3 is installed

Extraterm requires Python 3 to be installed in cygwin or Babun to run.

If you are using plain cygwin you can install `python3` via the installer.

If you are Babun you can install Python 3 from a shell using:

```
pact install python3
```


### Problems finding the cygwin installation directory

Extraterm tries to find the location of your cygwin installation directory by looking in the Windows registry. If it fails to find anything there then it will look in the default Babun installation directory. If that too fails then Extraterm will fail to start up with an error like: "TypeError: Cannot read property 'cygwinDir' of null".

To explicitly specify where your cygwin installation directory is you can pass the `--cygwinDir` option to Extraterm when starting it up:

```
extraterm.exe --cygwinDir=C:\cygwin64
```


How can I use Extraterm's shell integration over ssh?
-----------------------------------------------------

To use Extraterm's shell integration across `ssh` two things have to be set up:

* Just like on your local machine the script from the extraterm-commands zip needs to be read in on the remote machine.
* The `EXTRATERM_COOKIE` environment variable needs to be set on the remote end.

First, before you run `ssh`, print the value of the `EXTRATERM_COOKIE` environment variable.
```
echo $EXTRATERM_COOKIE
```
Now, run `ssh` to go to your remote machine. Set the `EXTRATERM_COOKIE` environment variable to the value which was just displayed before.

For bash and zshell that is:
```
EXTRATERM_COOKIE=<value goes here>
```
Fish uses:
```
set -x EXTRATERM_COOKIE <value goes here>
```
Hopefully this will be made easier in the future.
