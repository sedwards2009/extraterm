---
title: Developing Extensions
---

# Introduction

Extraterm's extension API allows many parts of the core application to be expanded with new capabilities. Many features which appear to be built in are in fact implemented using the extension API.

Extensions can for example:

* Add new pieces of user interface around a terminal. The "Edit Title" and "Find" feature are examples of built in extensions which extend the user interface.
* Provide new terminal and syntax highlighting themes.
* Add commands to the command palette.
* Add viewers for previewing different types of content inside a terminal session. The audio file preview is a built in extension which does this.
* Add new keybindings.
* Add new terminal session types. Unix sessions, Windows console, and WSL session types are all implemented as extensions.

Extraterm is built on top of the [Electron](https://www.electronjs.org) platform. Extensions can be built using the extensions API and also many of the web technologies provided by the underlying platform. Extraterm itself is written in TypeScript and directly supports extension development using TypeScript. This is not mandatory though, plain JavaScript or any language which compiles to JavaScript can be used for creating extensions. The cross platform nature of Electron and these web technologies, makes it easy to create extensions which work on all of the operating systems that Extraterm does.


# Documentation Overview

Your First Extension

Guides

* [Extension API Reference](extension_api/)
