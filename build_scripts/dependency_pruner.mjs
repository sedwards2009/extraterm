/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sh from 'shelljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import lockfileParser from '@yarnpkg/parsers';


/**
 * Prune away yarn development dependencies
 *
 * Prunes development dependencies from a node project with help from
 * yarn's lock file.
 *
 * @param {string} sourceRootPath Path to the source code root directory which contains
 *                                the root package.json file and the yarn.lock file.
 * @param {string} targetPath     Path to the target directory which contains the built
 *                                project whose dependencies need to be pruned.
 */
export function pruneDevDependencies(sourceRootPath, targetPath) {
  sh.echo("");
  sh.echo("Pruning Yarn dev dependencies");
  sh.echo("=============================");
  sh.echo("");

  const keepPrune = computeKeepAndPrunePackages(sourceRootPath);
  // dumpKeepPrune(keepPrune);
  const pruneDepNameMap = new Map();  // Map<string, Dependency[]>
  for (const dep of keepPrune.prune) {
    if (pruneDepNameMap.get(dep.package) == null) {
      pruneDepNameMap.set(dep.package, [])
    }
    pruneDepNameMap.get(dep.package).push(dep);
  }

  const pkg = readPackageJson(path.join(sourceRootPath, "package.json"));
  let pruneCount = 0;
  for (const p of [".", ...pkg.workspaces.packages]) {
    let nodeModulesPathList = [];
    try {
      nodeModulesPathList = sh.ls('-d', path.join(targetPath, p))
    } catch(ex) {
    }

    for (const nodeModulesPath of nodeModulesPathList) {
       pruneCount += pruneNodeModulesDir(pruneDepNameMap, nodeModulesPath);
    }
  }

  for (const p of [".", ...pkg.workspaces.packages]) {
    let nodeModulesPathList = [];
    try {
      nodeModulesPathList = sh.ls('-d', path.join(targetPath, p))
    } catch(ex) {
    }

    for (const nodeModulesPath of nodeModulesPathList) {
      pruneBrokenBinLinks(nodeModulesPath);
    }
  }

  sh.echo("");
  sh.echo(`    Total modules in yarn.lock:     ${keepPrune.keep.length + keepPrune.prune.length}`);
  sh.echo(`    Modules identified for keeping: ${keepPrune.keep.length}`);
  sh.echo(`    Modules identified for pruning: ${keepPrune.prune.length}`);
  sh.echo(`    Module directories deleted:     ${pruneCount}`);
}

/**
 * @typedef { {[depName: string]: Yarn2LockDep; } Yarn2Lock
 */

/**
 * @typedef {Object} Yarn2LockDep
 * @param {string} version
 * @param {{ [depName: string]: string; }=} dependencies
 * @param {{ [depName: string]: string; }=} optionalDependencies
}

/**
 * @param {string} sourceRootPath
 * @return {Yarn2Lock}
 */
function readYarnLock(sourceRootPath) {
  const fileContents = fs.readFileSync(path.join(sourceRootPath, 'yarn.lock'), 'utf8');
  const contents = lockfileParser.parseSyml(fileContents);

  for (const key of Object.getOwnPropertyNames(contents)) {
    const parts = key.split(', ');
    if (parts.length > 1) {
      for (const p of parts) {
        contents[p] = contents[key];
      }
      // delete contents[key];
    }
  }
  return contents;
}

/**
 * @param {string} pkgPath
 */
function readPackageJson(pkgPath) {
  const pkgString = fs.readFileSync(pkgPath, "utf8");
  return JSON.parse(pkgString);
}

/**
 * @typedef {Object} Dependency
 * @property {string} package
 * @property {string} version
*/

/**
 * @return {Dependency[]}
 */
function objectToDependencyList(dependencies, resolutions) {
  const result = [];
  for (const key in dependencies) {
    const version = resolutions[key] ?? dependencies[key];
    result.push( { package: key, version } );
  }
  return result;
}

/**
 * @param {string} pkgPath
 * @param {object} resolutions Dependency resolutions mapping a dep name to a forced version.
 * @return {Dependency[]}
 */
function readPrimaryDependencies(pkgPath, resolutions) {
  const pkg = readPackageJson(pkgPath);
  let deps = objectToDependencyList(pkg.dependencies, resolutions);
  if (pkg.optionalDependencies !== undefined) {
    deps = [...deps, ...objectToDependencyList(pkg.optionalDependencies, resolutions)];
  }
  return deps;
}

/**
 * @param {object} package JSON
 * @param {string} sourceRootPath
 * @return {Dependency[]}
 */
function findPrimaryDependencies(pkg, sourceRootPath) {
  const resolutions = pkg.resolutions == null ? {} : pkg.resolutions;

  if (pkg.workspaces == null) {
    throw new Error("package.json doesn't have a 'workspaces' key.");
  }
  if (pkg.workspaces.packages == null) {
    throw new Error("package.json doesn't have a 'workspaces.packages' key.");
  }

  let depsList = [];
  for (const p of [".", ...pkg.workspaces.packages]) {
    for (const pkgPath of sh.ls(path.join(sourceRootPath, p, "package.json"))) {
      depsList = [...depsList, ...readPrimaryDependencies(pkgPath, resolutions)];
    }
  }
  return depsList;
}

/**
 * @param {Yarn2Lock} yarnLock
 * @param { {[key: string]: number} } useCount
 * @param {Dependency} dependency
 */
function markUsedDependency(yarnLock, useCount, dependency, resolutions) {
  const depString = `${dependency.package}@npm:${dependency.version}`;

  const yarnDep = yarnLock[depString];
  if (yarnDep == null) {
    sh.echo(`Warning: Couldn't find ${depString} in yarn.lock to mark. Skipping.`);
  } else {

    const usedDepString = `${dependency.package}@${yarnDep.version}`;

    // echo(`${depString} -> ${usedDepString}`);

    if (useCount[usedDepString] == null) {
      useCount[usedDepString] = 1;
    } else {
      useCount[usedDepString]++;
    }

    if (yarnDep.dependencies != null) {
      markUsedDependencyList(yarnLock, useCount,
        objectToDependencyList(yarnDep.dependencies, resolutions), resolutions);
    }
  }
}

/**
 * @param {Yarn2Lock} yarnLock
 * @param { {[key: string]: number} } useCount
 * @param {Dependency[]} depsList
 */
function markUsedDependencyList(yarnLock, useCount, depsList, resolutions) {
  for (const dep of depsList) {
    markUsedDependency(yarnLock, useCount, dep, resolutions);
  }
}

/**
 * @param {string} sourceRootPath
 */
function computeKeepAndPrunePackages(sourceRootPath) {
  const yarnLock = readYarnLock(sourceRootPath);
  const pkg = readPackageJson(path.join(sourceRootPath, "package.json"));
  const depsList = findPrimaryDependencies(pkg, sourceRootPath);

  // sh.echo("");
  // sh.echo("Primary dependencies");
  // for (const dp of depsList) {
  //   sh.echo(`package: ${dp.package}@${dp.version}`);
  // }

  const resolutions = pkg.resolutions ?? {};
  const useCount = {};
  markUsedDependencyList(yarnLock, useCount, depsList, resolutions);

  // sh.echo("-------------------------------------------------------------------");
  // for (const key in useCount) {
  //   sh.echo(`${key} used ${useCount[key]}`);
  // }

  const keep = [];
  const prune = [];
  for (const key of Object.getOwnPropertyNames(yarnLock)) {
    const yarnDep = yarnLock[key];

    if (yarnDep == null) {
      continue;
    }

    const parts = key.split(/@/g);
    const packageName = parts.slice(0, -1).join("@");

    const useKey = packageName + "@" + yarnDep.version;
    if (useCount[useKey] == null) {
      prune.push( { package: packageName, version: yarnDep.version } );
    } else {
      keep.push( { package: packageName, version: yarnDep.version } );
    }
  }

  return { keep, prune };
}

function dumpKeepPrune(keepPrune) {
  const keep = keepPrune.keep;
  const prune = keepPrune.prune;

  sh.echo("-------------------------------------------------------------------");
  for (const k of keep) {
    sh.echo(`${k.package}@${k.version} -> keep`);
  }

  sh.echo("-------------------------------------------------------------------");
  for (const p of prune) {
    sh.echo(`${p.package}@${p.version} -> prune`);
  }
}

function pruneNodeModulesDir(pruneDepNameMap /* Map<string, Dependency[]> */, projectDirectory) {
  sh.echo(`Scanning ${projectDirectory} for modules to prune.`);
  let pruneCount = 0;

  const nodeModulesPath = path.join(projectDirectory, "node_modules");
  if ( ! fs.existsSync(nodeModulesPath)) {
    return pruneCount;
  }

  for (const depDir of sh.ls(nodeModulesPath)) {
    if (depDir.slice(0, 1) === "@") {
      for (const subDir of sh.ls(path.join(nodeModulesPath, depDir))) {
        if (checkAndPruneDependency(pruneDepNameMap, projectDirectory, depDir + "/" + subDir)) {
          pruneCount++;
        }
      }
    } else {
      if (checkAndPruneDependency(pruneDepNameMap, projectDirectory, depDir)) {
        pruneCount++;
      }
    }
  }
  return pruneCount;
}

function pruneBrokenBinLinks(projectDirectory) {
  sh.echo(`Scanning ${projectDirectory} for broken bin/ links to prune.`);

  const nodeModulesPath = path.join(projectDirectory, "node_modules");
  if ( ! fs.existsSync(nodeModulesPath)) {
    return;
  }

  const binPath = path.join(nodeModulesPath, ".bin");
  if (fs.existsSync(binPath)) {
    for (const binEntry of sh.ls("-l", binPath)) {
      if (binEntry.isSymbolicLink()) {
        const linkPath = path.join(binPath, binEntry.name);
        const linkTarget = fs.readlinkSync(linkPath);
        const linkTargetPath = path.join(binPath, linkTarget);
        if ( ! fs.existsSync(linkTargetPath)) {
          sh.echo(`Pruning broken symlink link ${linkPath}`);
          sh.rm(linkPath);
        }
      }
    }
  }

  for (const moduleDir of sh.ls(nodeModulesPath)) {
    pruneBrokenBinLinks(path.join(nodeModulesPath, moduleDir));
  }
}

function checkAndPruneDependency(pruneDepNameMap, projectDirectory, depDir) {
  if (pruneDepNameMap.has("" + depDir)) {
    const depDirPath = path.join(projectDirectory, "node_modules", depDir);
    const pkg = readPackageJson(path.join(depDirPath, "package.json"));

    const deps = pruneDepNameMap.get(depDir);
    for (const dep of deps) {
      if (pkg.version === dep.version) {
        sh.echo(`Pruning module directory ${depDirPath}`);
        sh.rm('-rf', depDirPath);
        return true;
      }
    }
  }
  return false;
}
