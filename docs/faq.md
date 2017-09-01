FAQ
===


Extraterm won't start on my cygwin/babun
----------------------------------------

### Make sure Python 3 is installed

Extraterm requires Python 3 to be installed in cygwin or Babun to run.

If you are using plain cygwin you can install `python3` via the installer.

If you are Babun you can install Python 3 from a shell using:

```
pact install python3
```

You can verify that python3 has been installed and is working correctly by
opening the normal babun shell and running `python3 -V`. This should print
the version number of your Python 3.


### Extraterm still not starting on Babun

At the time of writing this (July 2017) a fresh install of Babun will have
a broken Python 3 installation. This can be tested for by opening the normal
babun shell and running `python3 -V`. If nothing is printed then your
`python3` is most likely broken.

* Open up the Windows Explorer.
* Navigate to your Babun installation directory. This is typically in `C:\Users\YourName\.babun\`.
* Double click to run `update.bat` in that directory.

This will update the cygwin parts of Babun and fix your installation.


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
* The `LC_EXTRATERM_COOKIE` environment variable needs to be set on the remote end.

First, before you run `ssh`, print the value of the `LC_EXTRATERM_COOKIE` environment variable.
```
echo $LC_EXTRATERM_COOKIE
```
Now, run `ssh` to go to your remote machine. Set the `LC_EXTRATERM_COOKIE` environment variable to the value which was just displayed before.

For bash and zshell that is:
```
LC_EXTRATERM_COOKIE=<value goes here>
```
Fish uses:
```
set -x LC_EXTRATERM_COOKIE <value goes here>
```
Hopefully this will be made easier in the future.
