---
title: Extraterm v0.59.0 released
date: 2021-04-17 12:00:00 +0100
categories: release
---

This release changes how the main Extraterm application is started up. It will now try to open the first terminal session in the same directory from where Extraterm was started. This makes it easier to support integration with operating system desktops. For example, support for the "Open in Terminal" menu item in Linux Mint's file manager and other Linux desktops.

Also, if Extraterm is run again, then a new terminal tab is opened and the window is brought to the top.


**Features**

* "Open in Extraterm" option added to Windows Explorer's context menus during install. [#330](https://github.com/sedwards2009/extraterm/issues/330)
* Added command to open the current directory in the desktop file manager.
* Added command to copy the current directory path to the clipboard.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.59.0)
