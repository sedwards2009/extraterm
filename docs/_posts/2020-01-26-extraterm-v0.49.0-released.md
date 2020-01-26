---
title: Extraterm v0.49.0 released
date: 2020-01-26 11:25:00 +0100
categories: release
---

The headline feature for this release is support for font ligatures. "Programming" ligatures in fonts like [Fira Code](https://github.com/tonsky/FiraCode), [Monoid](https://larsenwork.com/monoid/), [Hasklig](https://github.com/i-tu/Hasklig), or even the new font [Cascadia Code](https://github.com/microsoft/cascadia-code), can now be displaying inside Extraterm.

Extraterm itself has bundled a copy of DevaVu Sans Mono for a quite some time. This included font has been patched with ligature support. The new font is called "Liga DejaVu Sans Mono". You may have to manually select it in the "Settings->Appearance" tab before you can also see ligatures.

New features:

* Support for font ligatures. This can also be turned on/off in the "Settings->Appearance" tab.

Bug fixes:

* Fix crash when a frame is created but is off screen due to the scrollback viewed.
* Fix a minor but still annoying shifting/glitch in the frames.

Changes:
* Replaced the included copy of font DejaVu Sans mono with a version containing patched ligatures. New font is called "Liga DejaVu Sans mono ".

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.49.0)
