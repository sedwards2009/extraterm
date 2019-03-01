/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const shelljs = require('shelljs');
const fs = require('fs');

const MODULE_LIST = ["electron", "electron-rebuild", "node-pty"];

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
  
  const defaultPackage = `{
    "name": "build_native",
    "version": "1.0.0",
    "main": "index.js",
    "license": "MIT",
    "scripts": {
      "electron-rebuild": "node ./node_modules/electron-rebuild/lib/src/cli.js -o node-pty -f -v ${getPackageVersion(packageDatas, "electron")}",
      "electron-rebuild-win32": "./node_modules/.bin/electron-rebuild.cmd -o node-pty -f -v ${getPackageVersion(packageDatas, "electron")}"
    }
  }`;

  fs.writeFileSync("package.json", defaultPackage, "utf-8");

  pkgList.forEach( (pkg) => {    
    exec("yarn add " + pkg + "@" + getPackageVersion(packageDatas, pkg));
  });

  if (process.platform === 'win32') {
    exec("yarn run electron-rebuild-win32");
  } else {
    exec("yarn run electron-rebuild");
  }

  exec("yarn remove electron-rebuild");
  exec("yarn remove electron");

  cd(currentDir);
  mv(path.join(BUILD_DIR, "node_modules"), target);
  rm(path.join(target, ".yarn-integrity"));

  echo(`Done. ${target} has been updated. You can add it back in with git.`);
}
main();
