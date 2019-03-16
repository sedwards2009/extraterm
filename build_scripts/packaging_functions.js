/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');
const fs = require('fs');
const packager = require('electron-packager');
const dependencyPruner = require('./dependency_pruner');
const log = console.log.bind(console);
const MODULE_VERSON = 69; // This version number also appears in thememanager.ts

const ignoreRegExp = [
  /^\/build_scripts\b/,
  /^\/extraterm-web-component-decorators\b/,
  /^\/extraterm-extension-api\b/,
  /^\/test\b/,
  /^\/build_tmp\b/,
  /^\/src\/typedocs\b/,
  /\.ts$/,
  /\.js\.map$/,
  /^\/\.git\//,
  /^\/docs\b/,
  /^\/resources\/extra_icons\b/,
  /^\/src\/test\b/,
  /^\/src\/testfiles\b/
];

const ignoreFunc = function ignoreFunc(filePath) {
  const result = ignoreRegExp.some( (exp) => exp.test(filePath));
  return result;
};

function appDir(platform) {
  return platform === "darwin" ? "Extraterm.app/Contents/Resources/app" : "resources/app";
}

function pruneNodeSass(versionedOutputDir, arch, platform) {
  const gutsDir = appDir(platform);
  const nodeSassVendorDir = path.join(versionedOutputDir, gutsDir, "node_modules/node-sass/vendor");

  rm('-rf', nodeSassVendorDir);
  
  const nodeSassBinaryDir = path.join(versionedOutputDir, gutsDir, "src/node-sass-binary");
  ["darwin-x64", "linux-ia32", "linux-x64", "win32-x64"].forEach( (name) => {
    if (name !== platform + "-" + arch) {
      rm('-rf', path.join(nodeSassBinaryDir, name + "-" + MODULE_VERSON));
    }
  });
}

function pruneEmojiOne(versionedOutputDir, platform) {
  if (platform !== "linux") {
    const emojiOnePath = path.join(versionedOutputDir, appDir(platform), "extraterm/resources/themes/default/emojione-android.ttf");
    rm(emojiOnePath);
  }
}

function hoistSubprojectsModules(versionedOutputDir, platform) {
  const modulesDir = path.join(versionedOutputDir, appDir(platform), "node_modules");

  // Delete the symlinks.
  for (const item of ls(modulesDir)) {
    const itemPath = path.join(modulesDir, item);
    if (test('-L', itemPath)) {
      echo(`Deleting symlink ${item} in ${modulesDir}`);
      rm(itemPath);
    }
  }

  // Move the 'packages' subprojects up into this node_modules dir.
  const packagesDir = path.join(versionedOutputDir, appDir(platform), "packages");
  for (const item of ls(packagesDir)) {
    const destDir = path.join(modulesDir, item);
    echo(`Moving ${item} in to ${destDir}`);
    mv(path.join(packagesDir, item), destDir);
    const binDirPath = path.join(destDir, "node_modules", ".bin");
    if (fs.existsSync(binDirPath)) {
      rm('-rf', binDirPath);
    }
  }
}

function pruneNodeModules(versionedOutputDir, platform) {
  const prevDir = pwd();
  
  cd(path.join(versionedOutputDir, appDir(platform)));
  exec("modclean -n default:safe -r");
  pruneSpecificNodeModules();

  cd(prevDir);
}

function pruneSpecificNodeModules() {
  [
    "node-sass/src",
    "node-sass/node_modules/node-gyp",
    "node-sass/vendor",
    "globule",
    "vue/src",
    "vue/dist/vue.esm.browser.js",
    "vue/dist/vue.esm.js",
    "vue/dist/vue.js",
    "vue/dist/vue.min.js",
    "vue/dist/vue.runtime.esm.js",
    "vue/dist/vue.runtime.js",
    "vue/dist/vue.runtime.min.js",
    ".bin"
  ].forEach( (subpath) => {
    const fullPath = path.join("node_modules", subpath);

    echo("Deleting " + fullPath);

    if (test('-d', fullPath)) {
      rm('-rf', fullPath);
    } else if (test('-f', fullPath)) {
        rm(fullPath);
    } else {
      echo("Warning: Unable to find path "+ fullPath);
    }
  });

}

async function makePackage({ arch, platform, electronVersion, version, outputDir, replaceModuleDirs }) {
  log("");
  const SRC_DIR = "" + pwd();

  // Clean up the output dirs and files first.
  const versionedOutputDir = "extraterm-" + version + "-" + platform + "-" + arch;
  if (test('-d', versionedOutputDir)) {
    rm('-rf', versionedOutputDir);
  }
  
  const outputZip = path.join(outputDir, versionedOutputDir + ".zip");

  const packagerOptions = {
    arch: arch,
    dir: ".",
    platform: platform,
    version: electronVersion,
    ignore: ignoreFunc,
    name: platform === "darwin" ? "Extraterm" : "extraterm",
    overwrite: true,
    out: outputDir,
    prune: false
  };
  if (platform === "win32") {
    packagerOptions.icon = "extraterm/resources/logo/extraterm_small_logo.ico";
    packagerOptions.win32metadata = {
      FileDescription: "Extraterm",
      ProductName: "Extraterm",
      LegalCopyright: "(C) 2019 Simon Edwards"
    };
  } else if (platform === "darwin") {
    packagerOptions.icon = "extraterm/resources/logo/extraterm_small_logo.icns";
  }

  const appPath = await packager(packagerOptions);

  // Rename the output dir to a one with a version number in it.
  mv(appPath[0], path.join(outputDir, versionedOutputDir));
  
  const targetAppRootPath = platform === "darwin"
                    ? "Extraterm.app/Contents/Resources/app"
                    : "resources/app";
  const dirsDest = path.join(outputDir, versionedOutputDir, targetAppRootPath, "node_modules");
  const dirsSource = path.join("" + SRC_DIR,`build_scripts/node_modules-${platform}-${arch}`);

  if(replaceModuleDirs) {
    replaceDirs(dirsDest, dirsSource);
  }

  const thisCD = pwd();
  cd(outputDir);

  hoistSubprojectsModules(versionedOutputDir, platform);
  pruneNodeModules(versionedOutputDir, platform);
  dependencyPruner.pruneDevDependencies(SRC_DIR, path.join(outputDir, versionedOutputDir, targetAppRootPath));

  // Prune any unneeded node-sass binaries.
  pruneNodeSass(versionedOutputDir, arch, platform);
  pruneEmojiOne(versionedOutputDir, platform);

  // Zip it up.
  log("Zipping up the package");

  mv(path.join(versionedOutputDir, "LICENSE"), path.join(versionedOutputDir, "LICENSE_electron.txt"));
  cp(path.join(SRC_DIR, "README.md"), versionedOutputDir);
  cp(path.join(SRC_DIR, "LICENSE.txt"), versionedOutputDir);
  
  const linkOption = process.platform === "win32" ? "" : " -y";
  exec(`zip ${linkOption} -r ${outputZip} ${versionedOutputDir}`);
  cd(thisCD);
  
  log("App bundle written to " + versionedOutputDir);
  return true;
}

function replaceDirs(targetDir, replacementsDir) {
  const replacements = ls(replacementsDir);
  replacements.forEach( (rDir) => {
    const targetSubDir = path.join(targetDir, rDir);
    if (test('-d', targetSubDir)) {
      rm('-r', targetSubDir);
    }
    cp('-r', path.join(replacementsDir, rDir), targetSubDir);
  });
}

exports.makePackage = makePackage;

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

exports.makeNsis = makeNsis;
