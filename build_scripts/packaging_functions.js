/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');
const fs = require('fs');
const dependencyPruner = require('./dependency_pruner');
const log = console.log.bind(console);
const utilities = require('./packaging_utilities');
const patchQode = require('./patch_qode');
const qtConfig = require("@nodegui/nodegui/config/qtConfig");
const { mv, echo } = require('shelljs');
const { version } = require('os');

const APP_NAME = "extratermqt";
const APP_TITLE = "ExtratermQt";
exports.APP_NAME = APP_NAME;
exports.APP_TITLE = APP_TITLE;

async function makePackage({ arch, platform, version, outputDir }) {
  log("");
  const srcDir = "" + pwd();

  echo(`Making package from '${srcDir}' to output '${outputDir}'`);

  fixNodeModulesSubProjects();

  // Clean up the output dirs and files first.
  const versionedDirName = createOutputDirName({version, platform, arch});
  const versionedOutputDir = path.join(outputDir, versionedDirName);

  if (test('-d', versionedOutputDir)) {
    rm('-rf', versionedOutputDir);
  }

  echo("Copying source tree to versioned directory");
  utilities.copySourceTree(srcDir, versionedOutputDir, ignoreRegExp);

  const thisCD = pwd();
  cd(outputDir);

  await pruneNodeGui(versionedOutputDir, platform);

  hoistSubprojectsModules(versionedOutputDir, platform);

  dependencyPruner.pruneDevDependencies(srcDir, versionedOutputDir);
  pruneNodeModules(versionedOutputDir, platform);
  // pruneTwemoji(versionedOutputDir, platform);
  pruneListFontsJsonExe(versionedOutputDir, platform);


  if (platform === "linux") {
    addLauncher(versionedOutputDir, platform);
    runLinuxDeployQt(srcDir, versionedOutputDir);
  } else if (platform === "win32") {
    addLauncher(versionedOutputDir, platform);
    runWindowsDeployQt(srcDir, versionedOutputDir);
  } else if (platform === "darwin") {
    organizeMacOSBundle(versionedOutputDir, version);
    addLauncher(versionedOutputDir, platform);

    runMacOSDeployQt(srcDir, versionedOutputDir);
  }
  rm("-rf", path.join(versionedOutputDir, "./node_modules/@nodegui/nodegui/miniqt"));

  log("Zipping up the package");

  if (platform === "linux") {
    cp(path.join(srcDir, "main/resources/extraterm.desktop"), path.join(versionedOutputDir, `${APP_NAME}.desktop`));
  }

  const linkOption = process.platform === "win32" ? "" : " -y";
  cd(outputDir);
  const outputZip = versionedDirName + ".zip";
  exec(`zip ${linkOption} -r ${outputZip} ${versionedDirName}`);
  cd(thisCD);

  log("App bundle written to " + versionedOutputDir);
  return true;
}

exports.makePackage = makePackage;


const ignoreRegExp = [
  /^\/build_scripts\b/,
  /^\/extraterm-extension-api\b/,
  /^\/test\b/,
  /^\/build_tmp\b/,
  /^\/src\/typedocs\b/,
  /\.ts$/,
  /\.js\.map$/,
  /^\/\.git\b/,
  /^\/\.git/,
  /^\/\.yarn\b/,
  /^\/\.yarn/,
  /^\/\.vscode$/,
  /^\/azure-pipelines.yml$/,
  /^\/_config\.yml$/,
  /^\/tsconfig\.json$/,
  /^\/yarn\.lock$/,
  /^\/\\.yarn-state.yml$/,
  /^\/docs\b/,
  /^\/tools\b/,
  /^\/main\/src\b/,
  /^\/main\/src$/,
  /^\/resources\/extra_icons\b/,
  /^\/src\/test\b/,
  /^\/src\/testfiles\b/,
  /^\/node_modules\/@nodegui\/nodegui\/src\//,
];

function addLauncher(versionedOutputDir, platform) {
  echo(`Inserting launcher executable`);

  let downloadsDirPath = null;
  if (platform === "linux") {
    downloadsDirPath = path.join(versionedOutputDir, "downloads");
    const launcherPath = path.join(downloadsDirPath, "linux-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, APP_NAME);
    mv(launcherPath, launcherDestPath);
    chmod('a+x', launcherDestPath);
  }

  if (platform === "win32") {
    downloadsDirPath = path.join(versionedOutputDir, "downloads");
    const launcherPath = path.join(downloadsDirPath, "win32-x64", "extraterm-launcher.exe");
    mv(launcherPath, path.join(versionedOutputDir, `${APP_NAME}.exe`));
  }

  if (platform === "darwin") {
    downloadsDirPath = path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/downloads`);
    const launcherPath = path.join(downloadsDirPath, "darwin-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS/${APP_TITLE}`);
    mv(launcherPath, launcherDestPath);
    chmod('a+x', launcherDestPath);
  }

  rm('-rf', downloadsDirPath);
}

function pruneTwemoji(versionedOutputDir, platform) {
  if (platform !== "linux") {
    const twemojiPath = path.join(versionedOutputDir, "main/resources/themes/default/fonts/Twemoji.ttf");
    rm(twemojiPath);
  }
}

async function pruneNodeGui(versionedOutputDir, platform) {
  echo("");
  echo("---------------------------------------------------------------------------");
  echo("Pruning NodeGui");
  echo("");

  const nodeGuiDir = path.join(versionedOutputDir, "node_modules/@nodegui/nodegui");
  const prevDir = pwd();
  cd(nodeGuiDir);

  utilities.pruneDirTreeWithWhitelist("build", [
    /\.node$/
  ]);

  await utilities.pruneEmptyDirectories("build");
  cd(prevDir);
}

function pruneListFontsJsonExe(versionedOutputDir, platform) {
  for (const p of ["darwin", "linux", "win32"]) {
    if (p !== platform) {
      const listFontsJsonPath = path.join(versionedOutputDir,
        `main/resources/list-fonts-json-binary/${p}-x64/`);
      echo(`Deleting ${listFontsJsonPath}`);
      rm('-rf', listFontsJsonPath);
    }
  }
}

function hoistSubprojectsModules(versionedOutputDir, platform) {
  const modulesDir = path.join(versionedOutputDir, "node_modules");
  echo("");
  echo("---------------------------------------------------------------------------");
  echo("Hoisting subproject modules");
  echo("");

  // Delete the symlinks.
  for (const item of ls(modulesDir)) {
    const itemPath = path.join(modulesDir, item);
    if (test('-L', itemPath)) {
      echo(`Deleting symlink ${item} in ${modulesDir}`);
      rm(itemPath);
    } else if (test('-d', itemPath) && item.startsWith('@')) {
      for (const item2 of ls(path.join(modulesDir, item))) {
        const itemPath2 = path.join(modulesDir, item, item2);
        if (test('-L', itemPath2)) {
          echo(`Deleting deeper symlink ${path.join(item, item2)} in ${path.join(modulesDir, item)}`);
          rm(itemPath2);
        }
      }
    }
  }

  // Move the 'packages' subprojects up into this node_modules dir.
  const packagesDir = path.join(versionedOutputDir, "packages");
  for (const item of ls(packagesDir)) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packagesDir, item, "package.json"), {encoding: "utf8"}));
    const destDir = path.join(modulesDir, packageJson.name);
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

  cd(versionedOutputDir);

  pruneNodePty();

  exec("modclean -n default:safe -r");
  pruneSpecificNodeModules();

  cd(prevDir);
}

function pruneSpecificNodeModules() {
  [
    "globule",
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

function pruneNodePty() {
  utilities.pruneDependencyWithWhitelist("node-pty", [
    "node-pty.node",
    "/lib/",
    "/README.md",
    "/LICENSE",
    "/package.json",
    "/build/Release/conpty.node",
    "/build/Release/conpty.pdb",
    "/build/Release/conpty_console_list.node",
    "/build/Release/conpty_console_list.pdb",
    "/build/Release/pty.node",
    "/build/Release/pty.pdb",
    "/build/Release/winpty-agent.exe",
    "/build/Release/winpty-agent.pdb",
    "/build/Release/winpty.dll",
    "/build/Release/winpty.pd",
  ]);
}

function createOutputDirName({version, platform, arch}) {
  return `${APP_NAME}-${version}-${platform}-${arch}`;
}

function fixNodeModulesSubProjects() {
  // yarn just loves to link to this from the root `node_modules` but we
  // don't include `test/*` stuff in the final build, which may result in
  // a broken link.
  const badLinkPath = "node_modules/extraterm-char-render-canvas-test";
  if (test('-L', badLinkPath)) {
    echo(`Deleting bad symlink '${badLinkPath}'`);
    rm(badLinkPath);
  }
}

exports.createOutputDirName = createOutputDirName;

/**
 * @param {string} srcDir
 * @param {string} versionedOutputDir
 */
function runLinuxDeployQt(srcDir, versionedOutputDir) {
  echo("");
  echo("---------------------------------------------------------------------------");
  echo("Deploy Qt");
  echo("");

  const prevDir = pwd();
  cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const LD_LIBRARY_PATH=`${qtHome}/lib:${process.env.LD_LIBRARY_PATH || ""}`;

  mv(path.join(versionedOutputDir, "./node_modules/@nodegui/qode/binaries/qode"), versionedOutputDir);

  const nodeBinaryModules = ls("**/*.node").filter(m => ! m.endsWith("pty.node"));

  const deployCommand = [path.resolve(srcDir, `downloads/linux-x64/linuxdeployqt-x86_64.AppImage`),
                        `qode`,
                        `-verbose=2`,
                        `-qmake=${path.resolve(qtHome, "bin", "qmake")}`,
                        nodeBinaryModules.map(x => `-executable=${x.toString()}`).join(" ")
                      ].join(" ");

  echo(deployCommand);
  exec(deployCommand, { env: {...process.env, LD_LIBRARY_PATH} });

  writeQodeJson(versionedOutputDir);

  // TODO: Strip the library .so and qode files

  rm(`AppRun`);

  cd(prevDir);
}

/**
 * @param {string} versionedOutputDir
 */
function writeQodeJson(versionedOutputDir) {
  const qodeJson = {
    distPath: "main/dist/main.js"
  };
  fs.writeFileSync(path.join(versionedOutputDir, "qode.json"), JSON.stringify(qodeJson), {encoding: "utf8"});
}

/**
 * @param {string} srcDir
 * @param {string} versionedOutputDir
 */
function runWindowsDeployQt(srcDir, versionedOutputDir) {
  echo("");
  echo("---------------------------------------------------------------------------");
  echo("Deploy Qt");
  echo("");

  const prevDir = pwd();
  cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const winDeployQtBin = path.resolve(qtHome, "bin", "windeployqt.exe");
  process.env.PATH=`${path.resolve(qtHome, "bin")};${process.env.PATH}`;

  mv(path.join(versionedOutputDir, "./node_modules/@nodegui/qode/binaries/qode.exe"), versionedOutputDir);

  const nodeBinaryModules = ls("**/*.node").filter(m => ! m.endsWith("pty.node"));

  const deployCommand = [
      winDeployQtBin,
      '--verbose=2',
      '--release',
      '--no-translations',
      '--compiler-runtime',
      `--dir=${versionedOutputDir}`,
      'qode.exe',
      ...nodeBinaryModules
    ].join(" ");
  echo(deployCommand);
  exec(deployCommand, { env: process.env });

  writeQodeJson(versionedOutputDir);

  patchQode.switchToGuiSubsystem("qode.exe");

  cd(prevDir);
}

/**
 * @param {string} versionedOutputDir
 * @param {string} version
 */
function organizeMacOSBundle(versionedOutputDir, version) {
  const tmpResourcesDir  = path.join(versionedOutputDir, "../Resources");
  echo(`mv(${versionedOutputDir},${tmpResourcesDir})`);
  mv(versionedOutputDir, tmpResourcesDir);
  const contentsPath = path.join(versionedOutputDir, `${APP_TITLE}.app`, `Contents`);
  echo(`mkdir(${contentsPath})`);
  mkdir('-p', contentsPath);
  echo(`mv(${tmpResourcesDir}, ${contentsPath})`);
  mv(tmpResourcesDir, contentsPath + "/");
  mkdir('-p', path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS`));

  mv(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/main/resources/logo/extraterm_small_logo.icns`),
    path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/extraterm.icns`));

  const plistContents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDisplayName</key>
    <string>${APP_TITLE}</string>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>${APP_TITLE}</string>
    <key>CFBundleIdentifier</key>
    <string>org.extraterm.${APP_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>extraterm.icns</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${APP_TITLE}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>CFBundleSupportedPlatforms</key>
    <array>
      <string>MacOSX</string>
    </array>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2022 Simon Edwards</string>
    <key>NSHighResolutionCapable</key>
    <string>True</string>
  </dict>
</plist>
`;
  fs.writeFileSync(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Info.plist`), plistContents,
    {encoding: 'utf8'});
}

/**
 * @param {string} srcDir
 * @param {string} versionedOutputDir
 */
function runMacOSDeployQt(srcDir, versionedOutputDir) {
  echo("");
  echo("---------------------------------------------------------------------------");
  echo("Deploy Qt");
  echo("");

  const prevDir = pwd();
  cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const macDeployQtBin = path.resolve(qtHome, "bin", "macdeployqt");
  process.env.PATH=`${path.resolve(qtHome, "bin")};${process.env.PATH}`;

  mv(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/qode/binaries/qode`),
    path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS/qode`));

  const nodeBinaryModules = ls("**/*.node");

  const deployCommand = [
      macDeployQtBin,
      `${APP_TITLE}.app`,
      '-verbose=2',
      `-libpath=${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/nodegui/miniqt/5.14.1/clang_64`,
      `-executable=${APP_TITLE}.app/Contents/MacOS/qode`,
      ...nodeBinaryModules.map(b => `-executable=${b}`)
    ].join(" ");
  echo(deployCommand);
  exec(deployCommand, { env: process.env });
  
  // The libraries in here were copied by `macdeployqt`
  rm('-rf', path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/nodegui/miniqt`));

  cd(prevDir);
}
