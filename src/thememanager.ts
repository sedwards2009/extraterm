/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs = require('fs');
import path = require('path');
import sass = require('sass.js');
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
  
  getThemeContents(themeName: string): Promise<ThemeContents>;
  
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

  getThemeContents(themeId: string): Promise<ThemeContents> {
    const themeInfo = this.getTheme(themeId);
    if (themeInfo === null) {
      this._log.warn("The requested theme name '" + themeId + "' is unknown.");
      return null;
    }
    
    if ( ! this._themeContents.has(themeId)) {
      return this._loadThemeContents(this._directory, themeInfo)
        .then( (contents) => {
          this._themeContents.set(themeId, contents);
          return contents;
        });
    } else {
      return new Promise<ThemeContents>( (resolve, cancel) => {
        resolve(this._themeContents.get(themeId));
      });
    }
  }
  
  registerChangeListener(themeId: string, listenerFunc: () => void): void {
    const themeInfo = this.getTheme(themeId);
    const themePath = themeInfo.path;
    
    const watcher = fs.watch(themePath, { persistent: false },
      (event, filename) => {
        
        if (this._themeContents.has(themeId)) {
          const oldThemeContents = this._themeContents.get(themeId)
          
          this._loadThemeContents(this._directory, themeInfo)
            .then( (newThemeContents) => {
              if ( ! _.isEqual(oldThemeContents, newThemeContents)) {
                this._themeContents.set(themeId, newThemeContents);
                listenerFunc();
              } else {
                this._log.info("" + filename + " changed, but the theme contents did not.");
              }
            });
        } else {
          this.getThemeContents(themeInfo.id).then( (result) => {
            listenerFunc();
          });
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
  
  private _loadThemeContents(directory: string, theme: ThemeInfo): Promise<ThemeContents> {
    const themeContents: ThemeContents = {
      cssFiles: {}
    };

    const filePromises = ThemeTypes.cssFileEnumItems.map(
      (cssFile: CssFile): Promise<{ cssFile: CssFile; cssText: string;}> => {
      const sassFileName = path.join(directory, theme.id, ThemeTypes.cssFileNameBase(cssFile) + '.scss');
      
      return this._loadSassFile(sassFileName)
        .then( (cssText: string): { cssFile: CssFile; cssText: string;} => {
          if (theme.debug) {
            this._log.debug(`Sass output for ${theme.name}, ${ThemeTypes.cssFileNameBase(cssFile)}`, cssText);
          }
          return { cssText, cssFile };
        });
    });

    return Promise.all(filePromises).then( (results) => {
      results.forEach( (result) => {
        themeContents.cssFiles[ThemeTypes.cssFileNameBase(result.cssFile)] = result.cssText;
      });
      return themeContents;
    });
  }

  private _loadSassFile(sassFileName: string): Promise<string> {
    return new Promise<string>( (resolve, cancel) => {
      try {
        const scssText = fs.readFileSync(sassFileName, {encoding: 'utf-8'});
        sass.compile(scssText, (result) => {
          if (result.status === 0) {
            const successResult = <sass.SuccessResult> result;
            resolve(successResult.text);
          } else {
            const errorResult = <sass.ErrorResult> result;
            this._log.warn("An error occurred while processing " + sassFileName, errorResult.formatted);
            cancel();
          }
        });
      } catch (err) {
        this._log.warn("An error occurred while processing " + sassFileName, err);
        cancel();
        return;
      }
    });
  }
}

export function makeThemeManager(directory: string): ThemeManager {
  return new ThemeManagerImpl(directory);
}
