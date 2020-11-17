---
title: Extraterm v0.55.1 released
date: 2020-11-16 20:30:00 +0100
categories: release
---

A bug fix release.

**Changes**

* Added "Paste from selection clipboard" option to the mouse button configuration on Linux. [#195](https://github.com/sedwards2009/extraterm/issues/195)
* The terminal session extension API now uses less subclassing for editors.
* Terminals only stay open on exit if the shell returned a non-zero exit code. [#274](https://github.com/sedwards2009/extraterm/issues/274)

**Bug fixes**

* Fixed many memory leaks. Long running Extraterm instances will now do a much better job of reusing and/or releasing unneeded memory.
* Fixed bug where ligatures would not be applied or rendered correctly.
* Prevent a crash in the font listing when many fonts are available. [#304](https://github.com/sedwards2009/extraterm/issues/304) (Special thanks to Matthew Eddey and Clint Priest for their work tracking this down.)
* Prevent a nasty hang/crash if the a bash shell runs a new bash shell and the integration executed again. [#300](https://github.com/sedwards2009/extraterm/issues/300)

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.55.1)
