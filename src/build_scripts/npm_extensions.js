/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');
const fs = require('fs');

if (process.argv.length !== 3) {
  echo("Wrong number of arguments to npm_extensions.js");
  process.exit(1);
}

switch(process.argv[2]) {
  case 'install-extension-api':
    installExtensionApi();
    break;

  case 'build':
    npmCommandExtensions('run build');
    break;

  case 'install':
    npmCommandExtensions('install');
    break;

  case 'prune':
    npmCommandExtensions('prune --production');
    break;

  default:
    echo("Bad argument to npm_extensions.js");
    process.exit(1);
    break;
}

process.exit(0);


function installExtensionApi() {
  const currentDir = pwd();
  findExtensions().forEach(fullExtensionPath => {
    echo('');
    cd(fullExtensionPath);

    const packageJson = fs.readFileSync('package.json', 'UTF8');
    const package = JSON.parse(packageJson);
    if (package.devDependencies !== undefined && package.devDependencies["extraterm-extension-api"] !== undefined) {
      echo('cd ' + fullExtensionPath);
      echo('npm install extraterm-extension-api')
      exec('npm install extraterm-extension-api');
    }

    cd(currentDir);
  });
}

function findExtensions(npmCommand) {
  const sourceExtensionDirs = ['src/test/extensions', 'extensions'];
  const extensionDirs = [];

  sourceExtensionDirs.forEach(moduleDir => {
    ls(moduleDir).forEach(item => {
      const fullExtensionPath = path.join(moduleDir, item);
      const fullPackagePath = path.join(fullExtensionPath, 'package.json');
      if (test('-e', fullPackagePath)) {
        extensionDirs.push(fullExtensionPath);
      }
    });
  });
  return extensionDirs;
}

function npmCommandExtensions(command) {
  const currentDir = pwd();
  findExtensions().forEach(fullExtensionPath => {
    echo('');
    echo('cd ' + fullExtensionPath);
    cd(fullExtensionPath);

    echo('npm ' + command)
    exec('npm '+ command);

    cd(currentDir);
  });
}
