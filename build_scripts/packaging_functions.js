/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('extraterm-uuid');
const readdirp = require('readdirp');
const dependencyPruner = require('./dependency_pruner');
const log = console.log.bind(console);
const fsExtra = require('fs-extra');


const ignoreRegExp = [
  /^\/build_scripts\b/,
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
  /^\/src\/testfiles\b/,
  /^\/node_modules\/@nodegui\/nodegui\/src\//,
];

function addLauncher(versionedOutputDir, platform) {
  echo(`Inserting launcher exe`);

  const launcherDirPath = path.join(versionedOutputDir, "downloads");

  if (platform === "linux") {
    const launcherPath = path.join(launcherDirPath, "linux-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, "extraterm");
    mv(launcherPath, launcherDestPath);
    chmod('a+x', launcherDestPath);
  }

  if (platform === "win32") {
    const launcherPath = path.join(launcherDirPath, "win32-x64/extraterm-launcher.exe");
    mv(launcherPath, path.join(versionedOutputDir, "extraterm.exe"));
  }

  if (platform === "darwin") {
    const launcherPath = path.join(launcherDirPath, "darwin-x64/extraterm-launcher");
    const launcherDestPath = path.join(versionedOutputDir, "Extraterm.app/Contents/MacOS/Extraterm");
    mv(launcherPath, launcherDestPath);
    chmod('a+x', launcherDestPath);
  }
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

  await materializeSymlinks(".");

  pruneDirTreeWithWhitelist("build", [
    /\.node$/
  ]);
  pruneDirTreeWithWhitelist("miniqt", [
    /\.so$/
  ]);

  // TODO: String the library .so files

  await pruneEmptyDirectories("build");
  await pruneEmptyDirectories("miniqt");
  cd(prevDir);
}

async function materializeSymlinks(directoryPath) {
  const filter = entry => entry.stats.isSymbolicLink();
  const allFileEntries = await readdirp.promise(directoryPath, {alwaysStat: true, lstat: true, fileFilter: filter});

  for (const fileEntry of allFileEntries) {
    // echo(`Materializing symlink: ${fileEntry.path}`);
    const contents = fs.readFileSync(fileEntry.fullPath);
    rm(fileEntry.fullPath);
    fs.writeFileSync(fileEntry.fullPath, contents, { mode: fileEntry.stats.mode });
  }
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

async function pruneEmptyDirectories(directoryPath) {
  const dirEntries = await readdirp.promise(directoryPath, { type: "directories", depth: 1 });
  for (const dirEntry of dirEntries) {
    await pruneEmptyDirectories(dirEntry.fullPath);
  }

  const allEntries = await readdirp.promise(directoryPath, { type: "files_directories", depth: 1 });
  if (Array.from(allEntries).length === 0) {
    // echo(`Pruning empty directory: ${directoryPath}`);
    rm('-rf', directoryPath);
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
  pruneDependencyWithWhitelist("node-pty", [
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

/**
 * @param {string} dependencyName
 * @param {(RegExp | string)[]} subpathList
 */
function pruneDependencyWithWhitelist(dependencyName, subpathList) {
  const prevDir = pwd();
  cd("node_modules");
  cd(dependencyName);
  pruneDirTreeWithWhitelist(".", subpathList)
  cd(prevDir);
}

/**
 * @param {string} dir
 * @param {(RegExp | string)[]} subpathList
 */
 function pruneDirTreeWithWhitelist(dir, subpathList) {
  for (const itemPath of find(dir)) {
    if ( ! test('-f', itemPath)) {
      continue;
    }

    if (pathMatchWhitelist(subpathList, itemPath)) {
      // echo(`Keeping: ${itemPath}`);
    } else {
      // echo(`Pruning ${itemPath}`);
      rm(itemPath);
    }
  }
}

/**
 * Match a path against a whilelist.
 *
 * Patterns in the whitelist have the follow rules:
 *
 *   * If it starts with a / then it matches the whole path.
 *   * If it ends with a / then everything under that directory is accepted.
 *   * No slashes in the path, then it matches on the file only.
 *   * Patterns can be regular expressions.
 *
 * @param {(RegExp | string)[]} whitelist List of allowed path patterns.
 * @param {string} testPath
 * @return {boolean} True if the `testPath` is
 */
function pathMatchWhitelist(whitelist, testPath) {
  for (const keepPath of whitelist) {
    if (keepPath instanceof RegExp) {
      if (keepPath.test(testPath)) {
        return true;
      }
    } else if (keepPath.startsWith("/")) {
      if (keepPath.endsWith("/")) {
        if (testPath.startsWith(keepPath.substring(1))) {
          return true;
        }
      } else {
        if (testPath === keepPath.substring(1)) {
          return true;
        }
      }
    } else {
      if (keepPath === path.posix.basename(testPath)) {
        return true;
      }
    }
  }
  return false;
}

exports.pruneDependencyWithWhitelist = pruneDependencyWithWhitelist;


function createOutputDirName({version, platform, arch}) {
  return "extraterm-" + version + "-" + platform + "-" + arch;
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

async function makePackage({ arch, platform, version, outputDir }) {
  log("");
  const SRC_DIR = "" + pwd();

  fixNodeModulesSubProjects();

  // Clean up the output dirs and files first.
  const versionedOutputDir = path.join(outputDir, createOutputDirName({version, platform, arch}));

  if (test('-d', versionedOutputDir)) {
    rm('-rf', versionedOutputDir);
  }

  const outputZip = versionedOutputDir + ".zip";

  echo("Copying source tree to versioned directory...");
  copySourceTree(SRC_DIR, versionedOutputDir);

  const thisCD = pwd();
  cd(outputDir);

  await pruneNodeGui(versionedOutputDir, platform);

  hoistSubprojectsModules(versionedOutputDir, platform);

  // dependencyPruner.pruneDevDependencies(SRC_DIR, versionedOutputDir);
  pruneNodeModules(versionedOutputDir, platform);
  // pruneTwemoji(versionedOutputDir, platform);

  addLauncher(versionedOutputDir, platform);

  // Zip it up.
  log("Zipping up the package");

  if (platform === "linux") {
    cp(path.join(SRC_DIR, "main/resources/extraterm.desktop"), versionedOutputDir);
  }

  const linkOption = process.platform === "win32" ? "" : " -y";
  exec(`zip ${linkOption} -r ${outputZip} ${versionedOutputDir}`);
  cd(thisCD);

  log("App bundle written to " + versionedOutputDir);
  return true;
}

exports.makePackage = makePackage;

/**
 * Copy a source tree.
 *
 * @param {string} sourceDir
 * @param {string} destDir
 * @return {void}
 */
function copySourceTree(sourceDir, destDir) {
  const temp = tempdir();

  const tempPath = path.join(temp, `extraterm-build-${uuid.createUuid()}`);
  mkdir(tempPath);
  echo(`Using tmp dir ${tempPath} during source tree copy.`);

  const ignoreFunc = function ignoreFunc(rawFilePath) {
    const filePath = rawFilePath.substr(sourceDir.length);
    const result = ignoreRegExp.some( (exp) => exp.test(filePath));
    // log(`ignoreFunc filePath: ${filePath} => ${(!result) ? "COPY" : "IGNORE" }`);
    return ! result;
  };

  fsExtra.copySync(sourceDir, tempPath, {filter: ignoreFunc});

  mv(tempPath, destDir);
}