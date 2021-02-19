---
title: Extraterm v0.58.0 released
date: 2021-02-19 21:50:00 +0100
categories: release
---

Autocomplete is the big feature for this release. `Ctrl+;` or `Cmd+;` will open the autocomplete pop up at your cursor where you can quickly search and select a line of text to type directly into your terminal. The list of suggestions is filled by scanning the last two pages of text on the screen.

Searching in the autocomplete, command palette, and other lists of options has been improved too with "fuzzy matching". It finds the best match by matching in in a smarter way just like in text editors like Sublime Text and Visual Studio Code.


**Features**

* Autocomplete based on the screen contents. [#264](https://github.com/sedwards2009/extraterm/issues/264)
* Fuzzy matching in the command palette and related list pickers.
* Improved link detection in mark up. [#324](https://github.com/sedwards2009/extraterm/issues/324)


**Bug fixes**

* Auto-focus the empty pane menu after splitting. [#319](https://github.com/sedwards2009/extraterm/issues/319)
* Fix initial directory for Linux sessions. [#310](https://github.com/sedwards2009/extraterm/issues/310) [#327](https://github.com/sedwards2009/extraterm/issues/327)
* Fix rendering corruption when a huge number of colour/glyph combinations are used. [#323](https://github.com/sedwards2009/extraterm/issues/323)

**Changes**

* Rename the "Move Tab Left" etc commands to clearer "Move Tab to Pane Left" [#331](https://github.com/sedwards2009/extraterm/issues/331)
* The emoji picker opens up at the cursor position now.

Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.58.0)
