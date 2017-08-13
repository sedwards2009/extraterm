---
title: Getting Started Guide
---

Getting Started
===============

Installation
------------
Extraterm support Linux, Mac OS X and Cygwin on Windows. Download the zip file for your operating system on the [github releases page](https://github.com/sedwards2009/extraterm/releases).

Unzip the file somewhere convenient.

Start Extraterm:

* **Linux** - Run the `extraterm` file inside the unzip directory.
* **Mac OS X** - Just start the application via the Finder.
* **Cygwin and Babun** - Double click to run the Extraterm application inside the unzip directory, or using the shell, execute the `extraterm` file inside the unzip directory. Note you must have Python 3 installed inside cygwin for Extraterm to run (see the [FAQ](faq.md) ). If you have trouble starting Extraterm on cygwin also consult the [FAQ](faq.md).

Extraterm doesn't need any further installation.


Basics
------
When Extraterm starts it opens one tab and runs your default shell inside it. The basic functioning of the terminal should feel quite familiar. You a non-blinking block cursor.

The plus sign next to the tab at the top of the window opens a new tab (shortcut `Ctrl+Shift+T`). Close a tab by using the little cross icon/button on the right side of the tab, or just exist the shell. `Ctrl+Shift+Q` is the shortcut for closing a tab directly.

Use the `Ctrl+,` and `Ctrl+.` shortcuts to move between tabs.

Selections can be made with the mouse and are automatically copied to the system clipboard. `Ctrl+Shift+C` will also copy a selection. `Ctrl+Shift+V` or the middle mouse button pastes the contents of the clipboard.

With `Shift+PageUp` and `Shift+PageDown` you can scroll through and view previous output which has scrolled out of view.


Cursor mode
-----------
Extraterm features a cursor mode where you can navigate the screen and scrollback contents and select text in the terminal without having to reach for the mouse.

To go into cursor mode press `Ctrl+Shift+Space`. The block cursor will remain in place but there will also be a blinking vertical bar cursor. This is Extraterm's cursor mode cursor. It works the same as the cursor in a typical desktop text editor. Cursor keys work the same and `shift` + cursor creates selections. 
`Ctrl+Shift+C` (or just `Ctrl+C`) copies the selection to the clipboard. The cursor can be placed using the mouse. When in cursor mode no keyboard input is sent to your shell.

The `Ctrl+Shift+Space` shortcut acts as a toggle between cursor mode and normal terminal mode. Press it again to go back to terminal mode.

See [Executing Commands from Cursor Mode](#executing-commands-from-cursor-mode) also.


Shell Integration
-----------------
Extraterm becomes a lot more useful once the shell integration has been set up. Currently the three major shells, bash, zshell and fish are supported.

Go to the [github releases page](https://github.com/sedwards2009/extraterm/releases) and download the `extraterms-commands` zip file. Unzip this file somewhere. Inside are a number of scripts called `setup_extraterm...`. Use your shell's source command to read the script which matches your shell.

Read the script matches your shell using the `.` (source) built in command. For example: bash shell would use `. setup_extraterm_bash.sh` to read the script. The other shells use the same syntax.

Ideally you would read the `setup_extraterm...` script as part of your login scripts.

The shell integration does a couple of things:

* hooks into your shell to report commands invocations to Extraterm.
* hooks into your shell to report the result of command invocations.
* puts two useful commands in your path: `show` and `from`.

When you run a command in your shell, Extraterm can now place a 'frame' around the output of the command. This frame is decorated with the name of the command, an indication of whether it returned a successful zero return code, and also some other controls.

![Command frames in action](command_frames.png)

Successful commands are shown with a green check mark on a blue background. Failed commands are shown with a red background to get your attention.

When scrolling back through long stretches of command output, the frame's title bar will remain visible so that you know what you are looking at.

The cross icon in the frame title simply deletes the command output. The 'pop out' icon moves the output into its own tab for safe keeping.

The framing behaviour can be configured in the Setting tab, accessible from the drop down menu located at the 'burger' menu in the top right corner of the main window. By default a number of common unix commands which don't produce output are configured to not be framed.

In the future more shortcuts and features will be added to make more use of this framing and shell integration.


The 'show' Command
------------------
The shell integration adds a pair of new Extraterm specific commands to your shell. The `show` command is a general tool for showing the contents of a file inside the terminal. Currently it supports showing and highlighting many programming languages and mark up languages. It can also show the most common image formats directly in the terminal.

In the future this tool and the support needed in Extraterm itself will be expanded to support other file formats.


The 'from' Command
------------------
The `from` command is lets you use previous command output as input to a new command. Each command frame has a little tag icon in the title bar with a number. By running the `from` command with the number of the frame you want as its argument you can get the contents of that frame.

For example:

![From command](from_command.png)

This example is somewhat artificial but it does show the basic use of `from`.

The `from` command isn't limited to read command output from the same terminal session or tab. It can read from any other tab. The command output doesn't have to be from a command on the same machine. It could be from a command on the other side of a ssh session.

The `from` command becomes a lot more useful when you first edit the content of a frame in place to isolate the text you want. The content of frames can be edited when in the selection mode.

For example, I've run `git status` and have a couple of changes. I want to know how many words long the documents I have been working on are, but I'm not interested in the .ts ones. This is the situation after `git status`:

![git status](from_git_1.png)

Now I can go into selection mode and cut away the parts of the text I don't need and pull it into my pipe line.

![git status](from_git_2.png)

With a shell pipe and `xargs` I can give the list of documents to the `wc` (word count) command:


Executing Commands from Cursor Mode
-----------------------------------
Command output in a frame can be edited directly. Extraterm also has some shortcuts to make this capability even more useful.

* `Ctrl+Enter` will type the currently selected text into the shell.
* `Ctrl+Shift+Enter` will type the currently select text into the shell and press the enter key. Effectively it executes the selection in the shell. Use with care.



Tips
====

See the [FAQ](faq.md) too

Keyboard Shortcuts
------------------
The list of available keyboard short cuts can be seen on the 'Key Bindings' tab which is accessible via the "hamburger
menu" in the top right corner of the window.


Terminal Tabs
-------------
Terminals are shown inside tabs. New tabs can be created by clicking on the + (plus) icon at the top.

The "Split" option on the application menu can be selected to split the window into to two groups of side-by-side tabs.

Shortcuts:

* `Ctrl+Tab` to switch between panes.
* `Ctrl+Shift+S` Split/unsplit the view into 2 side-by-side panes.

Tip: Turning off split view is a fast way of giving a terminal tab more space. When you split the view again, Extraterm will remember and restore the previous configuration.


Mouse selections when an app grabs the mouse
--------------------------------------------
Some applications use the mouse input themselves and prevent normal mouse selection from working. In these cases it is possible to hold the Control key and then make a selection with the mouse.

