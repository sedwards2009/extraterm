---
title: Contribution points and package.json
---

# Contribution points and package.json

This guide is a detailed look at how extensions can extend Extraterm via so called "contribution points" which are defined in the extension's `package.json` file.


## Contribution Points

Extensions declare how they extend Extraterm by specifying *contribution points* in their `package.json`. The following types of contribution points can be specified under the `contributes` field:

* `commands`
* `viewers`
* `terminalBorderWidget`
* `menus`
* `sessionEditors`
* `sessionBackends`
* `syntaxThemes`
* `syntaxThemeProviders`
* `terminalThemes`
* `terminalThemeProviders`



### Commands

The `commands` field in `package.json` is a list of commands with the following structure:

* `command`  - full name of the command including the name of the extension it is from.
* `title`  - human readable title or name of the command.
* `category`  - category to group this command belongs to in the keybindings settings tab.
* `order` - number used to sort and order this command in the UI relative to other command which share the same category.
* `when` - a *when clause* which specifies when this command is available. See below.
* `icon` - the name of a Font Awesome icon to show next to this command in the Command Palette and in other menus.  See below.


Example:

    "contributes": {
      "commands": [
        {
          "command": "my-extension:someCommand",
          "title": "Some Command",
          "when": "..."
          "category": "terminal",
          "order": 2000,
          "contextMenu": true
        }
      ]
    }


#### when clauses

A when clause is a boolean expression which determines whether a command is available.

The following language features are supported:

* `true` - true value
* `false` - false value
* `&&` - logical and
* `||` - logical or
* `!` - logical not
* `(` `)` bracket for grouping

The following variables are available to use and test:

* `terminalFocus` **boolean** True if a terminal has focus.
* `viewerFocus` **boolean** True if a viewer has focus.
* `viewerType` **string** == "image-viewer"
* `textEditorFocus` **boolean** True if a text editor has focus. (May still be read-only).
* `isCursorMode` **boolean** True if the focussed terminal is in cursor mode.
* `isNormalMode` **boolean** True if the focussed terminal is in normal mode.
* `isTextEditing` **boolean** True if the focussed text editor is editable.


#### Categories

The following categories are defined:

* `global` - Commands which are available system wide, even when Extraterm is not focussed.
* `window` - Command which operate at the window level.
* `textEditing` - Commands related to editing text directly inside Extraterm.
* `terminal` - Commands directly affecting the terminal.
* `terminalCursorMode` - Commands relevant to the terminal when in cursor mode.
* `viewer` - Commands for operating on viewers.


#### Icons

Extraterm uses icons from [Font Awesome](https://fontawesome.com/) in its menus and in other place through out the application. When an icon needs to be specified use the HTML class value as shown on each icon detail page.

For example, use the value `fas fa-baby` from the[ baby](https://fontawesome.com/icons/baby?style=solid) icon. It is shown just above the large graphic of the icon.

Only icons in the 'free' collection are available in Extraterm.


### Viewers

Example:

    "contributes": {
      "viewers": [
        "name": "VorbisAudioViewer",
        "mimeTypes": [
          "audio/vorbis"
        ],
        "css": {
          "directory": "resources/sass",
          "cssFile": [
            "audio-viewer.scss"
          ],
          "fontAwesome": true
        }
      ]
    }

### Terminal Border Widget

* `name`
* `border` - One of `north`, `south`, `east` or `west`.
* `css`

