
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
    platform: "linux",
    version,
    outputDir: buildTmpDir,
    replaceModuleDirs: false
  });

  sh.echo("");
  sh.echo("---------------------------------------------------------------");
  sh.echo("Creating Debian package");
  sh.cd(srcDir);
  makeDeb({
    version,
    buildDir: buildTmpDir
  });

  sh.echo("");
  sh.echo("---------------------------------------------------------------");
  sh.echo("Creating AppImage");
  makeAppImage({
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
Depends: libx11-6
Provides: x-terminal-emulator
Section: x11
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

  // Debian .postinst script
  const postinstFile = `#!/bin/sh -e
set -e

if [ "$1" = "configure" ]; then
  update-alternatives --install /usr/bin/x-terminal-emulator \
  x-terminal-emulator /opt/${APP_NAME}/${APP_NAME} 30
fi
`;
  const postinstPath = path.join(debTmp, "DEBIAN", `postinst`);
  fs.writeFileSync(postinstPath, postinstFile, {encoding: "utf-8"});
  sh.chmod('755', postinstPath);

  // Debian .prerm script
  const prermFile = `#!/bin/sh
set -e

if [ "$1" = "remove" ]; then
  update-alternatives --remove x-terminal-emulator /opt/${APP_NAME}/${APP_NAME}
fi
`;
  const prermPath = path.join(debTmp, "DEBIAN", `prerm`);
  fs.writeFileSync(prermPath, prermFile, {encoding: "utf-8"});
  sh.chmod('755', prermPath);

  sh.cp("-r", "build_scripts/resources/linux/icons", path.join(debTmp, "usr", "share"));

  // Package in .deb
  sh.exec(`dpkg-deb --root-owner-group --build ${debTmp}`);
}

function makeAppImage({version, buildDir}) {
  const srcDir = sh.pwd();

  const appimageDir = path.join(buildDir, "appimage");
  sh.mkdir(appimageDir);

  const baseZipName = packaging_functions.createOutputDirName({version, platform: "linux", arch: "x64"});
  const zipName = baseZipName + ".zip";

  sh.cp("main/resources/logo/extraterm_small_logo_256x256.png", path.join(appimageDir, "extraterm.png"));

  sh.cp(path.join(buildDir, zipName), appimageDir);
  const appimageBuildScript = `app: extratermqt

ingredients:
  scripts:
    - echo "${version}"

script:
  - BASE_NAME=${baseZipName}
  - mkdir extratermqt
  - unzip ../../$BASE_NAME.zip -d opt
  - cd opt
  - mv $BASE_NAME extratermqt
  - cd ..
  - echo "${version}" > ../VERSION
  - cp ../../extraterm.png .
  - cat > extratermqt.desktop <<EOF
  - [Desktop Entry]
  - Categories=System;TerminalEmulator;
  - Comment[en_US]=Command line access
  - Comment=Command line access
  - Exec=extratermqt
  - GenericName[en_US]=Terminal
  - GenericName=Terminal
  - Icon=extraterm
  - MimeType=
  - Name[en_US]=ExtratermQt
  - Name=ExtratermQt
  - Terminal=false
  - Type=Application
  - EOF
  - cd usr/bin
  - ln -s ../../opt/extratermqt/extratermqt
  - cd ../..
`;
  fs.writeFileSync(path.join(appimageDir, "extraterm.yml"), appimageBuildScript, {encoding: "utf-8"});

  sh.cd(appimageDir);
  sh.exec(`ARCH=x86_64 pkg2appimage.AppImage extraterm.yml`);

  sh.mv("out/*.AppImage", buildDir);

  sh.cd(srcDir);
}
