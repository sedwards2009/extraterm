/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const getRepoInfo = require('git-repo-info');
const makePackage = require('./packaging_functions').makePackage;

const log = console.log.bind(console);

async function main() {
  "use strict";
  
  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }

  const linuxZipOnly = process.argv.indexOf("--linux-zip-only") !== -1;
  
  const ROOT_SRC_DIR = "" + pwd();
  const BUILD_TMP_DIR = path.join(ROOT_SRC_DIR, 'build_tmp');
  if (test('-d', BUILD_TMP_DIR)) {
    rm('-rf', BUILD_TMP_DIR);
  }
  mkdir(BUILD_TMP_DIR);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);

  const gitUrl = exec("git config --get remote.origin.url").trim();
  const info = getRepoInfo();

  echo("Fetching a clean copy of the source code from " + gitUrl);

  cd(BUILD_TMP_DIR);
  
  exec("git clone -b " + info.branch + " " + gitUrl);
  cd("extraterm");
  const SRC_DIR = "" + pwd();
  cd(SRC_DIR);

  echo("Setting up the run time dependencies in " + SRC_DIR);

  exec("yarn install");
  exec("yarn run electron-rebuild");
  exec("yarn run build");

  echo("Removing development dependencies");
  exec("yarn install --production=true");

  const version = packageData.version;

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + version;
  cp("-r", "extraterm/src/commands", path.join(BUILD_TMP_DIR, commandsDir));
  cd(BUILD_TMP_DIR);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(SRC_DIR);

  const electronVersion = packageData.devDependencies['electron'];

  function makeDmg() {
    echo("");
    echo("---------------------------------------------------");
    echo("Building dmg file for macOS");
    echo("---------------------------------------------------");

    const darwinPath = path.join(BUILD_TMP_DIR, `extraterm-${packageData.version}-darwin-x64`);
    for (const f of ls(darwinPath)) {
      if ( ! f.endsWith(".app")) {
        echo(`Deleting ${f}`);
        rm(path.join(darwinPath, f));
      }
    }

    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.DS_Store"), path.join(darwinPath, ".DS_Store"));
    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.VolumeIcon.icns"), path.join(darwinPath, ".VolumeIcon.icns"));
    mkdir(path.join(darwinPath,".background"));
    cp(path.join(ROOT_SRC_DIR, "build_scripts/resources/macos/.background/extraterm_background.png"), path.join(darwinPath, ".background/extraterm_background.png"));

    ln("-s", "/Applications", path.join(darwinPath, "Applications"));

    exec(`docker run --rm -v "${BUILD_TMP_DIR}:/files" sporsh/create-dmg Extraterm /files/extraterm-${packageData.version}-darwin-x64/ /files/extraterm_${packageData.version}.dmg`);
    return true;
  }

  function makeNsis() {
    echo("");
    echo("---------------------------------------------------");
    echo("Building NSIS based installer for Windows");
    echo("---------------------------------------------------");

    const windowsBuildDirName = `extraterm-${packageData.version}-win32-x64`;
    const versionSplit = packageData.version.split(".");
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
OutFile "extraterm-setup-${packageData.version}.exe"
InstallDir "$PROGRAMFILES64\\Extraterm"
InstallDirRegKey HKLM "Software\\Extraterm" "InstallLocation"

ShowInstDetails show # This will always show the installation details.

Section "Extraterm"
  SetOutPath $INSTDIR
  File /r "${windowsBuildDirName}\\*"

  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  createShortCut "$SMPROGRAMS\\Extraterm.lnk" "$INSTDIR\\extraterm.exe" "" "$INSTDIR\\resources\\app\\extraterm\\resources\\logo\\extraterm_small_logo.ico"

  WriteRegStr HKLM "Software\\Extraterm" "InstallLocation" "$\\"$INSTDIR$\\""
  WriteRegStr HKLM "Software\\Extraterm" "Version" "${packageData.version}"

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

SectionEnd


Section "Uninstall"
  # Remove Start Menu launcher
	Delete "$SMPROGRAMS\\Extraterm.lnk"

  Delete "$INSTDIR\\*.*"
  Delete "$INSTDIR\\Uninstall.exe"
  RMDir /r "$INSTDIR"

  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\\${APPNAME}"
  DeleteRegKey HKLM "Software\\Extraterm"
SectionEnd  
`;
    fs.writeFileSync(path.join(BUILD_TMP_DIR, "installer.nsi"), installerScript, {encoding: "utf-8"});

    exec(`docker run --rm -t -v ${BUILD_TMP_DIR}:/wine/drive_c/src/ cdrx/nsis`);
    return true;
  }

  if (linuxZipOnly) {
    await makePackage( {
      arch: "x64",
      platform: "linux",
      electronVersion,
      version,
      outputDir: BUILD_TMP_DIR,
      replaceModuleDirs: true
    });
    log("Done");
  } else {
    if (! await makePackage( {
          arch: "x64",
          platform: "win32",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }
    
    if (! await makePackage( {
          arch: "x64",
          platform: "linux",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! await makePackage( {
          arch: "x64",
          platform: "darwin",
          electronVersion,
          version,
          outputDir: BUILD_TMP_DIR,
          replaceModuleDirs: true
        })) {
      return;
    }

    if (! makeDmg()) {
      return;
    }

    if (! makeNsis()) {
      return;
    }
    log("Done");
  }
}

main();
