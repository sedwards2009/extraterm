---
title: Extraterm v0.49.2 released
date: 2020-03-16 22:30:00 +0100
categories: release
---

Bug fixes and changes:

* Extraterm will now keep the terminal open on exit and wait for a keypress. This makes it possible to see any error message produced by the remote process. [Issue #246](https://github.com/sedwards2009/extraterm/issues/246)
* Clip long command lines in frame headers. [Issue #239](https://github.com/sedwards2009/extraterm/issues/239)
* Fix: "Context menus in split-pane mode not displaying properly". [Issue #220](https://github.com/sedwards2009/extraterm/issues/220)
* Improve how the terminal title edit pane resizes.
* Add a Quit command and key shortcut for macOS. [Issue #248](https://github.com/sedwards2009/extraterm/issues/248)
* Make the tab bar itself scrollable when it becomes too wide. [Issue 224](https://github.com/sedwards2009/extraterm/issues/224)
* When resetting the terminal state, also reset the mouse mode.
* Publish Extraterm as a Debian package. It should work on most AMD64 based systems which use the `apt` package manager.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.49.2)
