Feature: Activity monitor on the tabs
=====================================
Show a icon or something in the tab label to indicate when the tab has activity.

Feature: Menu key for opening context menus
===========================================


Bug: Make the python support programs robust in the face of Ctrl+C
==================================================================
It would be nice if exteraterm could detect when mime data transmission has been interrupted and then recover by going back in normal mode.


Feature: Add an Insert Symbol feature (unicode)
===============================================
Just like insert symbol in a word processor.


Feature: Add option to show command to display an image directly inline with no frame
========================================================================================


Feature: Add support for showing tabular data
=============================================


Feature: Show an activity icon on the tab header when a command is running
==========================================================================


Feature: Support zoom in/out for tabs
=====================================


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


Bug: Middle click on Windows shows that annoying scroll ball thing
==================================================================


Feature: Ability to snapshot the current active screen and put it in a new tab
==============================================================================
Some times it would be useful to take a 'photo' of the contents of the current terminal screen and put it into a tab for later reference.


TODO: Make attribute vs JS property situation consistent in elements
====================================================================


TODO: Make the Java style setters/getters vs properties situation consistent
============================================================================
There is now a mix of setTitle() and getTitle() or title() vs properties with field style access. Device a policy and enforce it.


Feature: Integrate the user's pager/viewer (i.e. 'less') with Extraterm
=================================================================
It would be nice if the functions of viewer and pager could be done by Extraterm, unlike 'less' the whole file could be available and searchable etc after the pager program has exited control has returned to the shell.


Bug: Resizing terminals preserves the top left regardless of where the cursor is
================================================================================
If for example the terminal window is made small and the cursor is at the bottom row, then the terminal should be resized by pushing lines into the scrollback and then removing rows from the term screen.
