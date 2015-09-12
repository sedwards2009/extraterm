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


TODO: Make attribute vs JS property situation consistent in elements
====================================================================


TODO: Make the Java style setters/getters vs properties situation consistent
============================================================================
There is now a mix of setTitle() and getTitle() or title() vs properties with field style access. Device a policy and enforce it.


Feature: Integrate the user's pager/viewer (i.e. 'less') with Extraterm
=================================================================
It would be nice if the functions of viewer and pager could be done by Extraterm, unlike 'less' the whole file could be available and searchable etc after the pager program has exited control has returned to the shell.


Feature: Allow regexp and plain string "no frame" patterns
=================================================================


Bug: Resizing terminals preserves the top left regardless of where the cursor is
================================================================================
If for example the terminal window is made small and the cursor is at the bottom row, then the terminal should be resized by pushing lines into the scrollback and then removing rows from the term screen.


Bug: Opening the settings tab is way too slow
==============================================
Opening the settings tab is very slow  because the contents of the settings tab are being rendered in a different process. This extra process is needed because it is not possible to use React inside a shadow DOM (i.e. you can't use React inside the main application window except if it is under the window.docuement). This is a limitation of React. Once React has accepted patches to fix this, then the settings tab can be turned into a normal in-process tab.


Bug: CSS Grid doesn't work inside the settings tab
==================================================
The settings tab is rendered inside an Electron webview tag. This is effectively a new window. CSS Grid is an experimental feature which needs to be turned on with flags. webview doesn't support the flags we need yet. See https://github.com/atom/electron/issues/2749
