/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const path = require('path');
const fs = require('fs');
const packager = require('electron-packager');
const dependencyPruner = require('./dependency_pruner');
const log = console.log.bind(console);

const CONST_EXTRATERM_ELECTRON_EXE = "extraterm_main";

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

function pruneTwemoji(versionedOutputDir, platform) {
  if (platform !== "linux") {
    const twemojiPath = path.join(versionedOutputDir, appDir(platform), "extraterm/resources/themes/default/fonts/Twemoji.ttf");
    rm(twemojiPath);
  }
}

function hoistSubprojectsModules(versionedOutputDir, platform) {
  const modulesDir = path.join(versionedOutputDir, appDir(platform), "node_modules");
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
  const packagesDir = path.join(versionedOutputDir, appDir(platform), "packages");
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

  cd(path.join(versionedOutputDir, appDir(platform)));

  pruneNodePty();

  exec("modclean -n default:safe -r --ignore windows-swca");
  pruneSpecificNodeModules();

  cd(prevDir);
}

function pruneSpecificNodeModules() {
  [
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

function pruneDependencyWithWhitelist(dependencyName, subpathList) {
  const prevDir = pwd();

  cd("node_modules");
  cd(dependencyName);

  for (const itemPath of find(".")) {
    if ( ! test('-f', itemPath)) {
      continue;
    }

    if (pathMatchWhitelist(subpathList, itemPath)) {
      echo(`Keeping: ${itemPath}`);
    } else {
      echo(`Pruning ${itemPath}`);
      rm(itemPath);
    }
  }

  cd(prevDir);
}

/**
 * Match a path to a whilelist.
 *
 * Patterns in the whitelist have the follow rules:
 *
 *   * If it starts with a / then it matches the whole path.
 *   * If it ends with a / then everything under that directory is accepted.
 *   * No slashes in the path, then it matches on the file only.
 *
 * @param whitelist List of allowed path patterns.
 * @return True if the `testPath` is
 */
function pathMatchWhitelist(whitelist, testPath) {
  for (const keepPath of whitelist) {
    if (keepPath.startsWith("/")) {
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

async function makePackage({ arch, platform, electronVersion, version, outputDir, replaceModuleDirs }) {
  log("");
  const SRC_DIR = "" + pwd();

  fixNodeModulesSubProjects();

  // Clean up the output dirs and files first.
  const versionedOutputDir = createOutputDirName({version, platform, arch});

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
    name: platform === "darwin" ? "Extraterm" : CONST_EXTRATERM_ELECTRON_EXE,
    overwrite: true,
    out: outputDir,
    prune: false
  };
  if (platform === "win32") {
    packagerOptions.icon = "extraterm/resources/logo/extraterm_small_logo.ico";
    packagerOptions.win32metadata = {
      FileDescription: "Extraterm",
      ProductName: "Extraterm",
      LegalCopyright: "(C) 2021 Simon Edwards"
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
  dependencyPruner.pruneDevDependencies(SRC_DIR, path.join(outputDir, versionedOutputDir, targetAppRootPath));
  pruneNodeModules(versionedOutputDir, platform);
  pruneTwemoji(versionedOutputDir, platform);

  // Zip it up.
  log("Zipping up the package");

  mv(path.join(versionedOutputDir, "LICENSE"), path.join(versionedOutputDir, "LICENSE_electron.txt"));

  if (platform === "linux") {
    cp(path.join(SRC_DIR, "extraterm", "resources", "extraterm.desktop"), versionedOutputDir);
  }

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
