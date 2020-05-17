Extraterm Extension API
=======================

This module holds the TypeScript definitions of the Extraterm extension API and is published as a packge up on npmjs.com.

https://github.com/sedwards2009/extraterm

Publishing API package
----------------------

When this API changes it needs to be published.

Steps:
* Bump the package version inside `package.json`.
* Commit that change.
* Run `yarn publish` to publish and have the password for npmjs ready.
* Done.

Publishing API reference docs
-----------------------------

Do this on `master` branch.

* In this folder run `yarn run build-docs`
* Commit the changes in <root>/docs/extension_api/* also keep an eye open for new files.
