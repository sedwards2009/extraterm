---
title: Extraterm v0.46.0 released
date: 2019-10-11 16:55:00 +0200
categories: release
---

The options for framing command output using the shell integration now support framing only when command output is longer than some line of lines.

People who have been seeing strange drawing problems and/or incorrect background colors can now try the "Reduce graphic effects" option in the General tab in the settings. This changes how the text selection and some other aspects are done and tries to avoid some CSS features which appear to have trouble with certain GPU and driver combinations.


New features:

* Option to frame output if it is longer than some amount of lines. [issue #194](https://github.com/sedwards2009/extraterm/issues/194)

Bug fixes:

* Fix bug where rubbish characters can remain on the far right side of the terminal area after resizing the window.

Changes:

* Added option for reducing graphics effects which trigger buggy drawing in some GPU and driver combinations. [issue #209](https://github.com/sedwards2009/extraterm/issues/209)


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.46.0)
