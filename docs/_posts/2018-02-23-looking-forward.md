---
title: Looking Forward
date: 2018-02-23 21:30:00 +0100
categories: blog
---

In my [last post](http://extraterm.org/blog/2018/02/16/looking-back-at-the-last-few-months.html) I talked about what happened in the last quarter of a year of development. Now it is time to pause for a moment and take a broader view of where the project is and which features and functionality we might want to add next.

This is what the feature landscape up ahead looks like. Note that these are just things that I **could** add to Extraterm, not **will** add.

* Better performance, more speed, lower memory use
* Improved documentation
* Refine and expand the existing content viewers
* Autocomplete and content aware autocomplete
* Further develop the extension API
    * Add an Extensions tab for managing extensions
    * Support viewers in extensions
    * Make the VT escape sequence mechanism extensible
    * Support configuration tabs for extensions
    * Expand the API available to extensions
    * Support the user in building and installing extensions
* Add a video viewer
* Add an audio viewer
* Minimap - add a minimap of the screen and scrollback to the side of each terminal tab
* Search & Highlight
* Expand the text editing capabilities
* Multiple windows
* Option to collapse/fold a frame into just the title bar.
* Transparent local editing of remote files. Download, edit then upload remote files.
* A status bar which can be updated from the shell. (i.e. show git status at the bottom of the terminal)
* [Wrapped row reflow](https://github.com/sedwards2009/extraterm/issues/69)
* Support directly downloading and opening files in a local viewer
* Support different terminal colour theme file formats
* Some style options for the cursor might be nice
* Configuration options for the terminal tab titles
* Notifications for when long running commands finished or when a specific string appears in output. e.g. "Error".
* [Add a way of opening a new tab from the command line](https://github.com/sedwards2009/extraterm/issues/64)
* Add extra metadata to command frames. e.g. current directory, git status, environment, start time, end time.
* Hyperlink support
* Support for hyperlinks in text using an escape sequence (OSC 8) like iTerm2.
* [Bracketed paste](https://cirw.in/blog/bracketed-paste)
* Support 24bit colour text
* Support italic text
* Ligature font support
* Support for icons in the unicode private use area. Enables [things like this](https://github.com/illinoisjackson/even-better-ls)
* Configuration for per command display settings. e.g. you may want to hide a frame of gcc output if success was reported.
* Smarter way of pasting multiple lines in a shell.
* Global hotkeys
* Configurable sessions. e.g. fish session, bash session, or ssh direct to a server session.
* Support for cmd sessions on Windows
* Support "Windows subsystem for Linux" on Windows
* Add direct support for [SSH](https://github.com/mscdex/ssh2). i.e. make Extraterm a viable SSH client.
* Ability to decorate and replace the output of commands with possibly HTML/rich text or a custom viewer.
* Functionality to show data/URLs in the terminal as QR Codes.
* Support "SetUserVar" escape sequence, expose it to extensions.
* Make it possible to add "folds" to the output of noisy commands. i.e. build output could be folded at every phase or subproject of the build process.
* Insert (unicode) symbol functionality
* Add a special input mode where complete commands are prepared on the terminal side before being sent. This is useful for dealing with broken CLIs or when talking directly to a HTTP server via telnet.
* In-app scripting and macros

This list isn't complete. If you dear reader have any opinions about what you would like to see then open an (issue up on github)[https://github.com/sedwards2009/extraterm/issues] and let me know. Personally, I really want to have the things up to and including "Search & Highlight" in the list above.


Displaying Text
===============

After the big delay between version 0.29 and the recent 0.30, I'm keen to move towards a period of smaller features, bug fixes, refinement and regular releases. But at the same time I have to admit that I see far too many glitches, flickering and rendering problems in the base terminal functionality of displaying text. The worst problems seem to be related to non-latin scripts, but even excluding these I still see flickering too often. It looks bad and subtly undermines people's confidence in the whole product. The primary cause is how I've stuffed CodeMirror into a role it wasn't designed or optimised to do. I've spent a lot time fighting CodeMirror and how it renders its contents. Ideally I would like to have control over how exactly text is rendered on the screen. Then I can optimised it for the kind of work and requirements needed by a terminal.

There appears to be a path to get there and it involves replacing CodeMirror with an alternate text editor. Specifically I'm looking at [Ace](https://ace.c9.io/). It is very similar in functionality to CodeMirror and although I might be exchanging a set of CodeMirror problems for a set of different unknown problems, the big advantage of Ace is that it supports replacing the text renderer with a different implementation.

This also means that any features on the list above which touch the rendering or the text viewer need to wait until the switch is complete. There is no point in building features on top of the wrong foundation only to have to rewrite it later.


Housekeeping and Modularity
===========================
Extraterm's code base has been growing steadily but needs another level of code organisation applied to keep it manageable. It needs to be more modular.

The foundation of an extension/plugin system already exists inside Extraterm. This needs to be expanded to support better modularity of the core Extraterm application, and then further developed into a general extension mechanism for others to use.

The next immediate step is to reshuffle of the source files once more and move towards replacing `npm` with `yarn` and its workspaces feature. Once this is done it will be easier to add code which can be separately built while still living in the same git repository.


The Road Forward
================
The current plan is to first do a bug fix release, 0.31. There already is enough stuff for a decent 0.31 version to be released in the next week. Then I want to do the transition to `yarn` and a "mono-repo" to support multiple subprojects. This is where it gets tricky. I think I'm going to do long term work on the transition to Ace and mix that up with smaller features and bug fixes so that people can get improved versions of Extraterm at regular intervals and to keep some momentum up.

Some of the smaller short term features I'm thinking of are:

* Viewer for video
* Viewer for audio
* Autocomplete
