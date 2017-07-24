/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');

const currentDir = pwd();

sourceModuleDirs = ['src/test/extensions'];

sourceModuleDirs.forEach(moduleDir => {
  ls(moduleDir).forEach(item => {
    const fullPackagePath = path.join(moduleDir, item, "package.json");
    if (test('-e', fullPackagePath)) {
      cd(path.join(moduleDir, item));
      exec('npm install');
      cd(currentDir);
    }
  });
});
