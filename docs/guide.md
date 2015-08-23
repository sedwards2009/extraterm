User Interface
==============

Menu
----
In the top right corner of the window is the application menu with the "stacked bars" icon.


Terminal Tabs
-------------
Terminals are shown inside tabs. New tabs can be created by clicking on the + (plus) icon at the top.

The "Split" option on the application menu can be selected to split the window into to two groups of side-by-side tabs.


Short cuts:

* Use Shift+Left and Shift+Right to move between tabs.
* Ctrl+T opens a new tab.
* Ctrl+Tab to switch between panes.
* Ctrl+S Split/unsplit the view into 2 side-by-side panes.

Tip: Turning off split view is a fast way of giving a terminal tab more space. When you split the view again, Extraterm will remember and restore the previous configuration.


Selections and the Clipboard
----------------------------
Text can be selected using the mouse. Selections are immediately copied to the clipboard as is common on unix-like desktops. Also middle mouse button to paste is supported. Control+Shift+C and Control+Shift+V keyboard shortcuts do clipboard copy and paste respectively.

Some applications use the mouse input themselves and prevent normal mouse selection from working. In these cases it is possible to hold the Control key and then make a selection with the mouse.


Frames & Viewers
----------------
Frames group data and text. They come in different various kinds depending on
the data.

Use to Ctrl+Space to focus frame. Once a command frame is focused,
use cursor up/down to move between frames. Use the escape key to exit this
mode, or just start typing to continue sending keys to the currently running
command or shell.



Command Frames
--------------
Command frames hold the output of command given on the command line. In the
top left of a command frame is an icon indicating the status of the command
execution. A good checkmark indicates that the command complete successfully
and return a 0 status code. Any other status code is indicated by a red cross
icon and usually indicates an error.

Frames can be prevented for certain commands by adding a list of regular
expressions to the "noFrameCommands" property in the configuration file.
Each regular expression is matched against the command line. If one matches,
then the frame is not shown.
