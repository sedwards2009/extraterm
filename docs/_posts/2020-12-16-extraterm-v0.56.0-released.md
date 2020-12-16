---
title: Extraterm v0.56.0 released
date: 2020-12-16 19:25:00 +0100
categories: release
---

This release adds support for the hyperlink terminal escape sequence. Hyperlinks are now displayed for utilities output them. For example, `ls --hyperlink=auto` will display the folder contents with links. Clicking on a link and holding the Control key will open the link in the default external application like your web browser or file manager. A couple of link related menu items appear on the context menu too, "Open link" and "Copy link/path".


**Features**

* Support for hyperlink escape sequence. [#92](https://github.com/sedwards2009/extraterm/issues/92)


**Bug fixes**

* Fix for the window drag area interfering with pop up menus.
* Fix for the initial session directory not working on Windows. [#310](https://github.com/sedwards2009/extraterm/issues/310)
* Fix the contents of viewer tabs not sizing correctly when the window changes.


**Changes**

* The icon for "open frame in tab" has changed.
* New session menu options have been added to the main window 'burger' menu.
* New session menu options have been removed from the context menu.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.56.0)
