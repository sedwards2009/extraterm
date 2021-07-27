
/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
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
    platform: "linux",
    version,
    outputDir: buildTmpDir,
    replaceModuleDirs: false
  });
  echo("");

  echo("Creating debian package");
  cd(srcDir);
  makeDeb({
    version,
    buildDir: buildTmpDir
  });

  echo("Done.");
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});

function makeDeb({version, buildDir}) {
  // Move the files into position
  const outputDirName = packaging_functions.createOutputDirName({version, platform: "linux", arch: "x64"});
  const debTmp = path.join(buildDir, `extraterm_${version}_amd64`);
  mkdir("-p", path.join(debTmp, "opt"));
  mv(path.join(buildDir, outputDirName), path.join(debTmp, "opt", "extraterm"));

  // Set up special Debian control files
  const debianDir = path.join(debTmp, "DEBIAN");
  mkdir("-p", debianDir);
  const controlFile = `Package: extraterm
Architecture: amd64
Maintainer: Simon Edwards
Priority: optional
Version: ${version}
Description: The swiss army chainsaw of terminal emulators
`;
  fs.writeFileSync(path.join(debianDir, "control"), controlFile, {encoding: "utf-8"});
  fs.writeFileSync(path.join(debianDir,"conffiles"), "", {encoding: "utf-8"});

  // Write `.desktop` file
  const appsDir = path.join(debTmp, "usr", "share", "applications");
  mkdir("-p", appsDir);

  const desktopFile = `[Desktop Entry]
Name=Extraterm
Exec=/opt/extraterm/extraterm
Terminal=false
Type=Application
Comment=The swiss army chainsaw of terminal emulators
Categories=System;TerminalEmulator;X-GNOME-Utilities;
Icon=extraterm
`;
  fs.writeFileSync(path.join(appsDir, "extraterm.desktop"), desktopFile, {encoding: "utf-8"});

  cp("-r", "build_scripts/resources/linux/icons", path.join(debTmp, "usr", "share"));

  // Package in .deb
  exec(`dpkg-deb --root-owner-group --build ${debTmp}`);
}
