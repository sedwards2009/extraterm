---
title: Extraterm v0.50.0 released
date: 2020-05-20 21:50:00 +0200
categories: release
---

This release cycle focuses on the infrastructure needed to support extensions/plugins. This is a first step, but it is possible to create extensions and manually install them. The Settings tab also contains a new Extensions area which shows the current list of extensions, allows them to be enabled or disabled, and also presents detailed information about each one.

The way keybindings are gathered and compiled has been changed to better support extensions. This was also an opportunity to simplify how people can tweak and modify their own keybindings via the Settings tab. The new system makes it easy to directly remove or replace a keybinding for a command, or to revert it back to the default. People who had custom keybindings configured will lose them in the transition to version 0.50.0. Sorry.

This release also adds integration with [TLDR Pages](https://tldr.sh/). These are the command usage examples which you wish were on every manual (man) page. This little extension makes it easy to find the examples for a given command and to type that example directly into the current terminal. "TLDR pages" can be found via the Command Palette.

![TLDR extension in action](/tldr_optimized.gif)


**New features:**

* Added TLDR Pages feature. Easily insert TLDR example commands into the current terminal.
* Added Extensions tab to the Settings. Possible to turn some extensions on or off.
* Now possible to create 3rd party exensions.

**Changes:**

* Keybindings tab is much simpler to use and allows directly changes to the current scheme.

**Bug fixes:**

* The Debian package now correctly runs on hardened Linux kernels. [Issue #228](https://github.com/sedwards2009/extraterm/issues/228)

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.50.0)
