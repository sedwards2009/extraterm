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

* `command` the full name of the command including the name of the extension it is from.
* `title` the human readable title or name of the command.
* `category` the category to group this command belongs to in the keybindings settings.
* `order` number used to sort and order this command in the UI relative to other command which share the same category.
* `when` a *when clause* which specifies when this command is available.
* `icon`


Example:

    "contributes": {
      "commands": [
        {
          "command": "my-extension:someCommand",
          "title": "Some Command",
          "when": "..."
          "category": "",
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
* `textEditing`
* `terminal`
* `terminalCursorMode`
* `viewer`

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

