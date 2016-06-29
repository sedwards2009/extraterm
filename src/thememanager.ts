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

export interface RenderResult {
  success: boolean;
  themeContents: ThemeContents;
  errorMessage: string;
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
  renderThemes(themeIdList: string[]): Promise<RenderResult>;
  
  registerChangeListener(themeIdOrList: string | string[], listener: ListenerFunc): void;
  
  unregisterChangeListener(themeIdOrList: string | string[]): void;
}

interface ListenerItem {
  themeId: string;
  listenerFunc: ListenerFunc;
  watcher: fs.FSWatcher;
}

//-------------------------------------------------------------------------
//
//  #######                             #     #                                           ###                      
//     #    #    # ###### #    # ###### ##   ##   ##   #    #   ##    ####  ###### #####   #  #    # #####  #      
//     #    #    # #      ##  ## #      # # # #  #  #  ##   #  #  #  #    # #      #    #  #  ##  ## #    # #      
//     #    ###### #####  # ## # #####  #  #  # #    # # #  # #    # #      #####  #    #  #  # ## # #    # #      
//     #    #    # #      #    # #      #     # ###### #  # # ###### #  ### #      #####   #  #    # #####  #      
//     #    #    # #      #    # #      #     # #    # #   ## #    # #    # #      #   #   #  #    # #      #      
//     #    #    # ###### #    # ###### #     # #    # #    # #    #  ####  ###### #    # ### #    # #      ######
//
//-------------------------------------------------------------------------
class ThemeManagerImpl implements ThemeManager {
  
  private _log = new Logger("ThemeManagerImpl");
  
  private _directories: string[] = null;
  
  private _themes: Map<string, ThemeInfo> = null;
  
  private _cacheDirectory: string = null;
  
  private _themeContentsCache: ThemeCache = null;
  
  private _listeners: ListenerItem[] = [];
  
  constructor(directories: string[], cacheDirectory: string=null) {
    this._directories = directories;
    this._cacheDirectory = cacheDirectory;
    this._themeContentsCache = new ThemeCache(this._directories, this._cacheDirectory);
    this._themeContentsCache.load();

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

  renderThemes(themeStack: string[]): Promise<RenderResult> {
    const themeInfoList = this._themeIdListToThemeInfoList(themeStack);

    // Look for this combo in the cache.
    const contents = this._themeContentsCache.get(themeStack);
    
    if (contents === null) {
      return this._renderThemeStackContents(themeInfoList)
        .then( (renderResults) => {
          this._themeContentsCache.set(themeStack, renderResults.themeContents);
          return renderResults;
        });
    } else {
      return new Promise<RenderResult>( (resolve, cancel) => {
        const result: RenderResult = {
          success: true,
          themeContents: contents,
          errorMessage: null
        };
        
        resolve(result);
      });
    }
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
  
  registerChangeListener(themeIdOrStack: string | string[], listenerFunc: (theme: ThemeInfo) => void): void {
    const themeStack = _.uniq(Array.isArray(themeIdOrStack) ? themeIdOrStack : [themeIdOrStack]);
    const themeInfoList = this._themeIdListToThemeInfoList(themeStack);
    
    themeStack.forEach( (themeId) => {
      const themeInfo = this.getTheme(themeId);
      const themePath = themeInfo.path;
      
      const watcher = fs.watch(themePath, { persistent: false },
        (event, filename) => {
          const contents = this._themeContentsCache.get(themeStack);

          if (contents !== null) {
            const oldThemeContents = contents;
            
            this._renderThemeStackContents(themeInfoList)
              .then( (renderResult) => {
                const newThemeContents = renderResult.themeContents;
                if ( ! _.isEqual(oldThemeContents, newThemeContents)) {
                  this._themeContentsCache.set(themeStack, newThemeContents);
                  listenerFunc(themeInfo);
                } else {
                  this._log.info("" + filename + " changed, but the theme contents did not.");
                }
              });
          } else {
            this.renderThemes(themeStack).then( (result) => {
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

  private _renderThemeStackContents(themeStack: ThemeInfo[]): Promise<RenderResult> {
    return this._recursiveRenderThemeStackContents(ThemeTypes.cssFileEnumItems.slice(0), themeStack);
  }

  private _recursiveRenderThemeStackContents(todoCssFile: ThemeTypes.CssFile[], themeStack: ThemeInfo[]):
      Promise<RenderResult> {
        
    if (DEBUG_SASS) {
      this._log.debug("Compiling _recursiveRenderThemeStackContents:" + todoCssFile.length);
    }
    
    const cssFile = todoCssFile[0];
    const dirStack = _.uniq(themeStack.map( (themeInfo) => themeInfo.path ));
    const sassFileName = ThemeTypes.cssFileNameBase(cssFile) + '.scss';
    
    // Create SASS variables for the location of each theme directory.
    const variables = new Map<string, string>();
    themeStack.forEach( (themeInfo) => {
      variables.set('--source-dir-' + themeInfo.id, themeInfo.path.replace(/\\/g, "/"));
    });
    
    if (DEBUG_SASS) {
      this._log.debug("Compiling " + sassFileName);
      this._log.startTime("Compiling " + sassFileName);
    }
    
    const loadSassPromise = this._loadSassFile(dirStack, sassFileName, variables);
    return loadSassPromise.then( (cssText) => {
      
      if (DEBUG_SASS) {
        this._log.endTime("Compiling " + sassFileName);
        this._log.debug("Done " + sassFileName);
      }
      
      if (todoCssFile.length <= 1) {
        // Done. Send back some results.
        const themeContents: ThemeContents = {
          cssFiles: {}
        };
        themeContents.cssFiles[ThemeTypes.cssFileNameBase(cssFile)] = cssText;
        const renderResult: RenderResult = { success: true, themeContents: themeContents, errorMessage: null };
        return renderResult;
      } else {
        return this._recursiveRenderThemeStackContents(todoCssFile.slice(1), themeStack)
          .then( (renderResult: RenderResult) => {
            renderResult.themeContents.cssFiles[ThemeTypes.cssFileNameBase(cssFile)] = cssText;
            return renderResult;
          });
      }
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
            cancel(new Error("An SASS error occurred while processing " + sassFileName + "\n" + errorResult.formatted));
          }
        });
      } catch (err) {
        this._log.warn("An error occurred while processing " + sassFileName, err);
        cancel(err);
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

//-------------------------------------------------------------------------
//
//   #####                              
//  #     #   ##    ####  #    # ###### 
//  #        #  #  #    # #    # #      
//  #       #    # #      ###### #####  
//  #       ###### #      #    # #      
//  #     # #    # #    # #    # #      
//   #####  #    #  ####  #    # ###### 
//
//-------------------------------------------------------------------------

interface ThemeCacheEntry {
  timeStamp: number;        // Time stamp of the cache file 
  contents: ThemeContents;
}

const THEME_CACHE_ENTRY_SUFFIX = ".json";

class ThemeCache {
  
  private _log = new Logger("ThemeCache");
  
  private _themeDirectories: string[] = null;
  
  private _cacheDirectory: string = null;
  
  private _cache: Map<string, ThemeCacheEntry> = new Map();
  
  /**
   * Construct a theme cache instance.
   * 
   * @param  themeDirectories list of directories to look for theme files
   * @param  cacheDirectory location of the cache directory on disk
   */
  constructor(themeDirectories: string[], cacheDirectory: string) {
    this._themeDirectories = [...themeDirectories];
    this._cacheDirectory = cacheDirectory;
  }
  
  /**
   * Loads the cache metadata from disk.
   *
   * This should be called after construction but before use of the cache.
   */
  load(): void {
    const contents = fs.readdirSync(this._cacheDirectory);

    contents.forEach( (item) => {
      const itemPath = path.join(this._cacheDirectory, item);
      const info = fs.lstatSync(itemPath);
      if (info.isFile() && item.endsWith(THEME_CACHE_ENTRY_SUFFIX)) {
        const baseName = item.substr(0, item.length- THEME_CACHE_ENTRY_SUFFIX.length);
        this._cache.set(baseName, {
          timeStamp: info.mtime.getTime(),
          contents: null
        });        
      }
    });
    
  }

  /**
   * Gets the rendered CSS data for a stack of themes
   * 
   * @param  themeStack stack of theme names
   * @return the theme contents if it is available in the cache, otherwise null
   */
  get(themeStack: string[]): ThemeContents {
    const key = themeStackName(themeStack);
    const entry = this._cache.get(key);
    if (entry === undefined) {
      return null;
    }
    
    // Check the timestamps of the theme directory files with the timestamp on the cache file.
    const timeStamps = themeStack.map( (themeName) => recursiveDirectoryLastModified(findThemePath(this._themeDirectories, themeName)));
    const latestTimeStamp = Math.max(...timeStamps);
    const now = (new Date()).getTime();
    if (entry.timeStamp <= latestTimeStamp) {
      // Cache file is older than the timestamps on the theme directories.
      return null;
    }
    
    // We have a cached entry and it is all good.
    if (entry.contents === null) {
      // Load in the data from disk.
      const cacheFileName = path.join(this._cacheDirectory, key + THEME_CACHE_ENTRY_SUFFIX);
      const fileContents = fs.readFileSync(cacheFileName, { encoding: "utf-8" });
      entry.contents = <ThemeContents> JSON.parse(fileContents);
    }
    return entry.contents;
  }
  
  /**
   * Stores rendered theme data in the cache
   * 
   * @param themeStack the stack of theme names the data belongs to
   * @param contents   the theme contents
   */
  set(themeStack: string[], contents: ThemeContents): void {
    const now = (new Date()).getTime();
    const key = themeStackName(themeStack);
    
    const entry: ThemeCacheEntry = { timeStamp: now, contents };
    
    this._cache.set(key, entry);
    const fileName = path.join(this._cacheDirectory, key + THEME_CACHE_ENTRY_SUFFIX);
    fs.writeFileSync(fileName, JSON.stringify(entry.contents), { encoding: "utf-8" });
  }
}

/**
 * Maps a stack of theme names to a file name
 * 
 * @param  themeStack the stack of theme names to encode into a file name
 * @return the file name which encodes the list of theme names
 */
function themeStackName(themeStack: string[]): string {
  // We use the period char to separate parts of the theme names.
  return themeStack.map(escapeThemeFileName).join(".");
}

function escapeThemeFileName(name: string): string {
  return name.replace(/_/g, "__").replace(/\./g, "_.");
}

function unescapeThemeFileName(name: string): string {
  return name.replace(/_\./g, ".").replace(/__/g, "_");
}

/**
 * Decomposes a theme cache file name into a stack theme names.
 * 
 * @param  fileName the base file name without extension
 * @return the stack of theme names
 */
function decomposeThemeStackName(fileName: string): string[] {
  const parts = fileName.split(/\./g).reduce( (accu, part) => {
      if (accu.length === 0) {
        return [part];
      } else {
        const last = accu[accu.length-1];
        if (last.endsWith("_")) {
          accu[accu.length-1] = last + "." + part;
          return accu;
        } else {
          return [...accu, part];
        }
      }
    }, []);
  return parts.map(unescapeThemeFileName);
}

/**
 * Finds the path of a path in a list of directories.
 * 
 * @param  themeDirectories the list of directories to search
 * @param  themeName        the theme to search for
 * @return                  the full path to the theme directory or null if it could not be found
 */
function findThemePath(themeDirectories: string[], themeName: string): string {
  for (let themeDir of themeDirectories) {
    const fullThemePath = path.join(themeDir, themeName);
    if (fs.existsSync(fullThemePath)) {
      return fullThemePath;
    }
  }
  return null;
}

function recursiveDirectoryLastModified(directory: string): number {
  let lastModified = -1;
  const contents = fs.readdirSync(directory);
    
  contents.forEach( (item) => {
    const itemPath = path.join(directory, item);
    const info = fs.lstatSync(itemPath);
    if (info.isFile()) {
      lastModified = Math.max(info.mtime.getTime(), lastModified);
    } else if (info.isDirectory()) {
      lastModified = Math.max(recursiveDirectoryLastModified(itemPath), lastModified);
    }
  } );
  
  return lastModified;
}

export function makeThemeManager(directories: string[], cacheDirectory: string=null): ThemeManager {
  return new ThemeManagerImpl(directories, cacheDirectory);
}
