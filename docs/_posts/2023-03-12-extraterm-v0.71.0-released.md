---
title: Extraterm Qt v0.71.0 released
date: 2023-03-12 19:35:00 +0100
categories: release
version: 0.71.0
---

This release is a mixed bag of smaller features and fixes.

First, an update checking extension has been added which, if you allow it, will check for new Extraterm releases every day and bring you any good news. It respects your privacy and doesn't send anything which can track you.

Extraterm now supports "Input Methods" meaning keyboard and character input support for different languages is greatly improved. Keyboard layouts with dead keys, compose keys or even on-screen character menus should work correctly now.

Text selection has been improved. Starting a selection with the shift key + mouse will perform a block selection instead of a normal one. Selections can now be adjusted after they have been made, by shift clicking to change where they start or end.

Extraterm now understands and supports other shell integration escape codes. (nushell)[https://www.nushell.sh/] has built in support for these codes and Extraterm can now use them.

**Features**

* Update Checker
* Block selections
* Extending selections
* Support for Input Methods [#411](https://github.com/sedwards2009/extraterm/issues/411) [#408](https://github.com/sedwards2009/extraterm/issues/408)
* Support for FinalTerm/iTerm2/VSCode style shell integration escape codes

**Bug Fixes**

* Fixed a couple UI rendering problems affecting radio buttons
* Fixed problem where keyboard shortcuts don't appear to work immediately after application startup. [#413](https://github.com/sedwards2009/extraterm/issues/413)
* On Windows, don't trigger the WSL2 VM to start up when Extraterm starts [#401](https://github.com/sedwards2009/extraterm/issues/401)

**Changes**

* Add `showDialog()` to Extension API
* The selection is cleared if the cells below it are modified.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.71.0)
