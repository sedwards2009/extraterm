---
title: Extraterm v0.28.0 released
date: 2017-09-10 20:46:00 +0100
categories: release
---
Version 0.28.0 fixes a bunch of annoying bugs.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.28.0)


Changes:
* The Extraterm security cookie has been renamed to LC_EXTRATERM_COOKIE to allow it to be forwarded automatically across SSH.
* The bottom of frames no longer overlap the contents slightly.

Fixes:
* Fix a bug where the display may appear to quickly bounce after executing a command with no output.
* Mostly fixed Zsh right-hand-side prompt positioning.
* Fix copy and paste inside viewer tabs.
* Fix a problem where the last pixel line may be cut off at the bottom of a terminal tab.
* Fix the "Inject Fish Shell Integration" command which was completely broken.
* The "Inject Shell Integration" commands now hide most of the injected code from view.
* The "Inject Shell Integration" commands can now be safely applied multiple times to the same session.
* Fix the pulldown in the tips and make it appear again.
