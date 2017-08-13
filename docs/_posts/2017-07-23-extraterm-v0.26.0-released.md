---
title: Extraterm v0.26.0 released
date: 2017-07-23 16:27:00 +0100
categories: release
---
Version 0.26.0 features a new logo for the project and many bug fixes.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.26.0)

*Changes:*

* Added the new Extraterm logo. Thanks go to Gabriel Harel.
* Frames containing text and terminal output now spawn horizontal scrollbars if needed.
* Make the command palette appear after right mouse button in viewer tabs.
* Fix calculating the width of the terminal in the presence of fractional widths.
* Fix glitchy behaviour where text may shift up/down.
* Fix middle mouse button clipboard paste when done below the terminal area.
* Fix a bug where the current shell disappears after executing commands with the shell scrolled off screen.
* Fix a crash when exiting the app via the window close button.
* Prevent Electron from loading dragged and dropped files into the our windows.
* Copy mouse selections inside a viewer tab to the clipboard automatically.
* Make the "type selection" commands work when the cursor is not inside a frame but inside text.
* Strip out unneeded files from the packages/zips.
