/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const shelljs = require('shelljs');
const fs = require('fs');

const MODULE_LIST = ['font-manager', 'electron', 'electron-rebuild'];

// This is mostly to keep the linter happy.
const test = shelljs.test;
const mkdir = shelljs.mkdir;
const exec = shelljs.exec;
const cd = shelljs.cd;
const mv = shelljs.mv;
const rm = shelljs.rm;
const echo = shelljs.echo;
const pwd = shelljs.pwd;

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

function platformModuleDir() {
  return  `node_modules-${process.platform}-${process.arch}`;
}

function main() {
  "use strict";
  
  const target = platformModuleDir();
  if (test('-d', target)) {
    echo(`
Target directory ${target} already exists. First delete it from git and run this again.

Exiting.
`);
    return;
  }

  const packageJson = fs.readFileSync('../../package.json');
  const packageData = JSON.parse(packageJson);

  const pkgList = [...MODULE_LIST];
  if (process.platform !== 'win32') {
    pkgList.push('ptyw.js');
  }

  // Set up the build dir
  const BUILD_DIR = 'build_native';
  if (test('-d', BUILD_DIR)) {
    rm('-rf', BUILD_DIR);
  }
  mkdir(BUILD_DIR);
  
  const currentDir = pwd();
  cd(BUILD_DIR);
  
  exec("npm init -f");
  
  pkgList.forEach( (pkg) => {    
    exec("npm install --save " + pkg + "@" + getPackageVersion(packageData, pkg));
  });

  if (process.platform === 'win32') {
    exec("npm config set msvs_version 2015");
    exec(path.join(__dirname, "rebuild_mods_windows.bat"));
  } else {
    exec("node node_modules/electron-rebuild/lib/cli.js -s -f -v " + getPackageVersion(packageData, "electron") +
      " -t prod,optional,dev");
  }

  exec("npm uninstall electron-rebuild");
  exec("npm uninstall electron");
  exec("npm prune");

  cd(currentDir);
  mv(path.join(BUILD_DIR, "node_modules"), target);
  
  echo(`Done. ${target} has been updated. You can add it back in with git.`);
}
main();
