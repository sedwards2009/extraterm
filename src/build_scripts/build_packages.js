/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const packager = require('electron-packager');

const log = console.log.bind(console);
const BUILD_TMP = 'build_tmp';

function main() {
  "use strict";
  
  if ( ! test('-f', './package.json')) {
    log("This script was called from the wrong directory.");
    return;
  }
  
  log("Setting up the run time dependencies in " + BUILD_TMP);
  
  if (test('-d', BUILD_TMP)) {
    rm('-rf', BUILD_TMP);
  }
  mkdir(BUILD_TMP);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);
  
  const electronVersion = packageData.devDependencies['electron-prebuilt'];
  
  delete packageData.devDependencies;
  
  fs.writeFileSync(path.join(BUILD_TMP, 'package.json'), JSON.stringify(packageData), { encoding: 'utf8'});
  
  cd (BUILD_TMP);
  exec('npm install');
  
  const neededModules = ls('node_modules');
  
  cd('..');

  const ignoreRegExp = [
    /^\/build_scripts\//,
    /^\/test\//,
    /^\/build_tmp\//,
    /^\/typedocs\//,
    /^\/[^/]+\.ts/,
    /^\/[^/]+\.js\.map/
  ];

log(neededModules);

  const ignoreFunc = function ignoreFunc(filePath) {
    let result = true;
    
    if (/^\/node_modules\//.test(filePath)) { 
      const parts = filePath.split(/\//g);
      result = neededModules.indexOf(parts[2]) === -1;
    } else {
      result = ignoreRegExp.some( (exp) => exp.test(filePath));
    }
    if (result) {
      log("ignoring: "+filePath);
    }
    return result;
  };
  
  packager({
    arch: "x64",
    dir: ".",
    platform: "linux",
    version: electronVersion,
    ignore: ignoreFunc,
    overwrite: true
  }, function done(err, appPath) {
    log(err);
    log("App bundle written to " + appPath);
  });
}
main();
