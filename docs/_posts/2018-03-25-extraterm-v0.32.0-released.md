---
title: Extraterm v0.32.0 released
date: 2018-03-25 21:15:00 +0100
categories: release
---
A bug fix and feature release.

* Added a viewer which can play most common audio formats.
* Added a `--text` option to the `show` command as a shortcut for setting the mime type to plain text.
* Added a better loading screen.
* Tweaked the UI controls with some simple fade in/out transitions.
* Permit more fonts from the system to be selectable for the terminal font.
* Fixed a regression bug which prevented drag and drop of tabs from working.
* Fixed the `clear` command ^L (issue [#15](https://github.com/sedwards2009/extraterm/issues/15))
* Call the previous $PROMP_COMMAND too from the Bash shell integration (issue [#73](https://github.com/sedwards2009/extraterm/issues/73))

There have also been some big improvements on the source code level:

* npm has been replaced with yarn and its workspaces feature.
* The extension infrastructure has been improved and extended to support viewers in extensions and custom SASS/CSS.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.32.0)
