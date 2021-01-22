---
title: Extraterm v0.57.1 released
date: 2021-01-22 19:30:00 +0100
categories: release
---

**Bug fixes**

* Fix a memory leak which affects long running sessions.
* Fix inverse text rendering on transparent windows. [#320](https://github.com/sedwards2009/extraterm/issues/320) [#283](https://github.com/sedwards2009/extraterm/issues/283)
* Fix a crash when editing text directly.
* Fix Python detection on Cygwin. (Thanks Doğan Çelik)

**Changes**

* Improve rendering speed by preventing some memory allocations.
* Improve rendering speed by caching cell to JS string conversions.


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.57.1)
