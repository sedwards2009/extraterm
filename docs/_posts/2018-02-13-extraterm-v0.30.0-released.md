---
title: Extraterm v0.30.0 released
date: 2018-02-13 21:35:00 +0100
categories: release
---
This release is focused on big improvement to how the `show` and `from` commands do their work. Now it is possible to use `show` and `from` to move and operate on large files. These files are kept on disk in encrypted form as long as Extraterm is running and the files are still present in a terminal tab. `show` also supports showing binary files as downloads.

* Robust large file transfers. [issue #67](https://github.com/sedwards2009/extraterm/issues/67).
* Add support for dragging files directly from a frame into your file manager / Windows Explorer / Finder.
* Limiting the size of the scroll-back is now done by raw pixel size, and also by the number of frames. Frames are being directly limited because they are quite heavy on resources.
* Fixed a bug where the Command Palette would refuse focus. (only saw this problem on Windows)
* Fixed a bug where cursor mode didn't work for images. [issue #72](https://github.com/sedwards2009/extraterm/issues/72)

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.30.0)
