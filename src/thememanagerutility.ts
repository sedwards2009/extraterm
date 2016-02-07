/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */
import ThemeManager = require('./thememanager');
import ThemeTypes = require('./theme');

import Logger = require('./logger');

const print = console.log.bind(console);

function main(): void {
  const tm = ThemeManager.makeThemeManager('themes');
  tm.getAllThemes().forEach( (themeInfo) => {
    print("----");
    print("ID:   ", themeInfo.id);
    print("Name: ", themeInfo.name);
    print("Path: ", themeInfo.path);
    
    const contents = tm.getThemeContents(themeInfo.id);
    ThemeTypes.cssFileEnumItems.forEach( (item) => {
      print("CSS " + ThemeTypes.cssFileNameBase(item) + "----");
      print(contents.cssFiles.get(item));
    });
  });
}
debugger;
main();
