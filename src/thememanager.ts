/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

import fs = require('fs');
import path = require('path');
import sass = require('node-sass');
import _ = require('lodash');

import Logger = require('./logger');
import ThemeTypes = require('./theme');

type ThemeInfo = ThemeTypes.ThemeInfo;
type ThemeContents = ThemeTypes.ThemeContents;
type CssFile = ThemeTypes.CssFile;
const THEME_CONFIG = "theme.json";

export interface ThemeManager {
  getTheme(themeName: string): ThemeInfo;
  
  getAllThemes(): ThemeInfo[];
  
  getThemeContents(themeName: string): ThemeContents;
}

class ThemeManagerImpl implements ThemeManager {
  
  private _log = new Logger("ThemeManagerImpl");
  
  private _directory: string = null;
  
  private _themes: Map<string, ThemeInfo> = null;
  
  private _themeContents: Map<string, ThemeContents> = new Map();
  
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
    const theme = this._themes.get(themeId);
    
    if (theme === undefined) {
      this._log.warn("The requested theme name is unknown.");
      return null;
    }
    
    if ( ! this._themeContents.has(themeId)) {
      const contents = this._loadThemeContents(this._directory, theme);
      this._themeContents.set(themeId, contents);
    }
    return this._themeContents.get(themeId);
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
    const themeContents = {
      cssFiles: new Map<CssFile, string>()
    };

    ThemeTypes.cssFileEnumItems.map( (cssFile: CssFile) => {
      const sassFileName = path.join(directory, theme.id, ThemeTypes.cssFileNameBase(cssFile) + '.scss');
      const cssText = this._loadSassFile(sassFileName);
      if (theme.debug) {
        this._log.debug(`Sass output for ${theme.name}, ${ThemeTypes.cssFileNameBase(cssFile)}`, cssText);
      }
      themeContents.cssFiles.set(cssFile, cssText);
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
