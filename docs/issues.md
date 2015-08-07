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


Feature: Add configuration options to not frame certain commands
================================================================
The 'cd' command doesn't need a command frame ever. It should be possible to specify a list of regexp of command lines which should not be framed.


Feature: Add an Insert Symbol feature (unicode)
===============================================
Just like insert symbol in a word processor.


Bug: Frame tags should be unique for the whole application, not just in the same tab
====================================================================================


Bug: Selecting text doesn't automatically scroll the tab contents when the edge is reached
==========================================================================================


Bug: Select and copy multiple lines of text results in one line
===============================================================
Multiple lines of text are pasted into Atom (etc) as one long single line.


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
It would be nice if we could intergrate output formatting for certain commands in a flexible and configurable way.


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
