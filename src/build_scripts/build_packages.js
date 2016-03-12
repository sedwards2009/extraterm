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
    echo("This script was called from the wrong directory.");
    return;
  }

  if (test('-d', BUILD_TMP)) {
    rm('-rf', BUILD_TMP);
  }
  mkdir(BUILD_TMP);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);
  
  const gitUrl = packageData.repository.url.replace("git://github.com/", "git@github.com:");
  
  echo("Fetching a clean copy of the source code from " + gitUrl);
  cd(BUILD_TMP);
  const buildTmpPath = pwd();
  
  exec("git clone --depth 1 " + gitUrl);
  
  echo("Setting up the run time dependencies in " + BUILD_TMP);

  cd("extraterm");
  echo("Downloading dependencies.");
  exec("npm install");
  
  echo("Building");
  exec("npm run build");
  
  echo("Removing development dependencies");
  exec("npm prune --production");

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + packageData.version;
  cp("-r", "src/commands", path.join(buildTmpPath, commandsDir));
  const codeDir = pwd();
  cd(buildTmpPath);
  exec(`zip -r ${commandsDir}.zip ${commandsDir}`);
  cd(codeDir);

  const electronVersion = packageData.devDependencies['electron-prebuilt'];

  const ignoreRegExp = [
    /^\/build_scripts\//,
    /^\/test\//,
    /^\/build_tmp\//,
    /^\/typedocs\//,
    /^\/[^/]+\.ts/,
    /^\/[^/]+\.js\.map/
  ];

  const ignoreFunc = function ignoreFunc(filePath) {
    return ignoreRegExp.some( (exp) => exp.test(filePath));
  };
  
  function makePackage(arch, platform) {
    log("");
    return new Promise(function(resolve, reject) {
      
      // Clean up the output dirs and files first.
      const versionedOutputDir = packageData.name + "-" + packageData.version + "-" + platform + "-" + arch;
      if (test('-d', versionedOutputDir)) {
        rm('-rf', versionedOutputDir);
      }
      
      const outputZip = path.join(buildTmpPath, versionedOutputDir + ".zip");

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
    .then( () => { return makePackage('ia32', 'linux'); })
    .then( () => { return makePackage('x64', 'win32'); })
    .then( () => { return makePackage('x64', 'darwin'); })
    .then( () => { log("Done"); } );
}
main();
