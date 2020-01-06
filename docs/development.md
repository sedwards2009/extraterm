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
* [term.js](https://github.com/chjj/term.js) - Terminal emulator component, pulled into the Extraterm code base and heavily modified.
* [node-pty](https://github.com/Microsoft/node-pty) - PTY support for node.js.
* [Ace editor](https://ace.c9.io/) - A fork of the Ace editor is using inside Extraterm. It has mostly been converted to TypeScript and modified to suit Extraterm. The fork is [here](https://github.com/sedwards2009/ace-ts).
* … plus many other smaller libraries.

Thanks go out to the people and organisations responsible for the great software and tools I've been able to build on.


# Running from Source

Getting started from source:

Note: Run these commands from a terminal which *isn't* Extraterm < v0.30.0. (An environment variable is set inside every extraterm session which confuses `node-sass` when building from source, namely in the `yarn install` step. This problem is fixed in Extraterm 0.30.0 though.)

Extraterm uses [yarn](http://yarnpkg.com/) for package management. It is easiest to have it available in your path or just globally. Ensure you have a recent version (1.12 or later).

Extraterm also uses a couple of native code based modules. To successfully install these you first need to have a suitable compiler installed:

* **Linux** - A recent GCC C/C++ compiler is enough. If you are on Debian based Linux distribution then installing the `build-essential` package will pull in the right build tools.
* **macOS** - Make sure you have the Xcode compilers installed.
* **Windows** - Microsoft's C/C++ compilers need to be installed. The easiest solution is to go to [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) and follow the directions there to easily download and install the needed tools. Also the [Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-10-sdk) needs to be installed. It can be downloaded from the link or if you are using [Chocolately](http://chocolatey.org/) to install software then this command will install it: `choco install windows-sdk-10-version-1803-all`


Once the requirements above are in place, execute these steps:

* Clone the repository from github to your local machine.
* Use node version 12.8.1.
* Install the modules: `yarn install`.
* Fix up the binary modules to work inside Electron: `yarn run electron-rebuild` or if you are on Windows `yarn run electron-rebuild-win32`
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

* [Development Roadmap](https://github.com/sedwards2009/extraterm/issues/30)
* [News section up on extraterm.org](http://extraterm.org/news.html)
