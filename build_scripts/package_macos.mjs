
/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as command from 'commander';

sh.config.fatal = true;

import * as packaging_functions from './packaging_functions.mjs';

const APP_NAME = packaging_functions.APP_NAME;
const APP_TITLE = packaging_functions.APP_TITLE;

async function main() {
  const parsedArgs = new command.Command("extraterm");
  parsedArgs.option('--version [app version]', 'Application version to use', null)
    .parse(process.argv);
  const options = parsedArgs.opts();

  if ( ! sh.test('-f', './package.json')) {
    sh.echo("This script was called from the wrong directory.");
    return;
  }
  const srcDir = "" + sh.pwd();
  const buildTmpDir = path.join(srcDir, 'build_tmp');
  if (sh.test('-d', buildTmpDir)) {
    sh.rm('-rf', buildTmpDir);
  }
  sh.mkdir(buildTmpDir);

  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  let version = options.version == null ? packageData.version : options.version;
  if (version[0] === "v") {
    version = version.slice(1);
  }

  await packaging_functions.makePackage({
    arch: "x64",
    platform: "darwin",
    version,
    outputDir: buildTmpDir,
    replaceModuleDirs: false
  });

  await makeDmg({
      version,
      outputDir: buildTmpDir,
      useDocker: false
  });

  sh.echo("");
  sh.echo("Done.");
}

function makeDmg( { version, outputDir, useDocker } ) {
  sh.echo("");
  sh.echo("---------------------------------------------------");
  sh.echo("Building dmg file for macOS");
  sh.echo("---------------------------------------------------");

  const buildTmpDir = outputDir;
  const srcDir = "" + sh.pwd();

  const darwinPath = path.join(buildTmpDir, `${APP_NAME}-${version}-darwin-x64`);
  for (const f of ls(darwinPath)) {
    if ( ! f.endsWith(".app")) {
      sh.echo(`Deleting ${f}`);
      sh.rm(path.join(darwinPath, f));
    }
  }

  sh.cp(path.join(srcDir, "build_scripts/resources/macos/.DS_Store"), path.join(darwinPath, ".DS_Store"));
  sh.cp(path.join(srcDir, "build_scripts/resources/macos/.VolumeIcon.icns"), path.join(darwinPath, ".VolumeIcon.icns"));
  sh.mkdir(path.join(darwinPath, ".background"));
  sh.cp(path.join(srcDir, "build_scripts/resources/macos/.background/extraterm_background.png"), path.join(darwinPath, ".background/extraterm_background.png"));

  sh.ln("-s", "/Applications", path.join(darwinPath, "Applications"));

  if (useDocker) {
    sh.exec(`docker run --rm -v "${buildTmpDir}:/files" sporsh/create-dmg ${APP_TITLE} /files/${APP_NAME}-${version}-darwin-x64/ /files/${APP_NAME}_${version}.dmg`);
  } else {
    sh.exec(`hdiutil create -volname ${APP_TITLE} -srcfolder ${darwinPath} -ov -format UDZO ${buildTmpDir}/${APP_NAME}_${version}.dmg`);
  }

  return true;
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});
