Updating the Electron version
-----------------------------
The Electron version used by Extraterm can be tricky to update due to the native modules which Extraterm depends on. Binary modules for Node often don't work directly on the matching version of Electron due to differences in the version of V8 used in both.  Yes, this is still a problem even when Node and the version of Node inside Electron are meant to be the same.

Copies of the native modules for each of the supported platforms are kept in git inside `build_scripts` directory. This makes it possible and easy to produce packaged versions for release for all platforms using one command. But it does mean that they have to be updated at the same time as Electron is updated.

The major steps that need to be done are detailed here below:


Updating Electron itself
------------------------

* Install the version of node which matches the version used by the version of Electron you are moving to. `node -v` should show the new version number. Note that you may have to reinstall any globally installed node based utilities such as `yarn` and `wsrun`.
* Bump the version of Electron in `package.json`. Consider bumping the version of `electron-rebuild` and `electron-packager` too.
* Update the version specified for electron in the "electron-rebuild" script definition inside the root `package.json`.
* Delete the `node_modules` directory.
* `yarn install`
* (Linux, OSX) `yarn run electron-rebuild` -- This rebuilds any native module against the new Electron version and makes it ready for local development. If this fails then you may have to update any references to `node-abi` in the `package.json` files to a later version to force in an up to date version.
* (Windows) `build_scripts\rebuild_mods_windows.bat` -- This is the same as above, but for Windows. You will have to update the Electron version inside this `.bat` file.
* Commit the changed `package.json` to git.


Updating the node-sass modules
------------------------------
[node-sass](https://github.com/sass/node-sass/]) doesn't offically support Electron, and quite often we have to trick it a bit and rebuild its native module ourselves. If the V8 module version of Electron matches its Node version's V8 module version, then this procedure can be skipped(!) It depends on whether you get modules version errors from node-sass when starting up Extraterm.

Rebuilding node-sass has to be done on every platform Extraterm supports.

Do this first:

* Update the module version number which appears at the top of the `ThemeManager.ts` in var `MODULE_VERSION`. This should be the module version number as used by the new Electron version.

Note: If using Windows, first make sure that the MSVC compile is set up and ready to run. This article explains where to download just the compiler https://msdn.microsoft.com/en-us/library/ms235639.aspx . Once the compiler is installed, you need to set up the environment before it will run. This is typically a case of running `"c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat" amd64`.

Note: The `python` executable should be Python 2.7, otherwise the gyp build system will stop and complain.

For the Linux 64bit platform see the instructions in `docker` directory for further instructions on building the binary module.

Outside the Extraterm source tree, find some space and do:

* `git clone --recursive https://github.com/sass/node-sass.git`
* `cd node-sass`
* `git checkout v4.9.0` -- this should match the desired version of node-sass
* `git submodule update --init --recursive`
* `npm install`
* `node ./node_modules/node-gyp/bin/node-gyp.js rebuild --target=5.0.6 --arch=x64 --dist-url=https://atom.io/download/atom-shell --verbose --libsass_ext= --libsass_cflags= --libsass_ldflags= --libsass_library=` -- The `--target` option should match the new Electron version!

Now that it has been built it needs to be moved to the right location in the source tree.

* Create a directory in Extraterm's `extraterm/resources/node-sass-binary` to match the new platform and node module version. e.g. `linux-x64-57`, 57 is the module version in this example. This is where the native module will go.
* Copy from node-sass `build/Release/binding.node` to the new directory in Extraterm's source.
* Commit the module to git.

Once this procedure has been done on all platforms, you can remove the old node-sass binaries.

For more background info see https://github.com/sass/node-sass/issues/1682


Updating the native modules in `build_scripts`
--------------------------------------------------
This has to be done on each of the supported platforms.

* `cd build_scripts`
* `git rm -r node_modules-linux-x64`  -- remove the module directory which matches your platform.
* `node create_native_modules_dir.js`
* `git add node_modules-linux-x64`
* Commit the newly update modules to git.
