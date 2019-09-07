---
title: Extraterm v0.44.1 released
date: 2019-09-01 09:50:00 +0200
categories: release
---

Bug fixes:

* Fix fonts with spaces in their names would fail to load. [issue 206](https://github.com/sedwards2009/extraterm/issues/206)
* Use all of the available colored glyphs on Windows.
* Prevent some cases where wide glyphs would be cut in half.
* Fixed a whole lot of memory leaks.
* The application version in `package.json` is correct this time. [issue 207](https://github.com/sedwards2009/extraterm/issues/207)
* Reduce the amount of memory used when updating the terminal. (disable Ace UndoManager)
* Fix problem where horizontal scrolling won't show contents.
* Move focus away from the window maximise button after click.
* Fix the coordinates being out by (1,1) for urxvt mouse reporting.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.44.1)
