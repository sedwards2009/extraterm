/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const shelljs = require('shelljs');
const fs = require('fs');

const MODULE_LIST = ["electron", "electron-rebuild", "font-manager", "node-pty"];

// This is mostly to keep the linter happy.
const test = shelljs.test;
const mkdir = shelljs.mkdir;
const exec = shelljs.exec;
const cd = shelljs.cd;
const mv = shelljs.mv;
const rm = shelljs.rm;
const echo = shelljs.echo;
const pwd = shelljs.pwd;
const find = shelljs.find;

const path = require('path');

function getPackageVersion(packageDatas, pkg) {
  for (const data of packageDatas) {
    const version = getPackageVersionFromJson(data, pkg);
    if (version != null) {
      return version;
    }
  }

  throw new Error("Unable to find a version specified for module '" + pkg + "'");
}

function getPackageVersionFromJson(packageData, pkg) {
  if (packageData.dependencies[pkg] !== undefined) {
    return packageData.dependencies[pkg];
  }
  
  if (packageData.optionalDependencies[pkg] !== undefined) {
    return packageData.optionalDependencies[pkg];
  }
  
  if (packageData.devDependencies[pkg] !== undefined) {
    return packageData.devDependencies[pkg];
  }

  return null;
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

  const packageDatas = [];
  for (const packageJsonPath of ['../package.json', '../extraterm/package.json', '../extensions/UnixSessionBackend/package.json']) {
    const packageJson = fs.readFileSync(packageJsonPath);
    packageDatas.push(JSON.parse(packageJson));
  }

  const pkgList = [...MODULE_LIST];

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
    exec("npm install --save " + pkg + "@" + getPackageVersion(packageDatas, pkg));
  });

  if (process.platform === 'win32') {
    exec("npm config set msvs_version 2015");
    exec(path.join(__dirname, "rebuild_mods_windows.bat"));
  } else {
    exec("node node_modules/electron-rebuild/lib/src/cli.js -s -f -v " + getPackageVersion(packageDatas, "electron") +
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
