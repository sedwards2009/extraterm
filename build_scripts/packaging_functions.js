/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sh from 'shelljs';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { version } from 'node:os';
import * as qtConfig from "@nodegui/nodegui/config/qtConfig.js";

import * as dependencyPruner from './dependency_pruner.js';
import * as utilities from './packaging_utilities.js';
import * as patchQode from './patch_qode.js';

const log = console.log.bind(console);

export const APP_NAME = "extratermqt";
export const APP_TITLE = "ExtratermQt";

export async function makePackage({ arch, platform, version, outputDir }) {
  log("");
  const srcDir = "" + sh.pwd();

  sh.echo(`Making package from '${srcDir}' to output '${outputDir}'`);

  fixNodeModulesSubProjects();

  // Clean up the output dirs and files first.
  const versionedDirName = createOutputDirName({version, platform, arch});
  const versionedOutputDir = path.join(outputDir, versionedDirName);

  if (sh.test('-d', versionedOutputDir)) {
    sh.rm('-rf', versionedOutputDir);
  }

  sh.echo("Copying source tree to versioned directory");
  utilities.copySourceTree(srcDir, versionedOutputDir, ignoreRegExp);

  const thisCD = sh.pwd();
  sh.cd(outputDir);

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
  sh.rm("-rf", path.join(versionedOutputDir, "./node_modules/@nodegui/nodegui/miniqt"));

  log("Zipping up the package");

  if (platform === "linux") {
    sh.cp(path.join(srcDir, "main/resources/extraterm.desktop"), path.join(versionedOutputDir, `${APP_NAME}.desktop`));
  }

  const linkOption = process.platform === "win32" ? "" : " -y";
  sh.cd(outputDir);
  const outputZip = versionedDirName + ".zip";
  sh.exec(`zip ${linkOption} -r ${outputZip} ${versionedDirName}`);
  sh.cd(thisCD);

  log("App bundle written to " + versionedOutputDir);
  return true;
}


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
  sh.echo(`Inserting launcher executable`);

  let downloadsDirPath = null;
  if (platform === "linux") {
    downloadsDirPath = path.join(versionedOutputDir, "downloads");
    const launcherPath = path.join(downloadsDirPath, "linux-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, APP_NAME);
    sh.mv(launcherPath, launcherDestPath);
    sh.chmod('a+x', launcherDestPath);
  }

  if (platform === "win32") {
    downloadsDirPath = path.join(versionedOutputDir, "downloads");
    const launcherPath = path.join(downloadsDirPath, "win32-x64", "extraterm-launcher.exe");
    sh.mv(launcherPath, path.join(versionedOutputDir, `${APP_NAME}.exe`));
  }

  if (platform === "darwin") {
    downloadsDirPath = path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/downloads`);
    const launcherPath = path.join(downloadsDirPath, "darwin-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS/${APP_TITLE}`);
    sh.mv(launcherPath, launcherDestPath);
    sh.chmod('a+x', launcherDestPath);
  }

  sh.rm('-rf', downloadsDirPath);
}

function pruneTwemoji(versionedOutputDir, platform) {
  if (platform !== "linux") {
    const twemojiPath = path.join(versionedOutputDir, "main/resources/themes/default/fonts/Twemoji.ttf");
    sh.rm(twemojiPath);
  }
}

async function pruneNodeGui(versionedOutputDir, platform) {
  sh.echo("");
  sh.echo("---------------------------------------------------------------------------");
  sh.echo("Pruning NodeGui");
  sh.echo("");

  const nodeGuiDir = path.join(versionedOutputDir, "node_modules/@nodegui/nodegui");
  const prevDir = sh.pwd();
  sh.cd(nodeGuiDir);

  utilities.pruneDirTreeWithWhitelist("build", [
    /\.node$/
  ]);

  await utilities.pruneEmptyDirectories("build");
  sh.cd(prevDir);
}

function pruneListFontsJsonExe(versionedOutputDir, platform) {
  for (const p of ["darwin", "linux", "win32"]) {
    if (p !== platform) {
      const listFontsJsonPath = path.join(versionedOutputDir,
        `main/resources/list-fonts-json-binary/${p}-x64/`);
      sh.echo(`Deleting ${listFontsJsonPath}`);
      sh.rm('-rf', listFontsJsonPath);
    }
  }
}

function hoistSubprojectsModules(versionedOutputDir, platform) {
  const modulesDir = path.join(versionedOutputDir, "node_modules");
  sh.echo("");
  sh.echo("---------------------------------------------------------------------------");
  sh.echo("Hoisting subproject modules");
  sh.echo("");

  // Delete the symlinks.
  for (const item of sh.ls(modulesDir)) {
    const itemPath = path.join(modulesDir, item);
    if (sh.test('-L', itemPath)) {
      sh.echo(`Deleting symlink ${item} in ${modulesDir}`);
      sh.rm(itemPath);
    } else if (sh.test('-d', itemPath) && item.startsWith('@')) {
      for (const item2 of sh.ls(path.join(modulesDir, item))) {
        const itemPath2 = path.join(modulesDir, item, item2);
        if (sh.test('-L', itemPath2)) {
          sh.echo(`Deleting deeper symlink ${path.join(item, item2)} in ${path.join(modulesDir, item)}`);
          sh.rm(itemPath2);
        }
      }
    }
  }

  // Move the 'packages' subprojects up into this node_modules dir.
  const packagesDir = path.join(versionedOutputDir, "packages");
  for (const item of sh.ls(packagesDir)) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(packagesDir, item, "package.json"), {encoding: "utf8"}));
    const destDir = path.join(modulesDir, packageJson.name);
    sh.echo(`Moving ${item} in to ${destDir}`);
    sh.mv(path.join(packagesDir, item), destDir);
    const binDirPath = path.join(destDir, "node_modules", ".bin");
    if (fs.existsSync(binDirPath)) {
      sh.rm('-rf', binDirPath);
    }
  }
}

function pruneNodeModules(versionedOutputDir, platform) {
  const prevDir = sh.pwd();

  sh.cd(versionedOutputDir);

  pruneNodePty();

  sh.exec("modclean -n default:safe -r");
  pruneSpecificNodeModules();

  sh.cd(prevDir);
}

function pruneSpecificNodeModules() {
  [
    "globule",
    ".bin"
  ].forEach( (subpath) => {
    const fullPath = path.join("node_modules", subpath);

    sh.echo("Deleting " + fullPath);

    if (sh.test('-d', fullPath)) {
      sh.rm('-rf', fullPath);
    } else if (sh.test('-f', fullPath)) {
      sh.rm(fullPath);
    } else {
      sh.echo("Warning: Unable to find path "+ fullPath);
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

export function createOutputDirName({version, platform, arch}) {
  return `${APP_NAME}-${version}-${platform}-${arch}`;
}

function fixNodeModulesSubProjects() {
  // yarn just loves to link to this from the root `node_modules` but we
  // don't include `test/*` stuff in the final build, which may result in
  // a broken link.
  const badLinkPath = "node_modules/extraterm-char-render-canvas-test";
  if (sh.test('-L', badLinkPath)) {
    sh.echo(`Deleting bad symlink '${badLinkPath}'`);
    sh.rm(badLinkPath);
  }
}

/**
 * @param {string} srcDir
 * @param {string} versionedOutputDir
 */
function runLinuxDeployQt(srcDir, versionedOutputDir) {
  sh.echo("");
  sh.echo("---------------------------------------------------------------------------");
  sh.echo("Deploy Qt");
  sh.echo("");

  const prevDir = sh.pwd();
  sh.cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const LD_LIBRARY_PATH=`${qtHome}/lib:${process.env.LD_LIBRARY_PATH || ""}`;

  sh.mv(path.join(versionedOutputDir, "./node_modules/@nodegui/qode/binaries/qode"), versionedOutputDir);

  const nodeBinaryModules = sh.ls("**/*.node").filter(m => ! m.endsWith("pty.node"));

  const deployCommand = [path.resolve(srcDir, `downloads/linux-x64/linuxdeployqt-x86_64.AppImage`),
                        `qode`,
                        `-verbose=2`,
                        `-qmake=${path.resolve(qtHome, "bin", "qmake")}`,
                        nodeBinaryModules.map(x => `-executable=${x.toString()}`).join(" ")
                      ].join(" ");

  sh.echo(deployCommand);
  sh.exec(deployCommand, { env: {...process.env, LD_LIBRARY_PATH} });

  writeQodeJson(versionedOutputDir);

  // TODO: Strip the library .so and qode files

  sh.rm(`AppRun`);

  sh.cd(prevDir);
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
  sh.echo("");
  sh.echo("---------------------------------------------------------------------------");
  sh.echo("Deploy Qt");
  sh.echo("");

  const prevDir = sh.pwd();
  sh.cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const winDeployQtBin = path.resolve(qtHome, "bin", "windeployqt.exe");
  process.env.PATH=`${path.resolve(qtHome, "bin")};${process.env.PATH}`;

  sh.mv(path.join(versionedOutputDir, "./node_modules/@nodegui/qode/binaries/qode.exe"), versionedOutputDir);

  const nodeBinaryModules = sh.ls("**/*.node").filter(m => ! m.endsWith("pty.node"));

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
  sh.echo(deployCommand);
  sh.exec(deployCommand, { env: process.env });

  writeQodeJson(versionedOutputDir);

  patchQode.switchToGuiSubsystem("qode.exe");

  sh.cd(prevDir);
}

/**
 * @param {string} versionedOutputDir
 * @param {string} version
 */
function organizeMacOSBundle(versionedOutputDir, version) {
  const tmpResourcesDir  = path.join(versionedOutputDir, "../Resources");
  sh.echo(`mv(${versionedOutputDir},${tmpResourcesDir})`);
  sh.mv(versionedOutputDir, tmpResourcesDir);
  const contentsPath = path.join(versionedOutputDir, `${APP_TITLE}.app`, `Contents`);
  sh.echo(`mkdir(${contentsPath})`);
  sh.mkdir('-p', contentsPath);
  sh.echo(`mv(${tmpResourcesDir}, ${contentsPath})`);
  sh.mv(tmpResourcesDir, contentsPath + "/");
  sh.mkdir('-p', path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS`));

  sh.mv(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/main/resources/logo/extraterm_small_logo.icns`),
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
  sh.echo("");
  sh.echo("---------------------------------------------------------------------------");
  sh.echo("Deploy Qt");
  sh.echo("");

  const prevDir = sh.pwd();
  sh.cd(versionedOutputDir);

  const qtHome = qtConfig.qtHome;
  const macDeployQtBin = path.resolve(qtHome, "bin", "macdeployqt");
  process.env.PATH=`${path.resolve(qtHome, "bin")};${process.env.PATH}`;

  sh.mv(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/qode/binaries/qode`),
    path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/MacOS/qode`));

  const nodeBinaryModules = sh.ls("**/*.node");

  const deployCommand = [
      macDeployQtBin,
      `${APP_TITLE}.app`,
      '-verbose=2',
      `-libpath=${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/nodegui/miniqt/5.14.1/clang_64`,
      `-executable=${APP_TITLE}.app/Contents/MacOS/qode`,
      ...nodeBinaryModules.map(b => `-executable=${b}`)
    ].join(" ");
  sh.echo(deployCommand);
  sh.exec(deployCommand, { env: process.env });

  // The libraries in here were copied by `macdeployqt`
  sh.rm('-rf', path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/node_modules/@nodegui/nodegui/miniqt`));

  sh.cd(prevDir);
}
