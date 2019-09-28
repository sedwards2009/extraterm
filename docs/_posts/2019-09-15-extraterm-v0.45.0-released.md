---
title: Extraterm v0.45.0 released
date: 2019-09-15 15:10:00 +0200
categories: release
---

A lot of work has gone into improving mouse support for applications. Mouse wheel scrolling now works correctly in the `micro` and `nano` text editors and possibly others.

New features:

* Add Bracketed paste support.
* Unwrap lines when copying to clipboard. [issue #69](https://github.com/sedwards2009/extraterm/issues/69)
* Send mouse wheel events to applications with mouse support. [issue #196](https://github.com/sedwards2009/extraterm/issues/196)
* Send cursor up/down to applications using the alternate screen.


Bug fixes:

* Fix support for right mouse button for applications with mouse support.
* Fix bug where zoom wasn't applied to new frames.


Changes:

* Replace EmojiOne with Twemoji for better Unicode coverage.


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.45.0)
