---
title: Development and Contributing
---


Read the [Why document](why.md) to get an idea as to how I'm approaching this project.


# First: One Simple Rule

A simple ground rule: Extraterm is intended to be an open source *project*, and not just open source *code*. This means that all contributors need to be able get along together and cooperate on a basic level in a productive and civil way. If you can stick to this rule then you are welcome to this project.


# Technology

Extraterm is built on the following technologies:

* [Electron](http://electron.atom.io/) - A platform for running desktop applications made using web technologies.
* [TypeScript](http://www.typescriptlang.org) - superset of JavaScript which adds static typing.
* [CodeMirror](https://codemirror.net/) - text editor component which is used extensively to show terminal output and provide cursor based selections and editing.
* [term.js](https://github.com/chjj/term.js) - Terminal emulator component, pulled into the Extraterm code base and heavily modified.
* [ptyw.js](https://github.com/iiegor/ptyw.js) - PTY support for node.js.
* … plus many other smaller libraries.

Thanks go out to the people and organisations responsible for the great software and tools I've been able to build on.


# Running from Source

Getting started from source:

Note: Run these commands from a terminal which *isn't* Extraterm < v0.30.0. (An environment variable is set inside every extraterm session which confuses `node-sass` when building from source, namely in the `yarn install` step. This problem is fixed in Extraterm 0.30.0 though.)

Extraterm uses (yarn)[http://yarnpkg.com/] for package management. It is easiest to have it available in your path or just globally.

* Clone the repository from github to your local machine.
* Make sure that you are using node version 7.4.0. :warning: This is important. Using the same node version as the version of Electron simplifies installation of the one native node module that Extraterm depends on (pty.js). You can fetch it from https://nodejs.org/dist/v7.4.0/
* Install the modules: `yarn install` (pty.js will not install on cygwin, but that is ok and expected.)
* Fix up the binary modules to work inside Electron: `yarn run electron-rebuild`
* Build it: `yarn run build`
* Run it: `yarn run run`


# Code Layout

In the root of the git repository we have:
* `build_scripts` - Extra scripts used for building the software and creating packages.
* `docs` - Documentation and the contents of the website.
* `extensions` - Extensions/plugins which are loaded by Extraterm at start up.
* `extraterm` - The main application.
    * `resources` - Extra resource files which are need by the main application.
    * `src` - The source code of the main application.
* `packages` - Separate modules of code which are used by the main application and extensions but is otherwise independent.


# Submitting Changes

* Bugs and features requests go in the github issue tracker.
* Use Pull Requests to submit changes.
* Discuss large changes via an issue in the tracker before hand.

Regular good contributors will be given direct access to the repo. I want to get the bus factor for this project above 1.


# Code Formatting

The basic rule is just follow the formatting already being used in existing code. Sorry, it is not as consistent as it should be.

* Indents are 2 spaces.
* semi-colons are required.
* Use exact comparisons, `===` and `!==`.
* Prefer `null` over `undefined`.
* Be explicit about showing what the code means. No cute shortcuts.

# Updating the Version of Electron used

[See this document](how_to_update_electron.md)

# Road Map

Keep an eye on these places for information and speculation about future development:

* (Development Roadmap)[https://github.com/sedwards2009/extraterm/issues/30]
* (News section up on extraterm.org)[http://extraterm.org/news.html]
