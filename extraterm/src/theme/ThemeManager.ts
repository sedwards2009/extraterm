/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

import * as SourceDir from '../SourceDir';

const PATCH_MODULE_VERSION = "57";  // This version number also appears in build_package.js
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


import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import {CssFile, ThemeInfo, ThemeContents, ThemeType, CSS_MODULE_INTERNAL_GUI, CSS_MODULE_INTERNAL_TERMINAL,
  CSS_MODULE_INTERNAL_SYNTAX, cssFileEnumItems, FALLBACK_SYNTAX_THEME, FALLBACK_TERMINAL_THEME, FALLBACK_UI_THEME,
  cssFileToFilename, cssFileToExtension, SYNTAX_CSS_THEME} from './Theme';
import { AcceptsConfigDatabase, ConfigDatabase, GENERAL_CONFIG } from '../Config';
import { MainExtensionManager } from '../main_process/extension/MainExtensionManager';
import { ExtensionCss, ExtensionMetadata } from '../ExtensionMetadata';
import { SyntaxTheme } from 'extraterm-extension-api';

const THEME_CONFIG = "theme.json";

const DEBUG_SASS = false;
const DEBUG_SASS_FINE = false;
const DEBUG_SCAN = false;

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


export class ThemeManager implements AcceptsConfigDatabase {
  
  private _log: Logger = null;
  private _configDistributor: ConfigDatabase = null;
  private _themes: Map<string, ThemeInfo> = null;
  
  constructor(private _paths: string[], private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("ThemeManagerImpl", this);
    this._updateThemesList();
  }

  private _updateThemesList(): void {
    this._themes = this._scanThemePaths(this._paths, this._getSyntaxThemeExtensionPaths());
  }

  private _getSyntaxThemeExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getExtensionMetadata()) {
      for (const st of extension.contributions.syntaxTheme) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanThemePaths(paths: string[], syntaxThemePaths: string[]): Map<string, ThemeInfo> {
    let themesList: ThemeInfo[] = [];
    for (const themePath of paths) {
      themesList = [...themesList, ...this._scanThemePath(themePath)];
    }

    themesList = [...themesList, ...this._scanThemesWithSyntaxThemeProviders([...paths, ...syntaxThemePaths])];

    const allThemes = new Map<string, ThemeInfo>();
    themesList.forEach( themeInfo => {
      allThemes.set(themeInfo.id, themeInfo);
    });

    return allThemes;
  }

  setConfigDatabase(configDistributor: ConfigDatabase): void {
    this._configDistributor = configDistributor;
  }

  /**
   * Scan for themes.
   * 
   * @param themesdir The directory to scan for themes.
   * @returns Map of found theme config objects.
   */
  private _scanThemePath(themePath: string): ThemeInfo[] {
    const themes: ThemeInfo[] = [];
    if (fs.existsSync(themePath)) {
      const contents = fs.readdirSync(themePath);
      for (const item of contents) {
        const infoPath = path.join(themePath, item, THEME_CONFIG);
        if (fs.existsSync(infoPath)) {
          try {
            const infoStr = fs.readFileSync(infoPath, {encoding: "utf8"});
            const themeInfo = <ThemeInfo>JSON.parse(infoStr);
            themeInfo.path = path.join(themePath, item);
            themeInfo.id = item;
            this._fillThemeInfoDefaults(themeInfo);
            
            if (this._validateThemeInfo(themeInfo)) {
              themes.push(themeInfo);
            }
            
            if (DEBUG_SCAN) {
              this._log.debug(`ThemeInfo<name=${themeInfo.name}, id=${themeInfo.id}, type=${themeInfo.type}, path=${themeInfo.path}, provider=${themeInfo.provider}>`);
            }

          } catch(err) {
            this._log.warn("Warning: Unable to read file ", infoPath, err);
          }
        }
      }
    }
    return themes;
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

  private _scanThemesWithSyntaxThemeProviders(paths: string[]): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    for (const provider of this._mainExtensionManager.getSyntaxThemeProviderContributions()) {
      for (const theme of provider.syntaxThemeProvider.scanThemes(paths)) {
        const themeId = provider.metadata.name + ":" + theme.id;
        const themeInfo: ThemeInfo = {
          id: themeId,
          type: 'syntax',
          debug: false,
          name: theme.name,
          comment: theme.comment,
          path: null,
          provider: provider.metadata.name,
          loadingBackgroundColor: null,
          loadingForegroundColor: null
        };

        if (DEBUG_SCAN) {
          this._log.debug(themeInfo);
        }

      result.push(themeInfo);
      }
    }
    return result;
  }

  getTheme(themeId: string): ThemeInfo {
    return this._themes.get(themeId) || null;
  }
  
  getAllThemes(): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    this._themes.forEach( themeInfo => {
      if (themeInfo.type === "gui" && themeInfo.id === "default") {
        return;
      }
      result.push(themeInfo);
    });
    return result;
  }

  async render(themeType: ThemeType, globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    switch (themeType) {
      case "gui":
        return await this._renderGui(globalVariables);
      case "terminal":
        return await this._renderTerminal(globalVariables);
      case "syntax":
        return await this._renderSyntax(globalVariables);
    }
    return null;
  }

  async _renderGui(globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    const config = this._configDistributor.getConfig(GENERAL_CONFIG);
    let themeNameStack = [config.themeGUI, FALLBACK_UI_THEME];
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_GUI);

    // Add extra CSS files needed by extensions.
    let result = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
    if ( ! result.success) {
      themeNameStack = [FALLBACK_UI_THEME];
      const fallbackResult = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
      fallbackResult.errorMessage = result.errorMessage;
      result = fallbackResult;
    }

    // Now render the CSS files for the extensions.
    const extensionResult = await this._renderAllExtensionCss(themeNameStack, globalVariables);
    if ( ! extensionResult.success) {
      result.success = false;
    }
    result.themeContents.cssFiles = [...result.themeContents.cssFiles, ...extensionResult.themeContents.cssFiles];
    result.errorMessage += extensionResult.errorMessage + "\n";
    return result;
  }

  async _renderTerminal(globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    const config = this._configDistributor.getConfig(GENERAL_CONFIG);
    let themeNameStack = [config.themeTerminal, FALLBACK_TERMINAL_THEME];
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_TERMINAL);

    // Add extra CSS files needed by extensions.
    let result = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
    if ( ! result.success) {
      themeNameStack = [FALLBACK_TERMINAL_THEME];
      const fallbackResult = await this._renderThemes(themeNameStack, neededCssFiles, globalVariables);
      fallbackResult.errorMessage = result.errorMessage;
      result = fallbackResult;
    }

    return result;
  }
  
  async _renderSyntax(globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    const config = this._configDistributor.getConfig(GENERAL_CONFIG);
    this._log.debug(`Rendering syntax theme for ${config.themeSyntax}`);

    const syntaxThemeInfo = this._themes.get(config.themeSyntax);
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_SYNTAX);
    try {
      // Add extra CSS files needed by extensions.
      const result = await this._renderThemes([SYNTAX_CSS_THEME], neededCssFiles, globalVariables);
      const syntaxCss = this._formatSyntaxTheme(syntaxThemeInfo);
      result.themeContents.cssFiles[0].contents = result.themeContents.cssFiles[0].contents + syntaxCss;
      this._log.debug(`Complete syntax theme CSS is: ${result.themeContents.cssFiles[0].contents}`);
      return result;
    } catch(ex) {
      this._log.debug(ex);
      return null;
    }
  }

  private _renderThemes(themeStack: string[], cssFileList: CssFile[], globalVariables: GlobalVariableMap): Promise<RenderResult> {
    const themeInfoList = this._themeIdListToThemeInfoList(themeStack);
    return this._renderCssFiles(themeInfoList, cssFileList, globalVariables);
  }
  
  private _themeIdListToThemeInfoList(themeIdList: string[]): ThemeInfo[] {
    // Convert the list of theme IDs to a list of ThemeInfos
    const themeInfoList = themeIdList.map( themeId => {
      const themeInfo = this.getTheme(themeId);
      if (themeInfo === null) {
        this._log.warn("The requested theme name '" + themeId + "' is unknown.");
        return null;
      } else {
        return themeInfo;
      }
    }).filter( themeInfo => themeInfo !== null );
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

  private _formatSyntaxTheme(syntaxThemeInfo: ThemeInfo): string {
    const contents = this._getSyntaxThemeContentsFromInfo(syntaxThemeInfo);
    if (contents == null) {
      this._log.warn(`Unable to find syntax theme contents for ID ${syntaxThemeInfo.id}`);
    }
    return this._formatSyntaxThemeAsCss(contents);
  }

  private _getSyntaxThemeContentsFromInfo(syntaxThemeInfo: ThemeInfo): SyntaxTheme {
    const paths = [...this._paths, ...this._getSyntaxThemeExtensionPaths()];
    for (const provider of this._mainExtensionManager.getSyntaxThemeProviderContributions()) {
      if (provider.metadata.name === syntaxThemeInfo.provider) {
        const parts = syntaxThemeInfo.id.split(":");
        if (parts.length === 2) {
          return provider.syntaxThemeProvider.readTheme(paths, parts[1]);
        }
      }
    }

    return null;
  }

  private _formatSyntaxThemeAsCss(syntaxTheme: SyntaxTheme): string {
    const lines: string[]  = [];

    const cursorColor = syntaxTheme.cursor != null ? syntaxTheme.cursor : "#ffb300";
    lines.push(`
.ace_cursor {
  border-left: 1px solid ${cursorColor};
}
`);

    const foregroundColor = syntaxTheme.foreground != null ? syntaxTheme.foreground : "#b2b2b2";
    const backgroundColor = syntaxTheme.background != null ? syntaxTheme.background : "#000000";
    lines.push(`
.ace_editor {
  color: ${foregroundColor};
  background-color: ${backgroundColor};
}
`);

    const invisiblesColor = syntaxTheme.invisibles != null ? syntaxTheme.invisibles : "rgb(191, 191, 191)";
    lines.push(`
.ace_invisible {
  color: ${invisiblesColor};
}
`);

    const lineHighlightColor = syntaxTheme.lineHighlight != null ? syntaxTheme.lineHighlight : "#202020";
    lines.push(`
.ace_marker-layer .ace_active-line {
  background-color: ${lineHighlightColor};
}

.ace_gutter-active-line {
  background-color: ${lineHighlightColor};
}
`);    

    const selectionColor = syntaxTheme.selection != null ? syntaxTheme.selection : "#005CCC";
    lines.push(`
.ace_selection {
  background-color: ${selectionColor};
}

.ace_marker-layer .ace_selection {
  background-color: ${selectionColor};
}
`);

    lines.push(`
.ace_gutter {
  background: ${backgroundColor};
  border-right: 1px solid ${foregroundColor};
}`
);

    for (const rule of syntaxTheme.syntaxTokenRule) {
      const cssSelector = ".ace_" + rule.scope.split(".").join(".ace_");
      lines.push(cssSelector + " {");

      if (rule.textStyle.foregroundColor != null) {
        lines.push(`  color: ${rule.textStyle.foregroundColor};`);
      }
      if (rule.textStyle.backgroundColor != null) {
        lines.push(`  background-color: ${rule.textStyle.backgroundColor};`);
      }
      if (rule.textStyle.bold) {
        lines.push("  font-height: bold;");
      }
      if (rule.textStyle.italic) {
        lines.push("  font-style: italic;");
      }
      if (rule.textStyle.underline) {
        lines.push("  text-decoration: underline;");
      }
      lines.push("}");
    }

    return lines.join("\n");
  }
}
