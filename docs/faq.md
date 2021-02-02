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


Window maximize/moving/resizing doesn't work
--------------------------------------------

This can be a problem in situations where Extraterm is running through a X window server such as mobaxterm. This can generally be solved by telling Extraterm to use a "Native" window title bar. Set this in the "Settings", "Appearance" tab, "Interface" section, option "Window Title Bar".


Linux Mint: Pressing Ctrl + ; displays pop up with clipboard stuff
------------------------------------------------------------------

The pop is a list of recent clipboard contents and it lets you choose one of them to paste. This is part of the Linux Mint itself, namely the Clipboard addon to the Fcitx input method.

To free this global shortcut, do this:

* Find the "Keyboard" icon in the system tray.
* Right click on it and select "Configure". The "Input Method Configuration" window will appear.
* Click on the "Addon" tab.
* Click on "Clipboard" in the list.
* Click on the "Configure" button at the bottom on the window.
* Click on the button next to the label "Trigger Key for Clipboard History List". The button will have the label "Ctrl+;".
* A small window will pop up asking you to enter a key. Press the Escape key on your keyboard.
* Click on "OK" in the "Clipboard" window.
* "Ctrl+;" is now free for use by Extraterm.
