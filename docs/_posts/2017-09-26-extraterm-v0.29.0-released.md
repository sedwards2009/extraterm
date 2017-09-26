---
title: Extraterm v0.29.0 released
date: 2017-09-26 19:00:00 +0100
categories: release
---
This release focuses on eliminating UI and text alignment glitches, and adds UI scaling.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.29.0)


Added:
* Option in the Settings tab to scale the size of UI.
* Show an icon in the frame of Tips.

Changed:
* Disable Blink's DPI dependent UI scaling and do it manually. Fixes numerous layout glitches.
* Write application logs to $SETTING_DIR/extraterm/extraterm.log
* Make 'atomic-dark' the default UI theme.
* Added a close pane button to the Pane Menu.

Fixed:
* Fix a focus bug when opening a new terminal tab using the shortcut. [issue 60](https://github.com/sedwards2009/extraterm/issues/60)
* Tweaked the position and alignment of UI elements.
* Fixed the Zsh integration script and made it work with zsh's prompt system. [issue 61](https://github.com/sedwards2009/extraterm/issues/61)
