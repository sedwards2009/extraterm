---
title: Extraterm Qt v0.70.0 released
date: 2023-02-05 19:10:00 +0100
categories: release
version: 0.70.0
---

Version 0.70 upgrades the underlying Qt version from 5 to 6. Support for global shortcuts has been restored too. Qt 6 might introduce some sizing and rendering glitches, especially when different monitor DPIs are involved. Please report any instances of this happening.


**Features**

* Global shortcuts


**Bug Fixes**

* Fix "portable mode" and its configuration file. issue #398
* Make font size increase/descrease keyboard shortcuts work anytime a terminal tab has focus.
* Shell integration for Fish tries harder to avoid running in non-interactive sessions.
* Make the launcher exe open a default terminal on macos

**Changes**

* Upgrade to Qt 6
* Improved the search and ordering of items inside lists like the Command Palette, auto-completion, etc.
* The zip build for Windows is back again.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.70.0)
