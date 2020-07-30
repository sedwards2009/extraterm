Updating the Electron version
-----------------------------
The Electron version used by Extraterm can be tricky to update due to the native modules which Extraterm depends on. Binary modules for Node often don't work directly on the matching version of Electron due to differences in the version of V8 used in both.  Yes, this is still a problem even when Node and the version of Node inside Electron are meant to be the same.

The major steps that need to be done are detailed here below:


Updating Electron itself
------------------------

* Install the version of node which matches the version used by the version of Electron you are moving to. `node -v` should show the new version number. Note that you may have to reinstall any globally installed node based utilities such as `yarn` and `wsrun`.
* Bump the version of Electron in `package.json` in the project and also in `extraterm/package.json`.
* Consider bumping the version of `electron-rebuild` and `electron-packager` in `package.json` too.
* You may have to update the version of `node-pty` to match the electron version. The `node-pty` version is defined in the root `package.json` and also the `package.json` files under `extensions/UnixSessionBackend` and `extensions/WindowsConsoleSessionBackend`.
* Update the version specified for electron in the "electron-rebuild" script definition inside the root `package.json`.
* Delete the `node_modules` directory.
* `yarn install`
* (Linux, OSX) `yarn run electron-rebuild` -- This rebuilds any native module against the new Electron version and makes it ready for local development. If this fails then you may have to update any references to `node-abi` in the `package.json` files to a later version to force in an up to date version.
* (Windows) `yarn run electron-rebuild-win32` -- This is the Windows equivalent of the step above.
* Commit the changed `package.json` to git.
* Update node version references inside `.azure-pipelines.yml` .

If `electron-rebuild` fails with a "Could not detect abi for version 7.1.7 and runtime electron" message then it may be necessary to update the forced version of `node-abi` defined inside the root `package.json` under the `resolutions` and `dependencies` sections.

That's it.
