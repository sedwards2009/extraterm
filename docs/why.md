---
title: Project Goals
description: or "Why bother at all?"
---


This project didn't start out as some big plan to build a new cross platform terminal emulator with some crazy features. It initially grew out of two things: 1) a desire to mess around with node-webkit and all of the new web APIs, and 2) a need for a better terminal emulator which worked on cygwin, something that was even half as good as KDE's Konsole on Linux.

As the code started to move along and began to work, I also started to look closer at how I was using the command line and what kind of new features I would find useful. A lot of common repetitive tasks we all do in a terminal seemed to me to be needlessly difficult, and the terminal does little to help. It is far too busy pretending to be an old green screen complete with attached dot matrix printer and spool of paper. It is a system that deals in text but doesn't let you actually do anything with the text. (No, being able to select text and copy it to the clipboard is not enough.) Terminals are terrible at doing text.

These are the two main goals now:

* Build a solid cross platform terminal emulator.
* Let me do my work in the terminal better, faster and easier than before.

It should do the standard features that we all expect well, and secondly it should try out new ways of doing things. Yes, a lot of these new features will be failed experiments. If something doesn't work then we can rip it out again. At the time of writing this text there are already a bunch of failed experiments buried deep in the git history.


# Some (rough) Design Principles


These are some of the basic principles and guidelines governing the design of Extraterm:

* Backwards compatibility with existing terminal based programs is a must. A terminal that doesn't work with terminal software is a dead duck.
* Backwards compatibility with our decades old terminal habits is highly desirable. No one should have to change any habits if they don't want to. People can incorporate new features into their work flow when they are ready.
* At the very least do text better than before. (Look at text editors for inspiration)
* Aim for tools and features which combine with each other.
* Support ad hoc interactive work flows. There is more than one way of doing it.
* Make things fast and immediate. It should be interactive.
* Take advantage of the structure in the data. For example, a shell session has a clear structure of enter command, run command, get output. It is not just dumb text. It means something to the user. Many pieces of data we use in a terminal are not just text but have structure which could be better presented. For example, many files in a Linux system are little databases with their own structure, many text based file formats are mark up or trees etc.

-- Simon Edwards, 2016
