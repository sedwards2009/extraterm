/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');

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

  // Create the commands zip
  const commandsDir = packageData.name + "-commands-" + packageData.version;
  echo("Creating " + commandsDir);
  cp("-r", "extraterm/src/commands", path.join(BUILD_TMP_DIR, commandsDir));
  cd(BUILD_TMP_DIR);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(SRC_DIR);

  echo("");
  echo("Done.");
}
main();
