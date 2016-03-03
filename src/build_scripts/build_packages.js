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
  
  // Create a small package.json with no dev deps and 'npm install' it to pull
  // all of the runtime deps into a clean node_modules dir.
  const buildPackageData = JSON.parse(packageJson);
  delete buildPackageData.devDependencies;
  fs.writeFileSync(path.join(BUILD_TMP, 'package.json'), JSON.stringify(buildPackageData), { encoding: 'utf8'});
  cd (BUILD_TMP);
  exec('npm install');
  // Just read the list of dirs to know exactly which dirs are needed at runtime.
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

  const ignoreFunc = function ignoreFunc(filePath) {
    let result = true;
    
    if (/^\/node_modules\//.test(filePath)) { 
      const parts = filePath.split(/\//g);
      result = neededModules.indexOf(parts[2]) === -1;
    } else {
      result = ignoreRegExp.some( (exp) => exp.test(filePath));
    }
    // if (result) {
    //   log("ignoring: "+filePath);
    // }
    return result;
  };
  
  function makePackage(arch, platform) {
    log("");
    return new Promise(function(resolve, reject) {
      
      // Clean up the output dirs and files first.
      const versionedOutputDir = packageData.name + "-" + packageData.version + "-" + platform + "-" + arch;
      if (test('-d', versionedOutputDir)) {
        rm('-rf', versionedOutputDir);
      }
      
      const outputZip = versionedOutputDir + ".zip";
      // if (test('-f', outputZip)) {
      //   rm(outputZip);
      // }

      packager({
        arch: arch,
        dir: ".",
        platform: platform,
        version: electronVersion,
        ignore: ignoreFunc,
        overwrite: true,
        out: BUILD_TMP
      }, function done(err, appPath) {
        if (err !== null) {
          log(err);
          reject();
        } else {
          // Rename the output dir to a one with a version number in it.
          mv(appPath[0], path.join(BUILD_TMP, versionedOutputDir));
          
          // Zip it up.

          log("Zipping up the package");
          
          const thisCD = pwd();
          cd(BUILD_TMP);
          exec(`zip -r ${outputZip} ${versionedOutputDir}`);
          cd(thisCD);
          
          log("App bundle written to " + versionedOutputDir);
          resolve();
        }
      });
    });
  }
  
  makePackage('x64', 'linux')
    .then( () => { return makePackage('x64', 'win32'); })
    .then( () => { return makePackage('x64', 'darwin'); })
    .then( () => { log("Done"); } );
}
main();
