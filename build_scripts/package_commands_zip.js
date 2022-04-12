/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';

sh.config.fatal = true;

async function main() {
  const parsedArgs = new Command("extraterm");
  parsedArgs.option('--use-version [app version]', 'Application version to use', null);
  parsedArgs.parse(process.argv);

  if ( ! sh.test('-f', './package.json')) {
    sh.echo("This script was called from the wrong directory.");
    return;
  }

  const SRC_DIR = "" + pwd();
  const BUILD_TMP_DIR = path.join(SRC_DIR, 'build_tmp');
  if (sh.test('-d', BUILD_TMP_DIR)) {
    sh.rm('-rf', BUILD_TMP_DIR);
  }
  sh.mkdir(BUILD_TMP_DIR);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  let version = parsedArgs.useVersion == null ? packageData.version : parsedArgs.useVersion;
  if (version[0] === "v") {
    version = version.slice(1);
  }

  const commandsDir = packageData.name + "-commands-" + version;
  sh.echo("Creating " + commandsDir);
  sh.cp("-r", "main/src/commands", path.join(BUILD_TMP_DIR, commandsDir));
  sh.cd(BUILD_TMP_DIR);
  sh.exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  sh.cd(SRC_DIR);

  sh.echo("");
  sh.echo("Done.");
}
main();
