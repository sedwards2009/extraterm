/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

import * as SourceDir from '../SourceDir';

const PATCH_MODULE_VERSION = "53";  // This version number also appears in build_package.js
const previousSASS_BINARY_PATH = process.env.SASS_BINARY_PATH;
if (process.versions.modules === PATCH_MODULE_VERSION) {
  // Patch in our special node-sass binary for the V8 module version used by Electron.
  process.env.SASS_BINARY_PATH = path.join(SourceDir.path,
    `../resources/node-sass-binary/${process.platform}-${process.arch}-${PATCH_MODULE_VERSION}/binding.node`);
}
import * as NodeSass from 'node-sass';

if (previousSASS_BINARY_PATH === undefined) {
  delete process.env.SASS_BINARY_PATH;
} else {
  process.env.SASS_BINARY_PATH = previousSASS_BINARY_PATH;
}


import {Logger, getLogger} from '../logging/Logger';
import log from '../logging/LogDecorator';
import {CssFile, ThemeInfo, ThemeContents, ThemeType, CSS_MODULE_INTERNAL_GUI, CSS_MODULE_INTERNAL_TERMINAL,
  CSS_MODULE_INTERNAL_SYNTAX, cssFileEnumItems, FALLBACK_SYNTAX_THEME, FALLBACK_TERMINAL_THEME, FALLBACK_UI_THEME,
  cssFileToFilename, cssFileToExtension} from './Theme';
import { Config } from '../Config';
import { MainExtensionManager } from '../main_process/extension/MainExtensionManager';
import { ExtensionCss, ExtensionMetadata } from '../ExtensionMetadata';

const THEME_CONFIG = "theme.json";

const DEBUG_SASS = false;
const DEBUG_SASS_FINE = false;
const DEBUG_SCAN = false;

interface ListenerFunc {
  (theme: ThemeInfo): void;
}

type GlobalVariableMap = Map<string, number|boolean|string>;

interface RenderResult {
  success: boolean;
  themeContents: ThemeContents;
  errorMessage: string;
}

interface CssDirectory {
  id: string;
  path: string;
}


export class ThemeManager {
  
  private _log: Logger = null;
  private _config: Config = null;
  private _themes: Map<string, ThemeInfo> = null;
  
  constructor(private _directories: string[], private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("ThemeManagerImpl", this);

    const allThemes = new Map<string, ThemeInfo>();
    this._directories.forEach( (directory) => {
      const themes = this._scanThemeDirectory(directory);
      themes.forEach( (value, key) => {
        allThemes.set(key, value);
      });
    });
    
    this._themes = allThemes;
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
    
    const lbc = themeInfo.loadingBackgroundColor;
    themeInfo.loadingBackgroundColor = lbc === undefined ? "#ffffff" : lbc;

    const lfc = themeInfo.loadingForegroundColor;
    themeInfo.loadingForegroundColor = lfc === undefined ? "#000000" : lfc;
  }

  private _validateThemeInfo(themeinfo: ThemeInfo): boolean {
    return _.isString(themeinfo.name) && themeinfo.name !== "";
  }
  
  getTheme(themeId: string): ThemeInfo {
    return this._themes.get(themeId) || null;
  }
  
  getAllThemes(): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    this._themes.forEach( themeInfo => {
      if (themeInfo.type.indexOf("gui") !== -1 && themeInfo.id === "default") {
        return;
      }
      result.push(themeInfo);
    });
    return result;
  }

  setConfig(config: Config): void {
    this._config = config;
  }

  async render(themeType: ThemeType, globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    let moduleName = "";
    let themeNameStack: string[] = null;
    let fallbackTheme = "";
    switch (themeType) {
      case "gui":
        moduleName = CSS_MODULE_INTERNAL_GUI;
        themeNameStack = [this._config.themeGUI, FALLBACK_UI_THEME];
        fallbackTheme = FALLBACK_UI_THEME;
        break;

      case "terminal":
        moduleName = CSS_MODULE_INTERNAL_TERMINAL;
        themeNameStack = [this._config.themeTerminal, FALLBACK_TERMINAL_THEME];
        fallbackTheme = FALLBACK_TERMINAL_THEME;
        break;

      case "syntax":
        moduleName = CSS_MODULE_INTERNAL_SYNTAX;
        themeNameStack = [this._config.themeSyntax, FALLBACK_SYNTAX_THEME];
        fallbackTheme = FALLBACK_SYNTAX_THEME;
        break;
    }

    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === moduleName);

    // Add extra CSS files needed by extensions.
    let result = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
    if ( ! result.success) {
      themeNameStack = [fallbackTheme];
      const fallbackResult = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
      fallbackResult.errorMessage = result.errorMessage;
      result = fallbackResult;
    }

    if (themeType === "gui") {
      // Now render the CSS files for the extensions.

      const extensionResult = await this._renderAllExtensionCss(themeNameStack, globalVariables);
      if ( ! extensionResult.success) {
        result.success = false;
      }
      result.themeContents.cssFiles = [...result.themeContents.cssFiles, ...extensionResult.themeContents.cssFiles];
      result.errorMessage += extensionResult.errorMessage + "\n";
    }

    return result;
  }

  private _renderThemes(themeStack: string[], cssFileList: CssFile[], globalVariables: GlobalVariableMap): Promise<RenderResult> {
    const themeInfoList = this._themeIdListToThemeInfoList(themeStack);
    return this._renderCssFiles(themeInfoList, cssFileList, globalVariables);
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
  
  private async _renderCssFiles(cssDirectoryStack: CssDirectory[], cssFileList: CssFile[],
      globalVariables: GlobalVariableMap): Promise<RenderResult> {

    const renderResult: RenderResult = {
      success: true,
      themeContents: {
        cssFiles: []
      },
      errorMessage: ""
    };

    // Create SASS variables for the location of each theme directory.
    const variables = new Map<string, number|boolean|string>(globalVariables);
    cssDirectoryStack.forEach( cssDirectory => {
      variables.set('--source-dir-' + cssDirectory.id, cssDirectory.path.replace(/\\/g, "/"));
    });

    const dirPathStack = _.uniq(cssDirectoryStack.map( themeInfo => themeInfo.path ));

    for (const cssFile of cssFileList) {
      const {errorMessage, cssText} = await this._renderCssFile(cssFile, dirPathStack, variables);
      if (errorMessage == null) {
        renderResult.themeContents.cssFiles.push({cssFileName: cssFile, contents: cssText});
      } else {
        renderResult.success = false;
        renderResult.errorMessage += errorMessage + "\n";
      }
    }
    return renderResult;
  }

  private async _renderCssFile(cssFile: CssFile, dirPathStack: string[], variables: GlobalVariableMap
    ): Promise<{cssText: string, errorMessage: string}> {
        
    if (DEBUG_SASS) {
      this._log.debug("Compiling _recursiveRenderThemeStackContents: " + cssFile);
    }
    
    const sassFileName = cssFileToFilename(cssFile);
    
    if (DEBUG_SASS) {
      this._log.debug("Compiling " + sassFileName);
      this._log.startTime("Compiling " + sassFileName);
    }
    try {
      const cssText = await this._loadSassFile(dirPathStack, sassFileName, variables);
      if (DEBUG_SASS) {
        this._log.endTime("Compiling " + sassFileName);
        this._log.debug("Done " + sassFileName);
      }
      return {cssText, errorMessage: null};
    } catch(ex) {
      return {cssText: null, errorMessage: ex.message + " (Directories: " + dirPathStack.join(", ") +" )"};
    } 
  }

  private _loadSassFile(dirPathStack: string[], sassFileName: string, variables?: GlobalVariableMap): Promise<string> {
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
        const importer: NodeSass.Importer = (url: string, prev: string, done: (data: NodeSass.ImporterReturnType)=> void) => {
          
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
            const candidateFileName = this._findFile(dirPathStack, candidate);
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

        NodeSass.render({data: scssText, precision: 8, importer: importer }, (err, result) => {
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

  private async _renderAllExtensionCss(themeNameStack: string[], globalVariables: GlobalVariableMap): Promise<RenderResult> {
    const cssDirectoryStack = this._themeIdListToThemeInfoList(themeNameStack);
    
    const renderResult: RenderResult = {
      success: true,
      themeContents: {
        cssFiles: []
      },
      errorMessage: ""
    };

    for (const extensionMetadata of this._mainExtensionManager.getExtensionMetadata()) {
      for (const viewerMetadata of extensionMetadata.contributions.viewer) {
        const nextResult = await this._renderExtensionCss(cssDirectoryStack, globalVariables, extensionMetadata,
          viewerMetadata.css);

        if ( ! nextResult.success) {
          renderResult.success = false;
        }
        if (nextResult.errorMessage != null && nextResult.errorMessage !== "") {
          renderResult.errorMessage = renderResult.errorMessage + "\n" + nextResult.errorMessage;
        }
        renderResult.themeContents.cssFiles = [...renderResult.themeContents.cssFiles, ...nextResult.themeContents.cssFiles];
      }
    }

    return renderResult;
  }

  private async _renderExtensionCss(cssDirectoryStack: CssDirectory[],
      globalVariables: GlobalVariableMap,
      extensionMetadata: ExtensionMetadata,
      extensionCssDecl: ExtensionCss): Promise<RenderResult> {

    if (extensionCssDecl == null) {
      return {success: true, errorMessage: null, themeContents: {cssFiles: []} };
    }

    const cssDirectory = path.join(extensionMetadata.path, extensionCssDecl.directory);
    const extDirStack = [{id: extensionMetadata.name, path: cssDirectory}, ...cssDirectoryStack];
    const cookedCssFiles = extensionCssDecl.cssFile.map(cssFile => extensionMetadata.name + ":" + cssFile);

    const variables = new Map<string, number|boolean|string>(globalVariables);
    variables.set('--source-dir-' + extensionMetadata.name, extensionCssDecl.directory.replace(/\\/g, "/"));

    return this._renderCssFiles(extDirStack, cookedCssFiles, globalVariables);
  }
}
