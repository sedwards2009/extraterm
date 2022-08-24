---
title: Extraterm Qt v0.66.0 released
date: 2022-08-24 20:45:00 +0200
categories: release
---

**Features**

* Downloads are supported again via the `show` command
* Displaying images is supported again via `show`
* Images can now be zoomed in and out
* Images are zoomed to fit the window (on context menu)
* `from` command can pull contents from downloads/images
* System tray support and "minimize to tray" option is back
* Custom rendering is used for more Unicode block drawing characters and related geometric shapes.

**Changes**

* Extension API was expanded to support custom block types
* Added Linux AppImage to the list of package formats
* Debian package has been improved. Extraterm is now available via Debian's "alternatives" system.

**Bug Fixes**

* Shell integration script only runs for interactive sessions
* Launcher program was not finding already running Extraterm instances on Windows.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.66.0)
