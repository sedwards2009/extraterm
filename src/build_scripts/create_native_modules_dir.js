/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const shelljs = require('shelljs');
const fs = require('fs');

const MODULE_LIST = ['font-manager'];

// This is mostly to keep the linter happy.
const test = shelljs.test;
const mkdir = shelljs.mkdir;
const exec = shelljs.exec;
const cd = shelljs.cd;
const echo = shelljs.echo;

const path = require('path');

function getPackageVersion(packageData, pkg) {
  if (packageData.dependencies[pkg] !== undefined) {
    return packageData.dependencies[pkg];
  }
  
  if (packageData.optionalDependencies[pkg] !== undefined) {
    return packageData.optionalDependencies[pkg];
  }
  
  if (packageData.devDependencies[pkg] !== undefined) {
    return packageData.devDependencies[pkg];
  }
  
  throw new Error("Unable to find a version specified for module '" + pkg + "'");
}

function main() {
  "use strict";
  
  const packageJson = fs.readFileSync('../../package.json');
  const packageData = JSON.parse(packageJson);

  const pkgList = [...MODULE_LIST];
  if (process.platform !== 'win32') {
    pkgList.push('pty.js');
  }

  const BUILD_DIR = 'build_native';
  
  if ( ! test('-d', BUILD_DIR)) {
    mkdir(BUILD_DIR);
  }
  
  cd(BUILD_DIR);
  
  exec("npm init -f");
  
  pkgList.forEach( (pkg) => {
    exec("npm install --save " + pkg + "@" + getPackageVersion(packageData, pkg));
  });
  
  exec("npm install --save electron-prebuilt@" + getPackageVersion(packageData, "electron-prebuilt"));
  exec("npm install --save electron-rebuild@" + getPackageVersion(packageData, "electron-rebuild"));

  exec("npm config set msvs_version 2015");

  exec(path.join(__dirname, "rebuild_mods_windows.bat"));

  exec("npm uninstall electron-rebuild");
  exec("npm uninstall electron-prebuilt");
  
  echo("Done");
}
main();
