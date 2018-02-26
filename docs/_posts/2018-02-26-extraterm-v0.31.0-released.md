---
title: Extraterm v0.31.0 released
date: 2018-02-26 21:30:00 +0100
categories: release
---
A bug fix and minor feature release.

* Show the running command in its command frame/bar.
* Prevent the command frame/bar for a running command from being deleted or moved.
* Prevent the command frame of a busy download or show command from being deleted or moved.
* Add a `--download` option to the `show` command to download but not display the file.
* Add a `--save` option to the `from` command to write the frame to disk using its original file name.
* Use colours from the theme for command frames.
* Tweak the command frame appearance, make the title bar less tall.
* Fix a bug in the text viewer where it may return outdated data to the `from` command.
* Remove the scrollback size settings which specified pixels.
* Added a scrollback size option which limits the number of lines of text.
* Fix a bug where `show` would fail on very small files.
* Fix a bug where oversized characters/glymphs would wreck the layout of text.
* Fix a bug where `show` would crash when reading from stdin.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.31.0)
