---
title: Extraterm v0.52.0 released
date: 2020-07-20 23:30:00 +0200
categories: release
---

**New features:**

* Support for multiple WSL2 distributions. Selectable in the sessions configuration tab.

**Changes**

* On WSL/WSL2 Python 3 no longer needs to be available inside the Linux environment. A proxy written in Go now runs inside the WSL environment.

**Bug fixes:**

* Fixed slow down when the scrollback is long.
* Key code sent for Backspace+modifiers is conform other (Linux) emulators.  #271

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.52.0)
