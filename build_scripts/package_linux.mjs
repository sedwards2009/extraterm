
/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as command from 'commander';

sh.config.fatal = true;

import * as packaging_functions from './packaging_functions.js';

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
    platform: "linux",
    version,
    outputDir: buildTmpDir,
    replaceModuleDirs: false
  });
  sh.echo("");

  sh.echo("Creating debian package");
  sh.cd(srcDir);
  makeDeb({
    version,
    buildDir: buildTmpDir
  });

  sh.echo("Done.");
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});

function makeDeb({version, buildDir}) {
  // Move the files into position
  const outputDirName = packaging_functions.createOutputDirName({version, platform: "linux", arch: "x64"});
  const debTmp = path.join(buildDir, `${APP_NAME}_${version}_amd64`);
  sh.mkdir("-p", path.join(debTmp, "opt"));
  sh.mv(path.join(buildDir, outputDirName), path.join(debTmp, "opt", APP_NAME));

  // Set up special Debian control files
  const debianDir = path.join(debTmp, "DEBIAN");
  sh.mkdir("-p", debianDir);
  const controlFile = `Package: ${APP_NAME}
Architecture: amd64
Maintainer: Simon Edwards
Priority: optional
Version: ${version}
Description: The swiss army chainsaw of terminal emulators
`;
  fs.writeFileSync(path.join(debianDir, "control"), controlFile, {encoding: "utf-8"});
  fs.writeFileSync(path.join(debianDir, "conffiles"), "", {encoding: "utf-8"});

  // Write `.desktop` file
  const appsDir = path.join(debTmp, "usr", "share", "applications");
  sh.mkdir("-p", appsDir);

  const desktopFile = `[Desktop Entry]
Name=${APP_TITLE}
Exec=/opt/${APP_NAME}/${APP_NAME}
Terminal=false
Type=Application
Comment=The swiss army chainsaw of terminal emulators
Categories=System;TerminalEmulator;X-GNOME-Utilities;
Icon=${APP_NAME}
`;
  fs.writeFileSync(path.join(appsDir, `${APP_NAME}.desktop`), desktopFile, {encoding: "utf-8"});

  sh.cp("-r", "build_scripts/resources/linux/icons", path.join(debTmp, "usr", "share"));

  // Package in .deb
  sh.exec(`dpkg-deb --root-owner-group --build ${debTmp}`);
}
