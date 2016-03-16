FAQ
===

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
