Development
===========

First: One Simple Rule
----------------------
A simple ground rule: Extraterm is intended to be an open source *project*, and not just open source *code*. This means that all contributors need to be able get along together and cooperate on a basic level in a productive and civil way.


Technology
----------
Extraterm is build on the following technologies:

* [Electron](http://electron.atom.io/) - A platform for running desktop applications made using web technologies.
* [TypeScript](http://www.typescriptlang.org) - superset of JavaScript which adds static typing.
* [CodeMirror](http://electron.atom.io/) - text editor component which is used extensively to show terminal output and provide cursor based selections and editing.
* [term.js](https://github.com/chjj/term.js) - Terminal emulator component, pulled into the Extraterm code base and heavily modified.
* [pty.js](https://github.com/chjj/pty.js) - PTY support for node.js.
* … plus many other smaller libraries.

Thanks go out to the people and organisations responsible for the great software and tools I've been able to build on.


Running from Source
-------------------
Getting started from source:

* Clone the repository from github to your local machine.
* Make sure that you are using node version 5.1.1. :warning: This is important. Using the same node version as the version of Electron simplifies installation of the one native node module that Extraterm depends on (pty.js). You can fetch it from https://nodejs.org/dist/v5.1.1/
* Install the modules: `npm install` (pty.js will not install on cygwin, but that is ok and expected.)
* Build it: `npm run build`
* Run it: `npm run run`

If you are using Atom as your editor, then it will quickly and automatically compile the TS files for you. You can usually skip the manual build step during most development.


Submitting Changes
------------------
* Bugs and features requests go in the github issue tracker.
* Use Pull Requests to submit changes.
* Discuss large changes via an issue in the tracker before hand.

Regular good contributors will be given direct access to the repo. I want to get the bus factor for this project above 1.


Code Formatting
---------------
The basic rule is just follow the formatting already being used in existing code. Sorry, it is not as consistent as it should be.

* Indents are 2 spaces.
* semi-colons are required.
* Use exact comparisons, `===` and `!==`.
* Prefer `null` over `undefined`.
* Be explicit about showing what the code means. No cute shortcuts.


Road Map
--------

These are the features which are with in the scope of this project. (Shown in no particular order)

* General text handling
  * [x] Editable in-place text
  * [ ] Zoom
  * [ ] Find functionality and highlighting
    * [ ] Multiple highlights
  * [ ] Snapshot the contents of the current terminal into a new tab
  * [ ] Special paste. Paste text with different encodings, i.e. escape shell characters.
  * [ ] Insert symbol (unicode character)
* Shell integration
  * [x] Show the success or failure status of commands
  * [ ] Report command activity in the tab title (i.e. a spinner if a command is running, or a checkmark or X cross)
  * [ ] Record the start and end time of commands and make it available via the frame title bar
  * [ ] Easier way of setting the Extraterm env cookie on remote ssh session
  * [ ] Directory history navigation from a pop up list
  * [ ] Previous command selection from a pop up list
* UI
  * [ ] Theming
  * [ ] Shortcut customisation
* Tab management
  * [x] Vertical split
  * [ ] Tab renaming
  * [ ] Reorder tabs
  * [ ] Move tabs between splits
  * [ ] Multiple vertical and horizontal splits
* Scrollbar Mini-map
  * [ ] Displays different command output areas
  * [ ] Displays a representation of the textual contents
  * [ ] Displays the results of the find functionality
* `from` command:
  * [ ] Robust and graceful handling of Ctrl+C termination
  * [ ] Can select a range of lines from the target frame. i.e. `from 12:3-5`
  * Allows different output encoding options:
    * [ ] escape shell characters
    * [ ] escape HTML
    * [ ] escape XML
* `show` command:
  * [ ] Option to manually specify the mime type
  * [ ] Can read data from stdin
  * [ ] Can guess the mimetype from the input stream data
* Data viewers / frames
  * [ ] Open content in external program
  * [ ] Save to file
  * Text / terminal output viewer
    * [ ] Line numbers
    * [ ] Select syntax highlighting
    * [ ] Pull in content after editing it in an external editor
    * [ ] Sorting
    * [ ] Easier column selections and editing
    * Command to apply encoding / decoding
      * [ ] Shell character escaping
  * Image viewer
    * [ ] Zoom control
    * [ ] Image info
    * [ ] Frameless inline images
  * HTML viewer foundation ([ProseMirror](http://prosemirror.net/) integration)
    * [ ] Markdown viewer
    * [ ] Rich text viewer (.rtf)
  * [ ] JSON viewer
  * [ ] Spreadsheet / tabular data viewer
    * [ ] Integration with the `from` command
  * [ ] Plugin system for viewers
* [ ] Upload files
* [ ] Download files
  * [ ] Show progress bar
  * [ ] Allow canceling of a download
* [ ] Diff the contents to two frames / tabs
  * [ ] Option to ignore the first n characters of each line (i.e. to skip logging timestamps)
