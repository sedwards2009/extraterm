# node-pty

[![Build Status](https://dev.azure.com/vscode/node-pty/_apis/build/status/Microsoft.node-pty)](https://dev.azure.com/vscode/node-pty/_apis/build/status/Microsoft.node-pty?branchName=master)

`forkpty(3)` bindings for node.js. This allows you to fork processes with pseudoterminal file descriptors. It returns a terminal object which allows reads and writes.

This is useful for:

- Writing a terminal emulator (eg. via [xterm.js](https://github.com/sourcelair/xterm.js)).
- Getting certain programs to *think* you're a terminal, such as when you need a program to send you control sequences.

`node-pty` supports Linux, macOS and Windows. Windows support is possible by utilizing the [Windows conpty API](https://blogs.msdn.microsoft.com/commandline/2018/08/02/windows-command-line-introducing-the-windows-pseudo-console-conpty/) on Windows 1809+ and the [winpty](https://github.com/rprichard/winpty) library in older version.

## Real-world Uses

`node-pty` powers many different terminal emulators, including:

- [Microsoft Visual Studio Code](https://code.visualstudio.com)
- [Hyper](https://hyper.is/)
- [Upterm](https://github.com/railsware/upterm)
- [Script Runner](https://github.com/ioquatix/script-runner) for Atom.
- [Theia](https://github.com/theia-ide/theia)
- [FreeMAN](https://github.com/matthew-matvei/freeman) file manager
- [atom-xterm](https://atom.io/packages/atom-xterm) - Atom plugin for providing terminals inside your Atom workspace.
- [Termination](https://atom.io/packages/termination) - Another Atom plugin that provides terminals inside your Atom workspace.

Do you use node-pty in your application as well? Please open a [Pull Request](https://github.com/Tyriar/node-pty/pulls) to include it here. We would love to have it in our list.

## Example Usage

```js
var os = require('os');
var pty = require('node-pty');

var shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

var ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env
});

ptyProcess.on('data', function(data) {
  process.stdout.write(data);
});

ptyProcess.write('ls\r');
ptyProcess.resize(100, 40);
ptyProcess.write('ls\r');
```

## Building

```bash
# Install dependencies and build C++
npm install
# Compile TypeScript -> JavaScript
npm run tsc
```

## Dependencies

### Linux/Ubuntu

```
sudo apt install -y make python build-essential
```

### Windows

`npm install` requires some tools to be present in the system like Python and C++ compiler. Windows users can easily install them by running the following command in PowerShell as administrator. For more information see https://github.com/felixrieseberg/windows-build-tools:

```sh
npm install --global --production windows-build-tools
```

The Windows SDK is also needed which can be [downloaded here](https://developer.microsoft.com/en-us/windows/downloads/windows-10-sdk). Only the "Desktop C++ Apps" components are needed to be installed.

## Debugging

[The wiki](https://github.com/Microsoft/node-pty/wiki/Debugging) contains instructions for debugging node-pty.

## Security

All processes launched from node-pty will launch at the same permission level of the parent process. Take care particularly when using node-pty inside a server that's accessible on the internet. We recommend launching the pty inside a container to protect your host machine.

## Thread Safety

Note that node-pty is not thread safe so running it across multiple worker threads in node.js could cause issues.

## Troubleshooting

**Powershell gives error 8009001d**

> Internal Windows PowerShell error.  Loading managed Windows PowerShell failed with error 8009001d.

This happens when PowerShell is launched with no `SystemRoot` environment variable present.

## pty.js

This project is forked from [chjj/pty.js](https://github.com/chjj/pty.js) with the primary goals being to provide better support for later Node.JS versions and Windows.

## License

Copyright (c) 2012-2015, Christopher Jeffrey (MIT License).<br>
Copyright (c) 2016, Daniel Imms (MIT License).<br>
Copyright (c) 2018, Microsoft Corporation (MIT License).
