Bug: Selections don't scroll when the page scrolls
==================================================
A selection on the active part of the terminal screen does not scroll with the text. It stays in the same relative position.


Feature: Directly support cygwin and babun
==========================================

* Determine where the cygwin root is.
* Fetch the user's default shell from /etc/passwd
* Fetch the user's home directory from /etc/passwd
* Set the HOME dir.


Feature: Activity monitor on the tabs
=====================================
Show a icon or something in the tab label to indicate when the tab has activity.


Feature: Open New Window
========================
Support Ctrl+N to open a new window.


Feature: Context menu on tabs and terminals
===========================================


Feature: Menu key for opening context menus
===========================================


Bug: Make the python support programs robust in the face of Ctrl+C
==================================================================
It would be nice if exteraterm could detect when mime data transmission has been interrupted and then recover by going back in normal mode.


Feature: Make the command frame headers stay on the screen when a tall frame is scrolled
========================================================================================


TODO: Make the *_ATTR naming for constants consistent
=====================================================
Use ATTR_* instead.


Feature: Add an option to move a frame into its own tab
=======================================================


Bug: Minimise flicker with command frames by delaying the initial rendering
===========================================================================


Feature: Add an Insert Symbol feature (unicode)
===============================================
Just like insert symbol in a word processor.


Bug: Frame tags should be unique for the whole application, not just in the same tab
====================================================================================


Bug: Selecting text doesn't automatically scroll the tab contents when the edge is reached
==========================================================================================


Feature: Add option to show command to display an image directly inline
=======================================================================


Feature: Add support for showing tabular data
=============================================


Feature: Add support to show command to format text into a table for display
============================================================================


Feature: Show an activity icon on the tab header when a command is running
==========================================================================


Feature: Support zoom in/out for tabs
=====================================


Feature: Support double and triple clicks to select words etc
=============================================================


TODO: Check and test the unicode support
========================================


TODO: Test the embedded viewer with really long command lines
=============================================================


Feature: Add a way to process command output based on the command line
======================================================================
It would be nice if we could integrate output formatting for certain commands in a flexible and configurable way.


TODO: Refactor the keyboard event handling
==========================================


Feature: Show the red cross in the terminal tab and window title when a command fails
=====================================================================================


Feature: Duplicate tab function
===============================


Feature: Move tab to the left/right pane function
=================================================


Bug: Frame tags need to be unique across terminals/tabs
=======================================================


Bug: Middle click on Windows shows that annoying scroll ball thing
==================================================================


Feature: Mouse free selection mechanism
=======================================
A keyboard focussed way of quickly selecting text is needed.


Feature: Ability to snapshot the current active screen and put it in a new tab
==============================================================================
Some times it would be useful to take a 'photo' of the contents of the current terminal screen and put it into a tab for later reference.
