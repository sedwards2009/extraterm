/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const shelljs = require('shelljs');

// This is mostly to keep the linter happy.
const test = shelljs.test;
const mkdir = shelljs.mkdir;
const exec = shelljs.exec;
const cd = shelljs.cd;
const echo = shelljs.echo;

const path = require('path');

function main() {
  "use strict";

  const BUILD_DIR = 'build_native';
  
  if ( ! test('-d', BUILD_DIR)) {
    mkdir(BUILD_DIR);
  }
  
  cd(BUILD_DIR);
  
  exec("npm init -f");
  exec("npm install --save font-manager@0.2.2");
  
  exec("npm install --save electron-prebuilt@0.37.2");
  exec("npm install --save electron-rebuild@1.1.5");

  exec("npm config set msvs_version 2015");

  exec(path.join(__dirname, "rebuild_mods_windows.bat"));

  exec("npm uninstall electron-rebuild");
  exec("npm uninstall electron-prebuilt");
  
  echo("Done");
}
main();
