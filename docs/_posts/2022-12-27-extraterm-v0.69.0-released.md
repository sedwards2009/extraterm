---
title: Extraterm Qt v0.69.0 released
date: 2022-12-27 19:00:00 +0100
categories: release
---

The new Colorizer extension has been added. This is a completely new extension which can automatically highlight certain words in the terminal output. For example, "Warning" and "Error". It is configurable and supports regular expressions so you can detect and highlight things like dates and IP addresses if you want to.

The Tips extension makes a come back in this version too.


**Features**

* Add Tips extension
* Add Colorizer extension
* Extension API supports adding pages to the Settings tab.
* Warn when the regexp is invalid in the Find extension
* Command line "scripting" interface is working again. Starting the app a second time will once again reuse the existing instance and open a new terminal.
* Add the application Quit command

**Bug Fixes**

* "Bracketed paste" was not always being applied.
* Fix a bug which broke the `Aa` and `.*` buttons in the Find extension.
* Move windows which are off screen, onto the visible screen.
* Fix bug where closing all terminals, then opening a new one => crash.
* Prevent the "Copy Command" from sometimes crashing the whole application.

**Changes**

* Convert line endings when pasting muli-line text on Windows.
* Tweaked the size of icons in block header bars.
* Keep the icon popup on screen in the Terminal Title extension.
* Catch and log exceptions and make the extension API more robust.
* Limit tabs commands to running only when a tab is focused


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.69.0)
