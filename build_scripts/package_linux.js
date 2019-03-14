
/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');

const packaging_functions = require('./packaging_functions');

async function main() {
  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }
  const SRC_DIR = "" + pwd();
  const BUILD_TMP_DIR = path.join(SRC_DIR, 'build_tmp');
  if (test('-d', BUILD_TMP_DIR)) {
    rm('-rf', BUILD_TMP_DIR);
  }
  mkdir(BUILD_TMP_DIR);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  const electronVersion = packageData.devDependencies['electron'];

  await packaging_functions.makePackage({
    arch: "x64",
    platform: "linux",
    electronVersion,
    version: packageData.version,
    outputDir: BUILD_TMP_DIR,
    replaceModuleDirs: false
  });
  echo("");
  echo("Done.");
}

main().catch(ex => {
  console.log(ex);
});
