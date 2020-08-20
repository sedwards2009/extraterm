Updating Electron
-----------------

The Electron version used by Extraterm can be tricky to update due to the native modules which Extraterm depends on. First 
make sure that any native modules (i.e. node-pty) are compatibly with the target Electron version.

Steps:

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


Updating Twemoji
----------------

Twemoji doesn't directly publish their emoji in color TTF form. Instead we pull a TTF file out of the Twemoji package in Fedora. The `download_twemoji_ttf.sh` script in `build_scripts/twemoji` can be run to grab the lastest version of this package and to extract the TTF file and copy it locally to the folder. From here it can be placed in `extraterm/resources/themes/default/fonts/`.

The list of code points for which Twemoji is used is defined inside `CanvasTextLayer.ts` (see variable `twemojiCodePoints`). After updating Twemoji, edit the `TAG` variable inside the script `compute_twemoji_codepoints.js` in `build_scripts/twemoji` to the new version of Twemoji. Run the script to get the list of supported code points for that tag. Update the list in `CanvasTextLayer.ts`.
