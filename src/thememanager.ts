/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs = require('fs');
import path = require('path');
import sass = require('node-sass');
import _ = require('lodash');

import Logger = require('./logger');
import log = require('./logdecorator');
import ThemeTypes = require('./theme');

type ThemeInfo = ThemeTypes.ThemeInfo;
type ThemeContents = ThemeTypes.ThemeContents;
type CssFile = ThemeTypes.CssFile;
const THEME_CONFIG = "theme.json";

interface ListenerFunc {
  (): void;
}

export interface ThemeManager {
  getTheme(themeName: string): ThemeInfo;
  
  getAllThemes(): ThemeInfo[];
  
  getThemeContents(themeName: string): ThemeContents;
  
  registerChangeListener(themeId: string, listener: ListenerFunc): void;
  
  unregisterChangeListener(themeId: string, listener: ListenerFunc): void;
}

interface ListenerItem {
  themeId: string;
  listenerFunc: ListenerFunc;
  watcher: fs.FSWatcher;
}

class ThemeManagerImpl implements ThemeManager {
  
  private _log = new Logger("ThemeManagerImpl");
  
  private _directory: string = null;
  
  private _themes: Map<string, ThemeInfo> = null;
  
  private _themeContents: Map<string, ThemeContents> = new Map();
  
  private _listeners: ListenerItem[] = [];
  
  constructor(directory: string) {
    this._directory = directory;
    this._themes = this._scanThemeDirectory(directory);
  }
  
  getTheme(themeId: string): ThemeInfo {
    return this._themes.get(themeId) || null;
  }
  
  getAllThemes(): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    this._themes.forEach( (value) => {
      result.push(value);
    });
    return result;
  }

  getThemeContents(themeId: string): ThemeContents {
    const themeInfo = this.getTheme(themeId);
    if (themeInfo === null) {
      this._log.warn("The requested theme name '" + themeId + "' is unknown.");
      return null;
    }
    
    if ( ! this._themeContents.has(themeId)) {
      const contents = this._loadThemeContents(this._directory, themeInfo);
      this._themeContents.set(themeId, contents);
    }
    return this._themeContents.get(themeId);
  }
  
  registerChangeListener(themeId: string, listenerFunc: () => void): void {
    const themeInfo = this.getTheme(themeId);
    const themePath = themeInfo.path;
    const watcher = fs.watch(themePath, { persistent: false },
      (event, filename) => {
        const oldThemeContents = this.getThemeContents(themeId);
        const newThemeContents = this._loadThemeContents(this._directory, themeInfo);
        if ( ! _.isEqual(oldThemeContents, newThemeContents)) {
          this._themeContents.set(themeId, newThemeContents);          
          listenerFunc();
        } else {
          this._log.info("" + filename + " changed, but the theme contents did not.");
        }
      });
    
    const listenerItem: ListenerItem = { themeId, listenerFunc, watcher };
    this._listeners.push(listenerItem);
  }
  
  unregisterChangeListener(themeId: string, listener: () => void): void {
// FIXME
  }
  
  /**
   * Scan for themes.
   * 
   * @param themesdir The directory to scan for themes.
   * @returns Map of found theme config objects.
   */
  private _scanThemeDirectory(themesDir: string): Map<string, ThemeInfo> {
    let themeMap = new Map<string, ThemeInfo>();
    if (fs.existsSync(themesDir)) {
      const contents = fs.readdirSync(themesDir);
      contents.forEach( (item) => {
        var infoPath = path.join(themesDir, item, THEME_CONFIG);
        try {
          const infoStr = fs.readFileSync(infoPath, {encoding: "utf8"});
          const themeInfo = <ThemeInfo>JSON.parse(infoStr);
          themeInfo.path = path.join(themesDir, item);
          themeInfo.id = item;
          this._fillThemeInfoDefaults(themeInfo);
          
          if (this._validateThemeInfo(themeInfo)) {
            themeMap.set(item, themeInfo);
          }

        } catch(err) {
          this._log.warn("Warning: Unable to read file ", infoPath, err);
        }
      });
      return themeMap;
    }
  }

  private _fillThemeInfoDefaults(themeInfo: ThemeInfo): void {
    themeInfo.debug = themeInfo.debug === undefined ? false : themeInfo.debug;
  }

  /**
   * 
   */
  private _validateThemeInfo(themeinfo: ThemeInfo): boolean {
    return _.isString(themeinfo.name) && themeinfo.name !== "";
  }
  
  private _loadThemeContents(directory: string, theme: ThemeInfo): ThemeContents {
    const themeContents: ThemeContents = {
      cssFiles: {}
    };

    ThemeTypes.cssFileEnumItems.map( (cssFile: CssFile) => {
      const sassFileName = path.join(directory, theme.id, ThemeTypes.cssFileNameBase(cssFile) + '.scss');
      const cssText = this._loadSassFile(sassFileName);
      if (theme.debug) {
        this._log.debug(`Sass output for ${theme.name}, ${ThemeTypes.cssFileNameBase(cssFile)}`, cssText);
      }
      themeContents.cssFiles[ThemeTypes.cssFileNameBase(cssFile)] = cssText;
    });
    
    return themeContents;
  }
  
  private _loadSassFile(sassFileName: string): string {
    try {
      const result = sass.renderSync({ file: sassFileName });
      return result.css.toString();
    } catch (err) {
      this._log.warn("An error occurred while processing " + sassFileName, err);
      return null;
    }
  }
}

export function makeThemeManager(directory: string): ThemeManager {
  return new ThemeManagerImpl(directory);
}
