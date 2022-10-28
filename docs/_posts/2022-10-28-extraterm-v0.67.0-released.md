---
title: Extraterm Qt v0.67.0 released
date: 2022-10-28 17:54:00 +0200
categories: release
---

It is a busy time of the year and this release took much longer to reach than expected. A huge amount of work went into optimising the build process and the final application build files and packaging. Most of the code is now being compressed and unused code is aggressively being removed. This results in smaller package and installer sizes and also an application which starts up faster.

| Package          | 0.66   | | 0.67   |
|------------------|--------|-|--------|
|Linux zip         | 69.1MB |→| 54.6MB |
|Linux .deb        | 45.8MB |→| 37.7MB |
|macOS .dmg        | 78.1MB |→| 35.3MB |
|Windows installer | 47.3MB |→| 33.6MB |


**Features**

* Optimised packaging of the whole application. Now takes less space on disk and starts up faster.
* Upgraded the `node-pty` version being used. This appears to give a nice speed boost to terminals on different platforms.

**Bug Fixes**

* Fixed bug which prevented terminal font size and the tab bar from reacting to screen DPI changes.
* Fixed a bunch of problems in the mouse support which affected recent versions of `htop` and `mc`.
* On Windows look for the user's home directory in `$HOMEPATH` instead of `$HOME`.
* Fixed bug which stopped custom keybindings from working. [issue #387](https://github.com/sedwards2009/extraterm/issues/387)

**Changes**

* Removed the old URXVT and UTF8 mouse terminal protocol support.


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.67.0)
