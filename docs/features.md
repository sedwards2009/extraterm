---
title: Features
---
Extraterm is a open source terminal emulator which aims to add many new features to bring the traditional terminal into the modern era.

It is currently in steady development and although not at a 1.0 release yet, it is generally stable for everyday use provided you can tolerate the occasional bug. (Submit [bug reports here](https://github.com/sedwards2009/extraterm/issues) .)

Note: Many of these features are currently only present in the older Electron based version of Extraterm.


# Command Palette

Extraterm is designed for keyboard use first. The Command Palette makes it easy to find and execute any command without leaving the keyboard.

![Command palette](command_palette.png)


# Image Support

Extraterm supports directly viewing richer content than just text. Works across ssh too.

![Show image](show_image.png)


# Shell Integration

Use the shell integration to unlock Extraterm’s power.

Command output is clearly marked and return status of commands is clearly visible. Interesting command output can be put in its own tab, or just delete it directly. Bash, zshell and fish are currently supported. Extraterm features a powerful keyboard based cursor mode. Copy and paste without having to leave the keyboard.

![Extraterm keyboard cursor and selection](selection_mode2.gif)

# Reusing Command Output

The “from” command lets you use previous command output as input for terminal commands. This enables new fast "ad hoc" workflows.

![From command](from_command.gif)

Or you can edit the command output directly in place and execute the selection with `Ctrl+Shift+Enter`.

![Directly edit and execute command output](edit_direct.gif)


# Easy Downloads and Uploads

The shell integration makes uploading and downloading files easy without requiring additional tools. It works transparently across SSH too.

![Download](download.png)


# Compatible

Backwards compatibility with the decades of existing terminal based applications and your decades of workflows and habits is very important. Extraterm supports your existing applications and doesn't require you to change your habits.

![Extraterm in action](action2.gif)
