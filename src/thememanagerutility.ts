/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
 
/*
 * This little utility can be run from the command line using node. It lets you view the metadata of all of the
 * themes in the src/themes directory, and it can compile a theme into CSS and report any errors.
 */
import path = require('path');
import fs = require('fs');
import ThemeManager = require('./thememanager');
import ThemeTypes = require('./theme');
import SourceDir = require('./sourceDir');
import commander = require('commander');

import Logger = require('./logger');

const print = console.log.bind(console);

interface CommandLineOptions {
  list?: boolean;
  compile?: string;
  output?: string;
}

function main(): void {
  commander
    .option('-l, --list', 'List all available themes.')
    .option('-c, --compile [theme_id]', 'Compile a theme and write it to stdout.')
    .option('-o, --output [directory]', 'Write compiled theme files to this directory instead of stdout.')
    .parse(process.argv);
  const options = <CommandLineOptions> commander;
  
  const tm = ThemeManager.makeThemeManager([path.join(SourceDir.path, 'themes')]);
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
          fs.accessSync(outputDir, fs.F_OK);
        } catch(err) {
          print(`Creating output directory '${outputDir}'`);
          fs.mkdir(outputDir);
        }
      }
      
      tm.renderThemes([themeInfo.id,'default']).then( (contents) => {
        ThemeTypes.cssFileEnumItems.forEach( (item) => {
          if (contents.success) {
            if (outputDir !== undefined) {
              const output = path.join(outputDir, ThemeTypes.cssFileNameBase(item) + '.css');
              print(`Writing to ${output}`);
              fs.writeFileSync(output, contents.themeContents.cssFiles[ThemeTypes.cssFileNameBase(item)]);
              
            } else {
              print("/* CSS " + ThemeTypes.cssFileNameBase(item) + " */");
              print(contents.themeContents.cssFiles[ThemeTypes.cssFileNameBase(item)]);
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
