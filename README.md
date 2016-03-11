
Extraterm
=========
*The terminal with a lot extra*

### :star: **See the [Visual Tour](docs/tour.md)** :star:

:loudspeaker: Follow development on [Twitter @ ExtratermDev](https://twitter.com/ExtratermDev)


About
-----
Extraterm is an open source project to build a better modern terminal emulator but it is also a platform for experimentation with more radical features around command line based computer interaction.

The primary developer is Simon Edwards.


Status
------
:warning: Extraterm is very much in development and not suitable for production use. Use at your own risk. :warning:

With that out the way, the primary author does use it as their main terminal emulator. The basics are in place and it will run most common terminal applications such as vi, emacs and joe and even more demanding applications such as midnight commander. 

Current features:

* Supports Linux, Mac OS X and Cygwin on Windows
* xterm compatible
* Multiple tabs/terminals
* Keyboard based selection
* (Basic) vertical split
* Show images
* Shell integration; can isolate and 'frame' command output
* Previous command output can be used as input for new commands
* Command output is editable in place
* [MIT license](LICENSE.txt)


Guide
-----
A more detailed [guide is here](docs/guide.md)


Download
--------
Release downloads can be found on the [Releases Page](https://github.com/sedwards2009/extraterm/releases). Installation and instructions are in the [guide is here](docs/guide.md).


Development & Contributing
--------------------------



### Technology ###

Extraterm is build on the following technologies:

* [Electron](http://electron.atom.io/) - A platform for running desktop applications made using web technologies.
* [TypeScript](http://www.typescriptlang.org) - superset of JavaScript which adds static typing.
* [CodeMirror](http://electron.atom.io/) - text editor component which is used extensively to show terminal output and provide cursor based selections and editing.
* [term.js](https://github.com/chjj/term.js) - Terminal emulator component, pulled into the Extraterm code base and heavily modified.
* [pty.js](https://github.com/chjj/pty.js) - PTY support for node.js.
* … plus many other smaller libraries.

Thanks go out to the people and organisations responsible for the great software and tools I've been able to build on.


### Contributing ###

Some simple ground rules: Extraterm is intended to be an open source *project*, and not just open source *code*. This means people, people who can work together and cooperate in a productive and civil way. 

