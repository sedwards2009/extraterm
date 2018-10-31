/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
 
/*
 * This little utility can be run from the command line using node. It lets you view the metadata of all of the
 * themes in the src/themes directory, and it can compile a theme into CSS and report any errors.
 */
import * as path from 'path';
import * as fs from 'fs';
import {ThemeManager, ThemeTypePaths} from './ThemeManager';
import * as ThemeTypes from './Theme';
import * as SourceDir from '../SourceDir';
import * as Commander from 'commander';
import {MainExtensionManager} from '../main_process/extension/MainExtensionManager';

import {Logger, getLogger} from "extraterm-logging";
import { cssFileToFilename } from './Theme';

const print = console.log.bind(console);

interface CommandLineOptions {
  list?: boolean;
  compile?: string;
  output?: string;
}

function main(): void {
  Commander
    .option('-l, --list', 'List all available themes.')
    .option('-c, --compile [theme_id]', 'Compile a theme and write it to stdout.')
    .option('-o, --output [directory]', 'Write compiled theme files to this directory instead of stdout.')
    .parse(process.argv);
  const options = <CommandLineOptions> Commander;
  
  const paths: ThemeTypePaths = {
    css: [path.join(SourceDir.path, '../resources/themes')],
    syntax: [],
    terminal: []
  };
  const tm = new ThemeManager(paths, new MainExtensionManager([]));

  const allThemes = tm.getAllThemes();
  if (options.list) {
    // List the theme metadata.
    print(allThemes);
  } else {
  
    const themes = allThemes.filter( (themeInfo) => themeInfo.id === options.compile);
    if (themes.length === 0) {
      print(`Unable to find theme with ID '${options.compile}'.`);
      process.exit(1);
    }
    
    themes.forEach( (themeInfo) => {
      const outputDir = options.output;
      if (outputDir !== undefined) {
        try {
          fs.accessSync(outputDir, fs.constants.F_OK);
        } catch(err) {
          print(`Creating output directory '${outputDir}'`);
          fs.mkdir(outputDir);
        }
      }
      const globalVariables = new Map<string, number|boolean|string>();
      globalVariables.set("extraterm-platform", process.platform);
      globalVariables.set("extraterm-titlebar-visible", false);

      tm.renderGui(themeInfo.id, globalVariables).then( (contents) => {
        contents.themeContents.cssFiles.forEach( (item) => {
          if (contents.success) {

            const cssFilename = cssFileToFilename(item.cssFileName).slice(0, -5) + ".css";
            if (outputDir !== undefined) {
              const output = path.join(outputDir, cssFilename);
              print(`Writing to ${output}`);
              fs.writeFileSync(output, item.contents);
              
            } else {
              print("/* SCSS " + cssFileToFilename(item.cssFileName) + " */");
              print(item.contents);
            }
          } else {
            print(contents.errorMessage);
          }
        });
      });
    });
  }
}

main();
