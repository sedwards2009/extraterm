---
title: Extraterm v0.36.0 released
date: 2018-08-23 22:00:00 +0100
categories: release
---

This is a large release which contains a lot of work under the hood where CodeMirror has been replaced with Ace to support "in place" text editing. This big change will permit much more flexibility in the future, but right now don't be surprised if there are some unexpected breakages. There are also a quite a few new smaller features.

Changes:

* Replaced CodeMirror with a (fork) of the Ace editor.
* Rearranged the "Settings" tab, "Appearance" page.
* Terminal color themes now use `.itermcolors` format files.
* Added terminal color theme preview to the Settings tab.
* Terminal color themes can be locally added by dropping them into the user terminal themes directory.
* Added button to open the user terminal themes directory in the system file manager.
* Text editor syntax highlighting themes can now be in the common TextMate format.
* Added a preview for the text editor syntax highlighting to the "Settings" tab.
* TextMate syntax highlighting themes can be locally added by dropping them into the user syntax themes directory.
* Added button to open the user syntax highlight theme directory in the system file manager.
* Added extra text editor commands, "add cursor above", "add cursor below" and "add next match to selection". [issue 109](https://github.com/sedwards2009/extraterm/issues/109)
* The zshell integration script should be more robust now. [PR 111](https://github.com/sedwards2009/extraterm/pull/111)
* Added a selection of popular terminal and text highlighting themes plucked from the community.

Note: Emoji support is a bit buggy at the moment.

Note: The list of supported syntaxes for highlighting when showing text files has changed.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.36.0)
