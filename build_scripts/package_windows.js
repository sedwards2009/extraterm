/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
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

  echo("");
  echo("Done.");
}

main().catch(ex => {
  console.log(ex);
  process.exit(1);
});

function makeNsis( { version, outputDir, useDocker } ) {
  const BUILD_TMP_DIR = outputDir;
  echo("");
  echo("---------------------------------------------------");
  echo("Building NSIS based installer for Windows");
  echo("---------------------------------------------------");

  const windowsBuildDirName = `extraterm-${version}-win32-x64`;
  const versionSplit = version.split(".");
  const majorVersion = versionSplit[0];
  const minorVersion = versionSplit[1];
  const patchVersion = versionSplit[2];

  const installerScript = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "Extraterm"
!define DESCRIPTION "Terminal emulator"
!define COMPANYNAME "extraterm.org"
!define VERSIONMAJOR ${majorVersion}
!define VERSIONMINOR ${minorVersion}
!define VERSIONBUILD ${patchVersion}

!define MUI_ABORTWARNING # This will warn the user if they exit from the installer.
!define MUI_INSTFILESPAGE_COLORS "3db54a 000000"
!define MUI_ICON "${windowsBuildDirName}\\resources\\app\\extraterm\\resources\\logo\\extraterm_small_logo.ico"

!insertmacro MUI_PAGE_WELCOME # Welcome to the installer page.
!insertmacro MUI_PAGE_DIRECTORY # In which folder install page.
!insertmacro MUI_PAGE_INSTFILES # Installing page.
!insertmacro MUI_PAGE_FINISH # Finished installation page.

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Name "Extraterm"
BrandingText " "
OutFile "extraterm-setup-${version}.exe"
InstallDir "$PROGRAMFILES64\\Extraterm"
InstallDirRegKey HKLM "Software\\Extraterm" "InstallLocation"

ShowInstDetails show # This will always show the installation details.

Section "Extraterm"
SetOutPath $INSTDIR
File /r "${windowsBuildDirName}\\*"

WriteUninstaller "$INSTDIR\\Uninstall.exe"

createShortCut "$SMPROGRAMS\\Extraterm.lnk" "$INSTDIR\\extraterm.exe" "" "$INSTDIR\\resources\\app\\extraterm\\resources\\logo\\extraterm_small_logo.ico"

WriteRegStr HKLM "Software\\Extraterm" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\Extraterm" "Version" "${version}"

# Registry information for add/remove programs
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayName" "\${APPNAME} - \${DESCRIPTION}"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "UninstallString" "$\\"$INSTDIR\\uninstall.exe$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "QuietUninstallString" "$\\"$INSTDIR\\uninstall.exe$\\" /S"
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "InstallLocation" "$\\"$INSTDIR$\\""
WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}" "DisplayIcon" "$\\"$INSTDIR\\resources\\app\\extraterm\\resources\\logo\\extraterm_small_logo.ico$\\""
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
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\extraterm" "" 'Open in Extraterm'
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\extraterm\\command" "" '"$INSTDIR\\extraterm.exe" "%V"'
WriteRegStr HKCU "Software\\Classes\\directory\\Background\\shell\\extraterm" "icon" '$INSTDIR\\extraterm.exe'

WriteRegStr HKCU "Software\\Classes\\directory\\shell\\extraterm" "" 'Open in Extraterm'
WriteRegStr HKCU "Software\\Classes\\directory\\shell\\extraterm\\command" "" '"$INSTDIR\\extraterm.exe" "%V"'
WriteRegStr HKCU "Software\\Classes\\directory\\shell\\extraterm" "icon" '$INSTDIR\\extraterm.exe'

SectionEnd


Section "Uninstall"
# Remove Start Menu launcher
Delete "$SMPROGRAMS\\Extraterm.lnk"

Delete "$INSTDIR\\*.*"
Delete "$INSTDIR\\Uninstall.exe"
RMDir /r "$INSTDIR"

DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}"
DeleteRegKey HKLM "Software\\Extraterm"

DeleteRegKey HKCU "Software\\Classes\\directory\\Background\\shell\\extraterm"
DeleteRegKey HKCU "Software\\Classes\\directory\\shell\\extraterm"

SectionEnd
`;
echo("----------------------------------------------------------")
echo(installerScript);
echo("----------------------------------------------------------")

  fs.writeFileSync(path.join(BUILD_TMP_DIR, "installer.nsi"), installerScript, {encoding: "utf-8"});
  if (useDocker) {
    exec(`docker run --rm -t -v ${BUILD_TMP_DIR}:/wine/drive_c/src/ cdrx/nsis`);
  } else {
    const prevDir = pwd();
    cd(BUILD_TMP_DIR);
    exec("makensis installer.nsi");
    cd(prevDir);
  }
  return true;
}
