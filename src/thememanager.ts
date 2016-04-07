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

const DEBUG_SASS = false;
const DEBUG_SASS_FINE = false;
const DEBUG_SCAN = false;

interface ListenerFunc {
  (theme: ThemeInfo): void;
}

export interface ThemeManager {
  getTheme(themeName: string): ThemeInfo;
  
  getAllThemes(): ThemeInfo[];
  
  /**
   * Render a stack of themes.
   * 
   * @param  themeIds the stack or themes to render
   * @return the rendered CSS texts
   */
  renderThemes(themeIdList: string[]): Promise<ThemeContents>;
  
  registerChangeListener(themeIdOrList: string | string[], listener: ListenerFunc): void;
  
  unregisterChangeListener(themeIdOrList: string | string[]): void;
}

interface ListenerItem {
  themeId: string;
  listenerFunc: ListenerFunc;
  watcher: fs.FSWatcher;
}

class ThemeManagerImpl implements ThemeManager {
  
  private _log = new Logger("ThemeManagerImpl");
  
  private _directories: string[] = null;
  
  private _themes: Map<string, ThemeInfo> = null;
  
  private _themeContents: Map<string, ThemeContents> = new Map();
  
  private _listeners: ListenerItem[] = [];
  
  constructor(directories: string[]) {
    this._directories = directories;
    
    const allThemes = new Map<string, ThemeInfo>();
    this._directories.forEach( (directory) => {
      const themes = this._scanThemeDirectory(directory);
      themes.forEach( (value, key) => {
        allThemes.set(key, value);
      });
    });
    
    this._themes = allThemes;
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

  renderThemes(themeIdList: string[]): Promise<ThemeContents> {
    const themeInfoList = this._themeIdListToThemeInfoList(themeIdList);

    // Look for this combo in the cache.
    if ( ! this._themeStackCacheHas(themeIdList)) {
      return this._renderThemeStackContents(themeInfoList)
        .then( (contents) => {
          this._themeContents.set(themeStackCacheKey(themeIdList), contents);
          return contents;
        });
    } else {
      return new Promise<ThemeContents>( (resolve, cancel) => {
        resolve(this._themeContents.get(themeStackCacheKey(themeIdList)));
      });
    }
  }
  
  private _themeStackCacheHas(themeIds: string[]): boolean {
    const key = themeStackCacheKey(themeIds);
    return this._themeContents.has(key);
  }
  
  private _themeIdListToThemeInfoList(themeIdList: string[]): ThemeInfo[] {
    // Convert the list of theme IDs to a list of ThemeInfos
    const themeInfoList = themeIdList.map( (themeId) => {
      const themeInfo = this.getTheme(themeId);
      if (themeInfo === null) {
        this._log.warn("The requested theme name '" + themeId + "' is unknown.");
        return null;
      } else {
        return themeInfo;
      }
    }).filter( (themeInfo) => themeInfo !== null );
    return themeInfoList;
  }
  
  registerChangeListener(themeIdOrList: string | string[], listenerFunc: (theme: ThemeInfo) => void): void {
    const themeIdList = _.uniq(Array.isArray(themeIdOrList) ? themeIdOrList : [themeIdOrList]);
    const themeInfoList = this._themeIdListToThemeInfoList(themeIdList);
    
    themeIdList.forEach( (themeId) => {
      const themeInfo = this.getTheme(themeId);
      const themePath = themeInfo.path;
      
      const watcher = fs.watch(themePath, { persistent: false },
        (event, filename) => {
          
          if (this._themeStackCacheHas(themeIdList)) {
            const oldThemeContents = this._themeContents.get(themeId);
            
            this._renderThemeStackContents(themeInfoList)
              .then( (newThemeContents) => {
                if ( ! _.isEqual(oldThemeContents, newThemeContents)) {
                  this._themeContents.set(themeId, newThemeContents);
                  listenerFunc(themeInfo);
                } else {
                  this._log.info("" + filename + " changed, but the theme contents did not.");
                }
              });
          } else {
            this.renderThemes(themeIdList).then( (result) => {
              listenerFunc(themeInfo);
            });
          }
        });
      
      const listenerItem: ListenerItem = { themeId, listenerFunc, watcher };
      this._listeners.push(listenerItem);
    });
  }
  
  unregisterChangeListener(themeIdOrList: string | string[]): void {
    const themeIdList = Array.isArray(themeIdOrList) ? themeIdOrList : [themeIdOrList];
    themeIdList.forEach( (themeId) => {    
      const matches = this._listeners.filter( (tup) => tup.themeId === themeId );
      if (matches.length !== 0) {
        matches[0].watcher.close();
      }

      this._listeners = this._listeners.filter( (tup) => tup.themeId !== themeId );
    });
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
        const infoPath = path.join(themesDir, item, THEME_CONFIG);
        try {
          const infoStr = fs.readFileSync(infoPath, {encoding: "utf8"});
          const themeInfo = <ThemeInfo>JSON.parse(infoStr);
          themeInfo.path = path.join(themesDir, item);
          themeInfo.id = item;
          this._fillThemeInfoDefaults(themeInfo);
          
          if (this._validateThemeInfo(themeInfo)) {
            themeMap.set(item, themeInfo);
          }
          
          if (DEBUG_SCAN) {
            this._log.debug(themeInfo);
          }

        } catch(err) {
          this._log.warn("Warning: Unable to read file ", infoPath, err);
        }
      });
      return themeMap;
    }
  }

  private _fillThemeInfoDefaults(themeInfo: ThemeInfo): void {
    themeInfo.comment = themeInfo.comment === undefined ? "" : themeInfo.comment;
    themeInfo.debug = themeInfo.debug === undefined ? false : themeInfo.debug;
  }

  /**
   * 
   */
  private _validateThemeInfo(themeinfo: ThemeInfo): boolean {
    return _.isString(themeinfo.name) && themeinfo.name !== "";
  }
  
  private _renderThemeStackContents(themeStack: ThemeInfo[]): Promise<ThemeContents> {
    const themeContents: ThemeContents = {
      cssFiles: {}
    };

    const filePromises = ThemeTypes.cssFileEnumItems.map(
      (cssFile: CssFile): Promise<{ cssFile: CssFile; cssText: string;}> => {
      
      const dirStack = _.uniq(themeStack.map( (themeInfo) => themeInfo.path ));
      
      // Create SASS variables for the location of each theme directory.
      const variables = new Map<string, string>();
      themeStack.forEach( (themeInfo) => {
        variables.set('--source-dir-' + themeInfo.id, themeInfo.path.replace(/\\/g, "/"));
      });
      
      const sassFileName = ThemeTypes.cssFileNameBase(cssFile) + '.scss';
      
      return this._loadSassFile(dirStack, sassFileName, variables)
        .then( (cssText: string): { cssFile: CssFile; cssText: string;} => {
          // if (theme.debug) {
          //   this._log.debug(`Sass output for ${theme.name}, ${ThemeTypes.cssFileNameBase(cssFile)}`, cssText);
          // }
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

  private _loadSassFile(dirStack: string[], sassFileName: string, variables?: Map<string, string>): Promise<string> {
    let formattedVariables = "";
    if (variables !== undefined) {
      variables.forEach( (value, key) => {
          formattedVariables += `$${key}: "${value}";
`;
        });
    }
    if (DEBUG_SASS) {
      this._log.debug("Formatted SASS variables: ", formattedVariables);
    }
    
    return new Promise<string>( (resolve, cancel) => {
      if (DEBUG_SASS) {
        this._log.debug("Processing " + sassFileName);
      }
      try {
        sass.importer(null);
        
        sass.importer( (request, done) => {
          
          const basePath = request.resolved.startsWith(path.sep) ? request.resolved.substr(1) : request.resolved;
          const dirName = path.dirname(basePath);
          const baseName = path.basename(basePath);
          
          if (DEBUG_SASS_FINE) {
            this._log.debug("Importer:", request);
            this._log.debug("dirName:", dirName);
            this._log.debug("baseName:", baseName);
          }
          
          const candidates = [basePath,
            path.join(dirName, '_' + baseName + '.scss'),
            path.join(dirName, '_' + baseName + '.sass'),
            path.join(dirName, '_' + baseName + '.css'),
            basePath + '.scss',
            basePath + '.sass',
            basePath + '.css'
          ];
          
          for (let candidate of candidates) {
            const candidateFileName = this._findFile(dirStack, candidate);
            if (DEBUG_SASS_FINE) {
              this._log.debug("Trying " + candidateFileName);
            }
            if (candidateFileName) {
              if (DEBUG_SASS_FINE) {
                this._log.debug("Importing SASS file " + candidateFileName);
              }
              try {
                const content = fs.readFileSync(candidateFileName, {encoding: 'utf-8'});
                done( { content: content } );
              } catch(err) {
                done( { error: "" + err } );
              }
              return;
            }
          }
          
          done( { error: "Unable to find " + basePath } );
        });
        
        // Start the compile using a small virtual 'boot' file.
        const scssText = formattedVariables + '\n@import "' + sassFileName + '";\n';
        if (DEBUG_SASS_FINE) {
          this._log.debug("Root sass text: ", scssText);
        }

        sass.compile(scssText, { precision: 8, inputPath: '__boot__' }, (result) => {
          if (result.status === 0) {
            const successResult = <sass.SuccessResult> result;
            if (DEBUG_SASS) {
              this._log.debug("Succeeded done processing " + sassFileName);
            }

            resolve(successResult.text);
          } else {
            const errorResult = <sass.ErrorResult> result;
            this._log.warn("An SASS error occurred while processing " + sassFileName, errorResult,
              errorResult.formatted);
            if (DEBUG_SASS) {
              this._log.debug("Failed processing " + sassFileName);
            }
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
  
  private _findFile(dirStack: string[], fileName: string): string {
    if (DEBUG_SASS_FINE) {
      this._log.debug(`findFile(): Looking for ${fileName} in dirs ${dirStack}`);
    }    
    for (const dir of dirStack) {
      const candidateFileName = path.join(dir, fileName);
      if (DEBUG_SASS_FINE) {
        this._log.debug(`findFile(): Checking ${candidateFileName}`);
      }    
      if (fs.existsSync(candidateFileName) && fs.statSync(candidateFileName).isFile()) {
        return candidateFileName;
      }
    }
    return null;
  }  
}

function themeStackCacheKey(themeIds: string[]): string {
  return themeIds.reduce( (accu, id) => accu + "/" + id, "");
}

export function makeThemeManager(directories: string[]): ThemeManager {
  return new ThemeManagerImpl(directories);
}
