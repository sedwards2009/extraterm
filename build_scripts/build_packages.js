/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const getRepoInfo = require('git-repo-info');

const packagingFunctions = require('./packaging_functions');
const makePackage = packagingFunctions.makePackage;
const makeNsis = packagingFunctions.makeNsis;

const log = console.log.bind(console);

async function main() {
  "use strict";
  
  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }

  const linuxZipOnly = process.argv.indexOf("--linux-zip-only") !== -1;
  
  const ROOT_SRC_DIR = "" + pwd();
  const BUILD_TMP_DIR = path.join(ROOT_SRC_DIR, 'build_tmp');
  if (test('-d', BUILD_TMP_DIR)) {
    rm('-rf', BUILD_TMP_DIR);
  }
  mkdir(BUILD_TMP_DIR);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  const gitUrl = exec("git config --get remote.origin.url").trim();
  const info = getRepoInfo();

  echo("Fetching a clean copy of the source code from " + gitUrl);

  cd(BUILD_TMP_DIR);
  
  exec("git clone -b " + info.branch + " " + gitUrl);
  cd("extraterm");
  const SRC_DIR = "" + pwd();
  cd(SRC_DIR);

  echo("Setting up the run time dependencies in " + SRC_DIR);

  exec("yarn install");
  exec("yarn run electron-rebuild");
  exec("yarn run build");

  echo("Removing development dependencies");
  exec("yarn install --production=true");

  const version = packageData.version;

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + version;
  cp("-r", "extraterm/src/commands", path.join(BUILD_TMP_DIR, commandsDir));
  cd(BUILD_TMP_DIR);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(SRC_DIR);

  const electronVersion = packageData.devDependencies['electron'];

  function makeDmg() {
    echo("");
    echo("---------------------------------------------------");
    echo("Building dmg file for macOS");
    echo("---------------------------------------------------");

    const darwinPath = path.join(BUILD_TMP_DIR, `extraterm-${packageData.version}-darwin-x64`);
    for (const f of ls(darwinPath)) {
      if ( ! f.endsWith(".app")) {
        echo(`Deleting ${f}`);
        rm(path.join(darwinPath, f));
      }
    }

    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.DS_Store"), path.join(darwinPath, ".DS_Store"));
    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.VolumeIcon.icns"), path.join(darwinPath, ".VolumeIcon.icns"));
    mkdir(path.join(darwinPath,".background"));
    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.background/extraterm_background.png"), path.join(darwinPath, ".background/extraterm_background.png"));

    ln("-s", "/Applications", path.join(darwinPath, "Applications"));

    exec(`docker run --rm -v "${BUILD_TMP_DIR}:/files" sporsh/create-dmg Extraterm /files/extraterm-${packageData.version}-darwin-x64/ /files/extraterm_${packageData.version}.dmg`);
    return true;
  }
  
  if (linuxZipOnly) {
    await makePackage( {
      arch: "x64",
      platform: "linux",
      electronVersion,
      version,
      outputDir: BUILD_TMP_DIR,
      replaceModuleDirs: true
    });
    log("Done");
  } else {
    if (! await makePackage( {
          arch: "x64",
          platform: "win32",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }
    
    if (! await makePackage( {
          arch: "x64",
          platform: "linux",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! await makePackage( {
          arch: "x64",
          platform: "darwin",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! makeDmg()) {
      return;
    }

    if (! makeNsis({
      version,
      outputDir: BUILD_TMP_DIR,
      useDocker: true
    })) {
      return;
    }
    log("Done");
  }
}

main();
