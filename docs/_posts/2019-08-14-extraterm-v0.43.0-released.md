---
title: Extraterm v0.43.0 released
date: 2019-08-14 22:00:00 +0200
categories: release
---
Improved character rendering and new features

This feature release brings big internal changes to how characters and text is drawn to the screen. This delivers more accurate glyph rendering and alignment, and in some cases it may also bring a speed boost. Most importantly it brings a solid foundation on which to build many new and many highly requested features.

New features:

* Improved character rendering and alignment
* 24bit color support
* Pixel perfect box drawing characters
* Curly character style
* Double underline character style
* "Overline" character style
* More Tips

Bug fixes:

* "Show and focus" how key will show the window but not properly focus. [issue 203](https://github.com/sedwards2009/extraterm/issues/203)
* Improvements to how different screen DPIs are handled.
* Fixed bug which sometimes caused the terminal to have the wrong size at start up.
* Fixed the keyboard shortcuts in the tips.
* Added needed DLLs on Window for the font detection code. [issue 200](https://github.com/sedwards2009/extraterm/issues/200)

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.43.0)
