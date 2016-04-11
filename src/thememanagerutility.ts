/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import ThemeManager = require('./thememanager');
import ThemeTypes = require('./theme');

import Logger = require('./logger');

const print = console.log.bind(console);

function main(): void {
  const tm = ThemeManager.makeThemeManager(['themes']);
  tm.getAllThemes().filter( (themeInfo) => themeInfo.id === 'spacelab-ui').forEach( (themeInfo) => {
    tm.renderThemes([themeInfo.id,'default']).then( (contents) => {
      print("----");
      print("ID:   ", themeInfo.id);
      print("Name: ", themeInfo.name);
      print("Path: ", themeInfo.path);
      
      
      ThemeTypes.cssFileEnumItems.forEach( (item) => {
        print("CSS " + ThemeTypes.cssFileNameBase(item) + "----");
        if (contents.success) {
          print(contents.themeContents.cssFiles[ThemeTypes.cssFileNameBase(item)]);
        } else {
          print(contents.errorMessage);
        }
      });
    });
  });
}

main();
