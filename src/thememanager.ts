/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs = require('fs');
import path = require('path');

import sourceDir = require('./sourceDir');
const MODULE_VERSION = "50";
if (process.versions.modules === MODULE_VERSION) {
  // Patch in our special node-sass binary for V8 module verion 49 as used by Electron.
  process.env.SASS_BINARY_PATH = path.join(sourceDir.path,
    `node-sass-binary/${process.platform}-${process.arch}-${MODULE_VERSION}/binding.node`);
}
import nodeSass = require('node-sass');

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
  renderThemes(themeIdList: string[], cssFileList: CssFile[], globalVariables?: Map<string, number|boolean|string>): Promise<RenderResult>;
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

  renderThemes(themeStack: string[], cssFileList: CssFile[], globalVariables?: Map<string, number|boolean|string>): Promise<RenderResult> {
    const themeInfoList = this._themeIdListToThemeInfoList(themeStack);
    globalVariables = globalVariables || new Map<string, number|boolean|string>();

    return this._renderThemeStackContents(themeInfoList, cssFileList, globalVariables)
      .then( (renderResults) => {
        return renderResults;
      });
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
    }
    return themeMap;
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

  private _renderThemeStackContents(themeStack: ThemeInfo[], cssFileList: CssFile[], globalVariables: Map<string, number|boolean|string>): Promise<RenderResult> {
    return this._recursiveRenderThemeStackContents(cssFileList.slice(0), themeStack, globalVariables);
  }

  private _recursiveRenderThemeStackContents(todoCssFile: ThemeTypes.CssFile[], themeStack: ThemeInfo[], globalVariables: Map<string, number|boolean|string>):
      Promise<RenderResult> {
        
    if (DEBUG_SASS) {
      this._log.debug("Compiling _recursiveRenderThemeStackContents:" + todoCssFile.length);
    }
    
    const cssFile = todoCssFile[0];
    const dirStack = _.uniq(themeStack.map( (themeInfo) => themeInfo.path ));
    const sassFileName = ThemeTypes.cssFileNameBase(cssFile) + '.scss';
    
    // Create SASS variables for the location of each theme directory.
    const variables = new Map<string, number|boolean|string>(globalVariables);
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
        return this._recursiveRenderThemeStackContents(todoCssFile.slice(1), themeStack, globalVariables)
          .then( (renderResult: RenderResult) => {
            renderResult.themeContents.cssFiles[ThemeTypes.cssFileNameBase(cssFile)] = cssText;
            return renderResult;
          });
      }
    });
  }

  private _loadSassFile(dirStack: string[], sassFileName: string, variables?: Map<string, number|boolean|string>): Promise<string> {
    let formattedVariables = "";
    if (variables !== undefined) {
      variables.forEach( (value, key) => {
          const formattedValue = typeof(value) === "string" ? `"${value}"` : "" + value;
          formattedVariables += `$${key}: ${formattedValue};
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
        const importer: nodeSass.Importer = (url: string, prev: string, done: (data: { file?: string; contents?: string; })=> void) => {
          
          const basePath = url;
          const contextBaseDir = path.dirname(prev);
          const dirName = path.join(contextBaseDir, path.dirname(basePath));
          const baseName = path.basename(basePath);
          
          if (DEBUG_SASS_FINE) {
            this._log.debug(`Import request: URL: ${url} prev: ${prev}`);
            this._log.debug("dirName:", dirName);
            this._log.debug("baseName:", baseName);
            this._log.debug("contextBaseDir:", contextBaseDir);
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
            if (candidateFileName) {
              if (DEBUG_SASS_FINE) {
                this._log.debug("Trying " + candidateFileName);
              }
              if (DEBUG_SASS_FINE) {
                this._log.debug("Importer returning SASS file: " + candidateFileName);
              }
              try {
                const content = fs.readFileSync(candidateFileName, {encoding: 'utf-8'});
                done( { contents: content } );
              } catch(err) {
                done(err);
              }
              return;
            }
          }
          
          done(new Error("Unable to find " + basePath));
        };
        
        // Start the compile using a small virtual 'boot' file.
        const scssText = formattedVariables + '\n@import "' + sassFileName + '";\n';
        if (DEBUG_SASS_FINE) {
          this._log.debug("Root sass text: ", scssText);
        }

        nodeSass.render({data: scssText, precision: 8, importer: importer }, (err, result) => {
          if (err === null) {
            if (DEBUG_SASS) {
              this._log.debug("Succeeded done processing " + sassFileName);
            }

            resolve(result.css.toString('utf8'));
          } else {
            this._log.warn("An SASS error occurred while processing " + sassFileName, err, err.message);
            if (DEBUG_SASS) {
              this._log.debug("Failed processing " + sassFileName);
            }
            cancel(new Error("An SASS error occurred while processing " + sassFileName + "\n" + err.message));
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

export function makeThemeManager(directories: string[]): ThemeManager {
  return new ThemeManagerImpl(directories);
}
