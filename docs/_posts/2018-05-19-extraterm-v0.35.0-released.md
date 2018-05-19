---
title: Extraterm v0.35.0 released
date: 2018-05-19 22:00:00 +0100
categories: release
---
This release is focused on better support for Windows and its command line shells such as the classic cmd.exe, Windows PowerShell, PowerShell Core and Windows Subsystem for Linux (WSL).

* Added support for Windows console applications likes cmd.exe and PowerShell. [#19](https://github.com/sedwards2009/extraterm/issues/19)
* Added support for Windows Subsystem for Linux (WSL). [#86](https://github.com/sedwards2009/extraterm/issues/86)
* Fix for AltGr not working on Windows [#87](https://github.com/sedwards2009/extraterm/issues/87)
* Made 'frames' optional when shell integration is active. [#90](https://github.com/sedwards2009/extraterm/issues/90)
* Fix problems with the terminal screen clearing and messing up zsh and other shells when the shell integration is used. [#89](https://github.com/sedwards2009/extraterm/issues/89)
* The application version is now shown in the About tab.

Also, platform which Extraterm runs on, Electron, has been upgraded to 2.0. Note that the Windows console based shells like cmd.exe and PowerShell don't and can't support the shell integration features. Support for 32bit Linux has been dropped.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.35.0)
