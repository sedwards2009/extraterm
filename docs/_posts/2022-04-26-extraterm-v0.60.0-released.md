---
title: First preview of the new Qt based Extraterm
date: 2022-04-26 10:45:00 +0200
categories: news
---

In the middle of last year I decided to move this project off Electron and onto a foundation built around [Qt](https://www.qt.io/) and [NodeJS](https://nodejs.org/en/) with [NodeGui](https://github.com/nodegui/nodegui) in the middle tying these two together. The goal being to improve resource usage, stability, and performance.

Today I'm proud to [release the first preview of this new Extraterm](https://github.com/sedwards2009/extraterm/releases). It is a heavy "ground up" rewrite of almost all of the application. As such it doesn't yet have all of the features of its Electron based predecessor. But the hard foundation work is done and features are being added back in at a rapid pace.

With this release I want to move into a normal cycle of improvements and releases coming out in days and weeks, not months and years. This is also a chance for others to join in and help test and shake out the (many) bugs and give feedback to shape the project.

So, what works right now?

* Terminal emulation works fine, also rendering, ligatures, hyperlinks, and styles.
* The dark flat modern visual style. It looks very close to the classic Electron based application.
* Tabs
* Tab titles
* Frames work, but many of the associated actions around them don't.
* Command Palette
* Context menus
* General Settings is present but some of the settings don't do anything yet.
* Appearance Settings is mostly complete. Custom window titles only work on Linux though.
* Session Types Settings is complete.
* Frames Settings is complete.
* Extensions Settings is complete.
* Multiple windows.
* Half of the extensions work.

It feels much more responsive than the older Electron version and the resource usage is much improved. Note that little work has been spent on performance optimisation so far. There is no GPU accelerated rendering beyond what Qt itself uses. Yet, it feels plenty fast.

If you want to try it out you can safely install both Electron and Qt versions side-by-side. They have different names and separate configuration files and shouldn't interfer with each other.
[Releases are available on GitHub](https://github.com/sedwards2009/extraterm/releases). The Qt versions is version 0.60.0 and later.

If you find bugs you can add them to the [issue tracker here on GitHub](https://github.com/sedwards2009/extraterm/issues). Make sure you mention which exact verson of Extraterm you are using and the operating system.
