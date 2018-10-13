/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
require('shelljs/global');
const fs = require('fs');
const path = require('path');
const packager = require('electron-packager');
const getRepoInfo = require('git-repo-info');

const log = console.log.bind(console);
const BUILD_TMP = 'build_tmp';
const MODULE_VERSON = 53; // This version number also appears in thememanager.ts

function main() {
  "use strict";
  
  if ( ! test('-f', './package.json')) {
    echo("This script was called from the wrong directory.");
    return;
  }

  const srcRootDir = pwd();
  if (test('-d', BUILD_TMP)) {
    rm('-rf', BUILD_TMP);
  }
  mkdir(BUILD_TMP);
  
  const packageJson = fs.readFileSync('package.json');
  const packageData = JSON.parse(packageJson);
  
  const gitUrl = packageData.repository.url.replace("git://github.com/", "git@github.com:");
   
  const info = getRepoInfo();

  echo("Fetching a clean copy of the source code from " + gitUrl);
  cd(BUILD_TMP);

  // For some reason pwd() is returning "not quite strings" which path.join() doesn't like. Thus "" + ...
  const buildTmpPath = "" + pwd();
  
  exec("git clone --depth 1 -b " + info.branch + " " + gitUrl);
  cd("extraterm");

  echo("Setting up the run time dependencies in " + BUILD_TMP);

  exec("yarn install");
  exec("yarn run electron-rebuild");
  exec("yarn run build");

  echo("Removing development dependencies");
  exec("yarn install --production=true");

  // Create the commands zip
  echo("Creating commands.zip");
  const commandsDir = packageData.name + "-commands-" + packageData.version;
  cp("-r", "extraterm/src/commands", path.join(buildTmpPath, commandsDir));
  const codeDir = pwd();
  cd(buildTmpPath);
  exec(`zip -y -r ${commandsDir}.zip ${commandsDir}`);
  cd(codeDir);

  const electronVersion = packageData.devDependencies['electron'];

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
    return platform === "darwin" ? "extraterm.app/Contents/Resources/app" : "resources/app";
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
      "codemirror/src",
      "node-sass/src",
      "node-sass/node_modules/nan",
      "node-sass/vendor",
      "node-gyp",
      "ajv",
      "globule",
      "vue/src",
      "vue/dist/vue.esm.browser.js",
      "vue/dist/vue.esm.js",
      "vue/dist/vue.js",
      "vue/dist/vue.min.js",
      "vue/dist/vue.runtime.esm.js",
      "vue/dist/vue.runtime.js",
      "vue/dist/vue.runtime.min.js",
      "font-manager/src",
      ".bin"
    ].forEach( (subpath) => {
      const fullPath = path.join("node_modules", subpath);

      echo("Deleting " + fullPath);

      if (test('-d', fullPath)) {
        rm('-rf', fullPath);
      } else if (test('-f', fullPath)) {
          rm(fullPath);
      } else {
        echo("----------- Unable to find path "+ fullPath);
      }
    });

  }

  function makePackage(arch, platform) {
    log("");
    return new Promise(function(resolve, reject) {
      
      // Clean up the output dirs and files first.
      const versionedOutputDir = packageData.name + "-" + packageData.version + "-" + platform + "-" + arch;
      if (test('-d', versionedOutputDir)) {
        rm('-rf', versionedOutputDir);
      }
      
      const outputZip = path.join(buildTmpPath, versionedOutputDir + ".zip");

      const packagerOptions = {
        arch: arch,
        dir: ".",
        platform: platform,
        version: electronVersion,
        ignore: ignoreFunc,
        overwrite: true,
        out: buildTmpPath,
        packageManager: "yarn",
        afterPrune: [
          (buildPath, electronVersion, platform, arch, callback) => {
            replaceDirs(path.join(buildPath, "node_modules"), path.join("" + codeDir,`build_scripts/node_modules-${platform}-${arch}`));
            callback();
          }
        ]
      };
      if (platform === "win32") {
        packagerOptions.icon = "extraterm/resources/logo/extraterm_small_logo.ico";
        packagerOptions.win32metadata = {
          FileDescription: "Extraterm",
          ProductName: "Extraterm",
          LegalCopyright: "(C) 2018 Simon Edwards"
        };
      } else if (platform === "darwin") {
        packagerOptions.icon = "extraterm/resources/logo/extraterm_small_logo.icns";
      }

      packager(packagerOptions, function done(err, appPath) {
        if (err !== null) {
          log(err);
          reject();
        } else {
          // Rename the output dir to a one with a version number in it.
          mv(appPath[0], path.join(buildTmpPath, versionedOutputDir));
          
          const thisCD = pwd();
          cd(buildTmpPath);

          hoistSubprojectsModules(versionedOutputDir, platform);
          pruneNodeModules(versionedOutputDir, platform);

          // Prune any unneeded node-sass binaries.
          pruneNodeSass(versionedOutputDir, arch, platform);

          pruneEmojiOne(versionedOutputDir, platform);

          // Zip it up.
          log("Zipping up the package");

          mv(path.join(versionedOutputDir, "LICENSE"), path.join(versionedOutputDir, "LICENSE_electron.txt"));
          cp("extraterm/README.md", versionedOutputDir);
          cp("extraterm/LICENSE.txt", versionedOutputDir);
          
          exec(`zip -y -r ${outputZip} ${versionedOutputDir}`);
          cd(thisCD);
          
          log("App bundle written to " + versionedOutputDir);
          resolve();
        }
      });
    });
  }
  
  function replaceDirs(targetDir, replacementsDir) {
    const prevDir = pwd();
    cd(srcRootDir);
    const replacements = ls(replacementsDir);
    replacements.forEach( (rDir) => {
      const targetSubDir = path.join(targetDir, rDir);
      if (test('-d', targetSubDir)) {
        rm('-r', targetSubDir);
      }
      cp('-r', path.join(replacementsDir, rDir), targetSubDir);
    });  
    cd(prevDir);
  }

  function makeDmg() {
    echo("");
    echo("---------------------------------------------------");
    echo("Building dmg file for macOS");
    echo("---------------------------------------------------");

    const darwinPath = path.join(buildTmpPath, `extraterm-${packageData.version}-darwin-x64`);
    for (const f of ls(darwinPath)) {
      if ( ! f.endsWith(".app")) {
        echo(`Deleting ${f}`);
        rm(path.join(darwinPath, f));
      }
    }

    mv(path.join(buildTmpPath, "extraterm.app"), "Extraterm.app");
    
    ln("-s", "/Applications", path.join(darwinPath, "Applications"));

    exec(`docker run --rm -v "${buildTmpPath}:/files" sporsh/create-dmg Extraterm_${packageData.version} /files/extraterm-${packageData.version}-darwin-x64/ /files/extraterm_${packageData.version}.dmg`);
  }

  makePackage("x64", "win32")
    .then(() => makePackage("x64", "linux"))
    .then(() => makePackage("x64", "darwin"))
    .then(makeDmg)
    .then(() => { log("Done"); } );
}

main();
