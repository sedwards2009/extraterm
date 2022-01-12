
/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const sh = require('shelljs');
const fs = require('fs');
const path = require('path');
const command = require('commander');

sh.config.fatal = true;

const packaging_functions = require('./packaging_functions');

const APP_NAME = packaging_functions.APP_NAME;
const APP_TITLE = packaging_functions.APP_TITLE;

async function main() {
  const parsedArgs = new command.Command("extraterm");
  parsedArgs.option('--version [app version]', 'Application version to use', null)
    .parse(process.argv);
  const options = parsedArgs.opts();

  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }
  const srcDir = "" + pwd();
  const buildTmpDir = path.join(srcDir, 'build_tmp');
  if (test('-d', buildTmpDir)) {
    rm('-rf', buildTmpDir);
  }
  mkdir(buildTmpDir);

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

  echo("");
  echo("Done.");
}

function makeDmg( { version, outputDir, useDocker } ) {
  echo("");
  echo("---------------------------------------------------");
  echo("Building dmg file for macOS");
  echo("---------------------------------------------------");

  const buildTmpDir = outputDir;
  const srcDir = "" + pwd();

  const darwinPath = path.join(buildTmpDir, `${APP_NAME}-${version}-darwin-x64`);
  for (const f of ls(darwinPath)) {
    if ( ! f.endsWith(".app")) {
      echo(`Deleting ${f}`);
      rm(path.join(darwinPath, f));
    }
  }

  cp(path.join(srcDir, "build_scripts/resources/macos/.DS_Store"), path.join(darwinPath, ".DS_Store"));
  cp(path.join(srcDir, "build_scripts/resources/macos/.VolumeIcon.icns"), path.join(darwinPath, ".VolumeIcon.icns"));
  mkdir(path.join(darwinPath, ".background"));
  cp(path.join(srcDir, "build_scripts/resources/macos/.background/extraterm_background.png"), path.join(darwinPath, ".background/extraterm_background.png"));

  ln("-s", "/Applications", path.join(darwinPath, "Applications"));

  if (useDocker) {
    exec(`docker run --rm -v "${buildTmpDir}:/files" sporsh/create-dmg ${APP_TITLE} /files/${APP_NAME}-${version}-darwin-x64/ /files/${APP_NAME}_${version}.dmg`);
  } else {
    exec(`hdiutil create -volname ${APP_TITLE} -srcfolder ${darwinPath} -ov -format UDZO ${buildTmpDir}/${APP_NAME}_${version}.dmg`);
  }

  return true;
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});
