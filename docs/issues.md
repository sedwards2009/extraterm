Selections don't scroll when the page scrolls
=============================================
A selection on the active part of the terminal screen does not scroll with the text. It stays in the same relative position.


Directly support cygwin and babun
=================================

* Determine where the cygwin root is.
* Fetch the user's default shell from /etc/passwd
* Fetch the user's home directory from /etc/passwd
* Set the HOME dir.


Activity monitor on the tabs
============================
Show a icon or something in the tab label to indicate when the tab has activity.


Support New Window
==================
Support Ctrl+N to open a new window.


Support context menu on tabs and terminals
==========================================



Support the Menu key for opening context menus
==============================================


Make the python support programs robust in the face of Ctrl+C
=============================================================
It would be nice if exteraterm could detect when mime data transmission has been interrupted and then recover by going back in normal mode.


Make the command frame headers stay on the screen when a tall frame is scrolled
===============================================================================


Make the *_ATTR naming for constants consistent
===============================================
Use ATTR_* instead.


Add an option to move a frame into its own tab
==============================================


Minimise flicker with command frames by delaying the initial rendering
======================================================================


Minimise flicker when exiting the 'less' command and removing the blank line
============================================================================


Add configuration options to not frame certain commands
=======================================================
The 'cd' command doesn't need a command frame ever. It should be possible to specify a list of regexp of command lines which should not be framed.


Add an Insert Symbol feature (unicode)
======================================
Just like insert symbol in a word processor.


Split/unsplit command should preserve the position of tabs
==========================================================
When using a split view with multiple tabs everywhere, the switch to unsplit mode and then back should preserve the original positions of the tabs. i.e. it should be reversable. This is useful when using split view mode and you want to temporarily go to unsplit mode to make a terminal bigger.


Add a short cut to the Split view option
========================================


Bug: Frame tags should be unique for the whole application, not just in the same tab
====================================================================================


Bug: Selecting text doesn't automatically scroll the tab contents when the edge is reached
==========================================================================================


Bug: Select and copy multiple lines of text results in one line
===============================================================
Multiple lines of text are pasted into Atom (etc) as one long single line.


Bug: Focus after clicking taskbar icon
======================================
Clicking on the icon in the taskbar brings the app to the front but the focus is not placed in the last terminal.


Add option to show command to display an image directly inline
==============================================================


Add support for showing tabular data
====================================


Add support to show command to format text into a table for display
===================================================================


Show an activity icon on the tab header when a command is running
=================================================================


Support zoom in/out for tabs
============================


Support double and triple clicks to select words etc
====================================================


TODO: Check and test the unicode support
========================================


TODO: Test the embedded viewer with really long command lines
=============================================================


Add a way to process command output based on the command line
=============================================================
It would be nice if we could intergrate output formatting for certain commands in a flexible and configurable way.
