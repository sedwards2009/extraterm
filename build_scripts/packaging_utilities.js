/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fsExtra = require('fs-extra');
const path = require('path');
const os = require('os');
const uuid = require('extraterm-uuid');
const readdirp = require('readdirp');

const log = console.log.bind(console);

/**
 * Copy a source tree.
 *
 * @param {string} sourceDir
 * @param {string} destDir
 * @param {RegExp[]} ignoreRegExp
 * @return {void}
 */
function copySourceTree(sourceDir, destDir, ignoreRegExp) {
  // We don't use tempdir() or similar, instead we use a dir next to the source tree.
  // In some environments a temp dir will be on a different filesystem and that will
  // fail the `mv()` at the end of this function.
  const tempPath = path.join(sourceDir, `../extraterm-build-${uuid.createUuid()}`);

  mkdir(tempPath);
  echo(`Using tmp dir ${tempPath} during source tree copy.`);

  const ignoreFunc = function ignoreFunc(rawFilePath) {
    const filePath = rawFilePath.substr(sourceDir.length).replaceAll("\\", "/");
    const result = ignoreRegExp.some( (exp) => exp.test(filePath));
    // log(`ignoreFunc filePath: ${filePath} => ${(!result) ? "COPY" : "IGNORE" }`);
    return ! result;
  };

  fsExtra.copySync(sourceDir, tempPath, {filter: ignoreFunc});
  mv(tempPath, destDir);
}
exports.copySourceTree = copySourceTree;

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
exports.pruneDirTreeWithWhitelist = pruneDirTreeWithWhitelist;

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

/**
 * @param {string} directoryPath
 * @return {void}
 */
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
exports.pruneEmptyDirectories = pruneEmptyDirectories;

/**
 * @param {string} directoryPath
 * @return {void}
 */
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

exports.materializeSymlinks = materializeSymlinks;
