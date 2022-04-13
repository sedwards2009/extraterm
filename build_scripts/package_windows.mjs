/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
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
    platform: "win32",
    version,
    outputDir: buildTmpDir,
    replaceModuleDirs: false
  });

  await makeNsis({
      version,
      outputDir: buildTmpDir,
      useDocker: false
  });

  sh.echo("");
  sh.echo("Done.");
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});

function makeNsis( { version, outputDir, useDocker } ) {
  const BUILD_TMP_DIR = outputDir;
  sh.echo("");
  sh.echo("---------------------------------------------------");
  sh.echo("Building NSIS based installer for Windows");
  sh.echo("---------------------------------------------------");

  const windowsBuildDirName = `${APP_NAME}-${version}-win32-x64`;
  const versionSplit = version.split(".");
  const majorVersion = versionSplit[0];
  const minorVersion = versionSplit[1];
  const patchVersion = versionSplit[2];

  const installerScript = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "${APP_TITLE}"
!define DESCRIPTION "Terminal emulator"
!define COMPANYNAME "extraterm.org"
!define VERSIONMAJOR ${majorVersion}
!define VERSIONMINOR ${minorVersion}
!define VERSIONBUILD ${patchVersion}

!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.
!define MUI_INSTFILESPAGE_COLORS "3db54a 000000"
!define MUI_ICON "${windowsBuildDirName}\\main\\resources\\logo\\extraterm_small_logo.ico"

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Name "${APP_TITLE}"
BrandingText " "
OutFile "${APP_NAME}-setup-${version}.exe"
InstallDir "$PROGRAMFILES64\\${APP_TITLE}"
InstallDirRegKey HKLM "Software\\${APP_TITLE}" "InstallLocation"

ShowInstDetails show # This will always show the installation details.

Section "${APP_TITLE}"
SetOutPath $INSTDIR
File /r "${windowsBuildDirName}\\*"

WriteUninstaller "$INSTDIR\\Uninstall.exe"

createShortCut "$SMPROGRAMS\\${APP_TITLE}.lnk" "$INSTDIR\\${APP_NAME}.exe" "" "$INSTDIR\\main\\resources\\logo\\extraterm_small_logo.ico"

WriteRegStr HKLM "Software\\${APP_TITLE}" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\${APP_TITLE}" "Version" "${version}"

# Registry information for add/remove programs
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayName" "\${APPNAME} - \${DESCRIPTION}"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "UninstallString" "$\\"$INSTDIR\\uninstall.exe$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "QuietUninstallString" "$\\"$INSTDIR\\uninstall.exe$\\" /S"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayIcon" "$\\"$INSTDIR\\main\\resources\\logo\\extraterm_small_logo.ico$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "Publisher" "\${COMPANYNAME}"

WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayVersion" "\${VERSIONMAJOR}.\${VERSIONMINOR}.\${VERSIONBUILD}"
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "VersionMajor" \${VERSIONMAJOR}
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "VersionMinor" \${VERSIONMINOR}
# There is no option for modifying or repairing the install
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "NoModify" 1
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "NoRepair" 1
# Set the INSTALLSIZE constant (!defined at the top of this script) so Add/Remove Programs can accurately report the size

# Record the installation size
\${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
IntFmt $0 "0x%08X" $0
WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "EstimatedSize" "\$0"

# Set up Windows Explorer menu items
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\${APP_NAME}" "" 'Open in ${APP_TITLE}'
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\${APP_NAME}\\command" "" '"$INSTDIR\\${APP_NAME}.exe" "%V"'
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\${APP_NAME}" "icon" '$INSTDIR\\${APP_NAME}.exe'

WriteRegStr HKCU "Software\\Classes\\directory\\shell\\${APP_NAME}" "" 'Open in ${APP_TITLE}'
WriteRegStr HKCU "Software\\Classes\\directory\\shell\\${APP_NAME}\\command" "" '"$INSTDIR\\${APP_NAME}.exe" "%V"'
WriteRegStr HKCU "Software\\Classes\\directory\\shell\\${APP_NAME}" "icon" '$INSTDIR\\${APP_NAME}.exe'

SectionEnd


Section "Uninstall"
# Remove Start Menu launcher
Delete "$SMPROGRAMS\\${APP_TITLE}.lnk"

Delete "$INSTDIR\\*.*"
Delete "$INSTDIR\\Uninstall.exe"
RMDir /r "$INSTDIR"

DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}"
DeleteRegKey HKLM "Software\\${APP_TITLE}"

DeleteRegKey HKCU "Software\\Classes\\directory\\Background\\shell\\${APP_NAME}"
DeleteRegKey HKCU "Software\\Classes\\directory\\shell\\${APP_NAME}"

SectionEnd
`;
sh.echo("----------------------------------------------------------")
sh.echo(installerScript);
sh.echo("----------------------------------------------------------")

  fs.writeFileSync(path.join(BUILD_TMP_DIR, "installer.nsi"), installerScript, {encoding: "utf-8"});
  if (useDocker) {
    sh.exec(`docker run --rm -t -v ${BUILD_TMP_DIR}:/wine/drive_c/src/ cdrx/nsis`);
  } else {
    const prevDir = sh.pwd();
    sh.cd(BUILD_TMP_DIR);
    sh.exec("makensis installer.nsi");
    sh.cd(prevDir);
  }
  return true;
}
