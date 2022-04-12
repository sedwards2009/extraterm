/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import getRepoInfo from 'git-repo-info';

import * as packagingFunctions from './packaging_functions.js';
const makePackage = packagingFunctions.makePackage;
const makeNsis = packagingFunctions.makeNsis;
const makeDmg = packagingFunctions.makeDmg;

const log = console.log.bind(console);
const cd = sh.cd;
const cp = sh.cp;
const echo = sh.echo;
const exec = sh.exec;
const mkdir = sh.mkdir;
const pwd = sh.pwd;
const rm = sh.rm;
const test = sh.test;


async function main() {

  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }

  const linuxZipOnly = process.argv.indexOf("--linux-zip-only") !== -1;

  const rootSrcDir = "" + pwd();
  const buildTmpDir = path.join(rootSrcDir, 'build_tmp');
  if (test('-d', buildTmpDir)) {
    rm('-rf', buildTmpDir);
  }
  mkdir(buildTmpDir);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  const gitUrl = exec("git config --get remote.origin.url").trim();
  const info = getRepoInfo();

  echo("Fetching a clean copy of the source code from " + gitUrl);

  cd(buildTmpDir);

  exec("git clone -b " + info.branch + " " + gitUrl);
  cd("extraterm");
  const srcDir = "" + pwd();
  cd(srcDir);

  echo("Setting up the run time dependencies in " + srcDir);

  exec("yarn install");
  exec("yarn run build");

  echo("Removing development dependencies");
  exec("yarn workspaces focus --production");

  const version = packageData.version;

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + version;
  cp("-r", "extraterm/src/commands", path.join(buildTmpDir, commandsDir));
  cd(buildTmpDir);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(srcDir);

  if (linuxZipOnly) {
    await makePackage( {
      arch: "x64",
      platform: "linux",
      version,
      outputDir: buildTmpDir,
      replaceModuleDirs: true
    });
    log("Done");
  } else {
    if (! await makePackage( {
          arch: "x64",
          platform: "win32",
          version,
          outputDir: buildTmpDir,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! await makePackage( {
          arch: "x64",
          platform: "linux",
          version,
          outputDir: buildTmpDir,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! await makePackage( {
          arch: "x64",
          platform: "darwin",
          version,
          outputDir: buildTmpDir,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! makeDmg({
          version,
          outputDir: buildTmpDir,
          useDocker: true
        })) {
      return;
    }

    if (! makeNsis({
          version,
          outputDir: buildTmpDir,
          useDocker: true
        })) {
      return;
    }
    log("Done");
  }
}

main();
