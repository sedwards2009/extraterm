Updating the Electron version
-----------------------------
The Electron version used by Extraterm can be tricky to update due to the native modules which Extraterm depends on. Binary modules for Node often don't work directly on the matching version of Electron due to differences in the version of V8 used in both.  Yes, this is still a problem even when Node and the version of Node inside Electron are meant to be the same.

Copies of the native modules for each of the supported platforms are kept in git inside `src/build_scripts` directory. This makes it possible and easy to produce packaged versions for release for all platforms using one command. But it does mean that they have to be updated at the same time as Electron is updated.

The major steps that need to be done are detailed here below:


Updating Electron itself
------------------------

* Install the version of node which matches the version used by the version of Electron you are moving to. `node -v` should show the new version number.
* Bump the version of Electron in `package.json`. Consider bumping the version of `electron-rebuild` and `electron-packager` too.
* `npm install electron`
* (Linux, OSX) `node node_modules/electron-rebuild/lib/cli.js -f` -- This rebuilds any native module against the new Electron version and makes it ready for local development.
* (Windwos) `src\build_scripts\rebuild_mods_windows.bat` -- This is the same as above, but for Windows.
* Commit the changed `package.json` to git.


Updating the node-sass modules
------------------------------
[node-sass](https://github.com/sass/node-sass/]) doesn't offically support Electron, so we have to trick it a bit and rebuild its native module ourselves. This have to be done on every platform Extraterm supports.

Do this first:

* Update the version number which appears at the top of the `thememanager.ts` in var `MODULE_VERSION`.

Note: If using Windows, first make sure that the MSVC compile is set up and ready to run. This article explains where to download just the compiler https://msdn.microsoft.com/en-us/library/ms235639.aspx . Once the compiler is installed, you need to set up the environment before it will run. This is typically a case of running `"c:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\vcvarsall.bat" amd64`.

Note: The `python` executable should be Python 2.7, otherwise the gyp build system will stop and complain.

Outside the Extraterm source tree, find some space and do:

* `git clone --recursive https://github.com/sass/node-sass.git`
* `cd node-sass`
* `git submodule update --init --recursive`
* `npm install`
* `./node_modules/node-gyp/bin/node-gyp.js rebuild --target=1.3.4 --arch=x64 --dist-url=https://atom.io/download/atom-shell --verbose --libsass_ext= --libsass_cflags= --libsass_ldflags= --libsass_library=` -- target should match the new Electron version!
* Create a directory in Extraterm's `src/node-sass-binary` to match the new platform and node module version. e.g. `linux-x64-50`, 50 is the module version in this example. This is where the native module will go.
* Copy from node-sass `build/Release/binding.node` to the new directory in Extraterm's source.
* Commit the module to git.

Once this procedure has been done on all platforms, you can remove the old node-sass binaries.

For more background info see https://github.com/sass/node-sass/issues/1682


Updating the native modules in `src/build_scripts`
--------------------------------------------------
This has to be done on each of the supported platforms.

* `cd src/build_scripts`
* `git rm node_modules-linux-x64`  -- remove the module dir which matches your the platform.
* `node create_native_modules_dir.js`
* `git add node_modules-linux-x64`
* Commit the newly update modules to git.
