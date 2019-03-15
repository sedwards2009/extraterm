/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

require('shelljs/global');
const fs = require('fs');
const path = require('path');
const lockfile = require('@yarnpkg/lockfile');

/**
 * Prune away yarn development dependencies
 * 
 * Prunes development dependencies from a node project with help from
 * yarn's lock file.
 * 
 * @param sourceRootPath Path to the source code root directory which contains
 *                       the root package.json file and the yarn.lock file.
 * @param targetPath     Path to the target directory which contains the built
 *                       project whose dependencies need to be pruned.
 */
function pruneDevDependencies(sourceRootPath, targetPath) {
  echo("");
  echo("Pruning Yarn dev dependencies");
  echo("=============================");
  echo("");

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
    for (const nodeModulesPath of ls('-d', path.join(targetPath, p))) {
       pruneCount += pruneNodeModulesDir(pruneDepNameMap, nodeModulesPath);
    }
  }

  for (const p of [".", ...pkg.workspaces.packages]) {
    for (const nodeModulesPath of ls('-d', path.join(targetPath, p))) {
      pruneBrokenBinLinks(nodeModulesPath);
    }
  }

  echo("");
  echo(`    Total modules in yar.lock:      ${keepPrune.keep.length + keepPrune.prune.length}`);
  echo(`    Modules identified for keeping: ${keepPrune.keep.length}`);
  echo(`    Modules identified for pruning: ${keepPrune.prune.length}`);
  echo(`    Module directories deleted:     ${pruneCount}`);
}

exports.pruneDevDependencies = pruneDevDependencies;

function readYarnLock(sourceRootPath) {
  let file = fs.readFileSync(path.join(sourceRootPath, 'yarn.lock'), 'utf8');
  let json = lockfile.parse(file);
  return json;
}

function readPackageJson(pkgPath) {
  const pkgString = fs.readFileSync(pkgPath, "utf8");
  return JSON.parse(pkgString);
}

//  interface Dependency {
//    package: string;
//    version: string;
//  }

function objectToDependencyList(dependencies) {
  const result = [];
  for (const key in dependencies) {
    result.push( { package: key, version: dependencies[key] } );
  }
  return result;
}

function readPrimaryDependencies(pkgPath) /*: Dependency[] */ {
  const pkg = readPackageJson(pkgPath);
  return objectToDependencyList(pkg.dependencies);
}

function findPrimaryDependencies(sourceRootPath) /*: Dependency[] */ {
  const pkg = readPackageJson(path.join(sourceRootPath, "package.json"));

  if (pkg.workspaces == null) {
    throw new Error("package.json doesn't have a 'workspaces' key.");
  }
  if (pkg.workspaces.packages == null) {
    throw new Error("package.json doesn't have a 'workspaces.packages' key.");
  }

  let depsList = [];
  for (const p of [".", ...pkg.workspaces.packages]) {
    for (const pkgPath of ls(path.join(sourceRootPath, p, "package.json"))) {
      depsList = [...depsList, ...readPrimaryDependencies(pkgPath)];
    }
  }
  return depsList;
}

function markUsedDependency(yarnLock, useCount, dependency) {
  const depString = dependency.package + "@" + dependency.version;

  const yarnDep = yarnLock.object[depString];
  if (yarnDep == null) {
    echo(`Warning: Couldn't find ${depString} in yarn.lock to mark. Skipping.`);
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
        objectToDependencyList(yarnDep.dependencies));
    }
  }
}

function markUsedDependencyList(yarnLock, useCount, depsList) {
  for (const dep of depsList) {
    markUsedDependency(yarnLock, useCount, dep);
  }
}

function computeKeepAndPrunePackages(sourceRootPath) {
  const yarnLock = readYarnLock(sourceRootPath);
  const depsList = findPrimaryDependencies(sourceRootPath);

  const useCount = {};
  markUsedDependencyList(yarnLock, useCount, depsList);

  // echo("-------------------------------------------------------------------");
  // for (const key in useCount) {
  //   echo(`${key} used ${useCount[key]}`);
  // }

  const keep = [];
  const prune = [];
  for (const key in yarnLock.object) {
    const yarnDep = yarnLock.object[key];
    const parts = key.split(/@/g)
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

  echo("-------------------------------------------------------------------");
  for (const k of keep) {
    echo(`${k.package}@${k.version} -> keep`);
  }

  echo("-------------------------------------------------------------------");
  for (const p of prune) {
    echo(`${p.package}@${p.version} -> prune`);
  }
}

function pruneNodeModulesDir(pruneDepNameMap /* Map<string, Dependency[]> */, projectDirectory) {
  echo(`Scanning ${projectDirectory} for modules to prune.`);
  let pruneCount = 0;

  const nodeModulesPath = path.join(projectDirectory, "node_modules");
  if ( ! fs.existsSync(nodeModulesPath)) {
    return pruneCount;
  }

  for (const depDir of ls(nodeModulesPath)) {
    if (depDir.slice(0, 1) === "@") {
      for (const subDir of ls(path.join(nodeModulesPath, depDir))) {
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
  echo(`Scanning ${projectDirectory} for broken bin/ links to prune.`);

  const nodeModulesPath = path.join(projectDirectory, "node_modules");
  if ( ! fs.existsSync(nodeModulesPath)) {
    return;
  }

  const binPath = path.join(nodeModulesPath, ".bin");
  if (fs.existsSync(binPath)) {
    for (const binEntry of ls("-l", binPath)) {
      if (binEntry.isSymbolicLink()) {
        const linkPath = path.join(binPath, binEntry.name);
        const linkTarget = fs.readlinkSync(linkPath);
        const linkTargetPath = path.join(binPath, linkTarget);
        if ( ! fs.existsSync(linkTargetPath)) {
          echo(`Pruning broken symlink link ${linkPath}`);
          rm(linkPath);
        }
      }
    }
  }

  for (const moduleDir of ls(nodeModulesPath)) {
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
        echo(`Pruning module directory ${depDirPath}`);
        rm('-rf', depDirPath);
        return true;
      }
    }
  }
  return false;
}
