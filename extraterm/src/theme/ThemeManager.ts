/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

import * as SourceDir from '../SourceDir';

const PATCH_MODULE_VERSION = "69";  // This version number also appears in build_package.js
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
  cssFileToFilename, cssFileToExtension, SYNTAX_CSS_THEME, TERMINAL_CSS_THEME} from './Theme';
import { AcceptsConfigDatabase, ConfigDatabase, GENERAL_CONFIG, GeneralConfig } from '../Config';
import { MainExtensionManager } from '../main_process/extension/MainExtensionManager';
import { ExtensionCss, ExtensionMetadata } from '../ExtensionMetadata';
import { SyntaxTheme, TerminalTheme } from 'extraterm-extension-api';

const THEME_CONFIG = "theme.json";

const DEBUG_SASS = false;
const DEBUG_SASS_FINE = false;
const DEBUG_SCAN = false;

export interface Color {
  hex: string;
}

export type GlobalVariableMap = Map<string, number|boolean|string|Color>;

export interface RenderResult {
  success: boolean;
  themeContents: ThemeContents;
  errorMessage: string;
}

interface CssDirectory {
  id: string;
  path: string;
}

export interface ThemeTypePaths {
  css: string[];
  syntax: string[];
  terminal: string[];
};


const DEFAULT_TERMINAL_THEME: TerminalTheme = {
  foregroundColor: "#b2b2b2",
  backgroundColor: "#000000",
  cursorForegroundColor: "#000000",
  cursorBackgroundColor: "#ffb300",
  selectionBackgroundColor: "#005CCC",

  /* Linux colours */
  "0": "#000000",
  "1": "#b21818",
  "2": "#18b218",
  "3": "#b26818",
  "4": "#3535ff",
  "5": "#b218b2",
  "6": "#18b2b2",
  "7": "#b2b2b2",

  /* Full bright versions */
  "8": "#686868",
  "9": "#ff5454",
  "10": "#54ff54",
  "11": "#ffff54",
  "12": "#7373ff",
  "13": "#ff54ff",
  "14": "#54ffff",
  "15": "#ffffff",

  /* 16-255 standard colours */
  "16": "#000000",
  "17": "#00005f",
  "18": "#000087",
  "19": "#0000af",
  "20": "#0000d7",
  "21": "#0000ff",
  "22": "#005f00",
  "23": "#005f5f",
  "24": "#005f87",
  "25": "#005faf",
  "26": "#005fd7",
  "27": "#005fff",
  "28": "#008700",
  "29": "#00875f",
  "30": "#008787",
  "31": "#0087af",
  "32": "#0087d7",
  "33": "#0087ff",
  "34": "#00af00",
  "35": "#00af5f",
  "36": "#00af87",
  "37": "#00afaf",
  "38": "#00afd7",
  "39": "#00afff",
  "40": "#00d700",
  "41": "#00d75f",
  "42": "#00d787",
  "43": "#00d7af",
  "44": "#00d7d7",
  "45": "#00d7ff",
  "46": "#00ff00",
  "47": "#00ff5f",
  "48": "#00ff87",
  "49": "#00ffaf",
  "50": "#00ffd7",
  "51": "#00ffff",
  "52": "#5f0000",
  "53": "#5f005f",
  "54": "#5f0087",
  "55": "#5f00af",
  "56": "#5f00d7",
  "57": "#5f00ff",
  "58": "#5f5f00",
  "59": "#5f5f5f",
  "60": "#5f5f87",
  "61": "#5f5faf",
  "62": "#5f5fd7",
  "63": "#5f5fff",
  "64": "#5f8700",
  "65": "#5f875f",
  "66": "#5f8787",
  "67": "#5f87af",
  "68": "#5f87d7",
  "69": "#5f87ff",
  "70": "#5faf00",
  "71": "#5faf5f",
  "72": "#5faf87",
  "73": "#5fafaf",
  "74": "#5fafd7",
  "75": "#5fafff",
  "76": "#5fd700",
  "77": "#5fd75f",
  "78": "#5fd787",
  "79": "#5fd7af",
  "80": "#5fd7d7",
  "81": "#5fd7ff",
  "82": "#5fff00",
  "83": "#5fff5f",
  "84": "#5fff87",
  "85": "#5fffaf",
  "86": "#5fffd7",
  "87": "#5fffff",
  "88": "#870000",
  "89": "#87005f",
  "90": "#870087",
  "91": "#8700af",
  "92": "#8700d7",
  "93": "#8700ff",
  "94": "#875f00",
  "95": "#875f5f",
  "96": "#875f87",
  "97": "#875faf",
  "98": "#875fd7",
  "99": "#875fff",
  "100": "#878700",
  "101": "#87875f",
  "102": "#878787",
  "103": "#8787af",
  "104": "#8787d7",
  "105": "#8787ff",
  "106": "#87af00",
  "107": "#87af5f",
  "108": "#87af87",
  "109": "#87afaf",
  "110": "#87afd7",
  "111": "#87afff",
  "112": "#87d700",
  "113": "#87d75f",
  "114": "#87d787",
  "115": "#87d7af",
  "116": "#87d7d7",
  "117": "#87d7ff",
  "118": "#87ff00",
  "119": "#87ff5f",
  "120": "#87ff87",
  "121": "#87ffaf",
  "122": "#87ffd7",
  "123": "#87ffff",
  "124": "#af0000",
  "125": "#af005f",
  "126": "#af0087",
  "127": "#af00af",
  "128": "#af00d7",
  "129": "#af00ff",
  "130": "#af5f00",
  "131": "#af5f5f",
  "132": "#af5f87",
  "133": "#af5faf",
  "134": "#af5fd7",
  "135": "#af5fff",
  "136": "#af8700",
  "137": "#af875f",
  "138": "#af8787",
  "139": "#af87af",
  "140": "#af87d7",
  "141": "#af87ff",
  "142": "#afaf00",
  "143": "#afaf5f",
  "144": "#afaf87",
  "145": "#afafaf",
  "146": "#afafd7",
  "147": "#afafff",
  "148": "#afd700",
  "149": "#afd75f",
  "150": "#afd787",
  "151": "#afd7af",
  "152": "#afd7d7",
  "153": "#afd7ff",
  "154": "#afff00",
  "155": "#afff5f",
  "156": "#afff87",
  "157": "#afffaf",
  "158": "#afffd7",
  "159": "#afffff",
  "160": "#d70000",
  "161": "#d7005f",
  "162": "#d70087",
  "163": "#d700af",
  "164": "#d700d7",
  "165": "#d700ff",
  "166": "#d75f00",
  "167": "#d75f5f",
  "168": "#d75f87",
  "169": "#d75faf",
  "170": "#d75fd7",
  "171": "#d75fff",
  "172": "#d78700",
  "173": "#d7875f",
  "174": "#d78787",
  "175": "#d787af",
  "176": "#d787d7",
  "177": "#d787ff",
  "178": "#d7af00",
  "179": "#d7af5f",
  "180": "#d7af87",
  "181": "#d7afaf",
  "182": "#d7afd7",
  "183": "#d7afff",
  "184": "#d7d700",
  "185": "#d7d75f",
  "186": "#d7d787",
  "187": "#d7d7af",
  "188": "#d7d7d7",
  "189": "#d7d7ff",
  "190": "#d7ff00",
  "191": "#d7ff5f",
  "192": "#d7ff87",
  "193": "#d7ffaf",
  "194": "#d7ffd7",
  "195": "#d7ffff",
  "196": "#ff0000",
  "197": "#ff005f",
  "198": "#ff0087",
  "199": "#ff00af",
  "200": "#ff00d7",
  "201": "#ff00ff",
  "202": "#ff5f00",
  "203": "#ff5f5f",
  "204": "#ff5f87",
  "205": "#ff5faf",
  "206": "#ff5fd7",
  "207": "#ff5fff",
  "208": "#ff8700",
  "209": "#ff875f",
  "210": "#ff8787",
  "211": "#ff87af",
  "212": "#ff87d7",
  "213": "#ff87ff",
  "214": "#ffaf00",
  "215": "#ffaf5f",
  "216": "#ffaf87",
  "217": "#ffafaf",
  "218": "#ffafd7",
  "219": "#ffafff",
  "220": "#ffd700",
  "221": "#ffd75f",
  "222": "#ffd787",
  "223": "#ffd7af",
  "224": "#ffd7d7",
  "225": "#ffd7ff",
  "226": "#ffff00",
  "227": "#ffff5f",
  "228": "#ffff87",
  "229": "#ffffaf",
  "230": "#ffffd7",
  "231": "#ffffff",
  "232": "#080808",
  "233": "#121212",
  "234": "#1c1c1c",
  "235": "#262626",
  "236": "#303030",
  "237": "#3a3a3a",
  "238": "#444444",
  "239": "#4e4e4e",
  "240": "#585858",
  "241": "#626262",
  "242": "#6c6c6c",
  "243": "#767676",
  "244": "#808080",
  "245": "#8a8a8a",
  "246": "#949494",
  "247": "#9e9e9e",
  "248": "#a8a8a8",
  "249": "#b2b2b2",
  "250": "#bcbcbc",
  "251": "#c6c6c6",
  "252": "#d0d0d0",
  "253": "#dadada",
  "254": "#e4e4e4",
  "255": "#eeeeee",

};

export class ThemeManager implements AcceptsConfigDatabase {
  
  private _log: Logger = null;
  private _configDatabase: ConfigDatabase = null;
  private _themes: Map<string, ThemeInfo> = null;

  constructor(private _paths: ThemeTypePaths, private _mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("ThemeManagerImpl", this);
    this._updateThemesList();
  }

  rescan(): void {
    this._updateThemesList();
  }

  private _updateThemesList(): void {
    this._themes = this._scanThemePaths(this._paths, this._getSyntaxThemeExtensionPaths(),
      this._getTerminalThemeExtensionPaths());
  }

  private _getSyntaxThemeExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getExtensionMetadata()) {
      for (const st of extension.contributes.syntaxThemes) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _getTerminalThemeExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this._mainExtensionManager.getExtensionMetadata()) {
      for (const st of extension.contributes.terminalThemes) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanThemePaths(paths: ThemeTypePaths, syntaxThemePaths: string[], terminalThemePaths: string[]): Map<string, ThemeInfo> {
    let themesList: ThemeInfo[] = [];
    for (const themePath of paths.css) {
      themesList = [...themesList, ...this._scanThemePath(themePath)];
    }

    themesList = [...themesList,
      ...this._scanThemesWithSyntaxThemeProviders([...paths.syntax, ...syntaxThemePaths]),
      ...this._scanThemesWithTerminalThemeProviders([...paths.terminal, ...terminalThemePaths]),
    ];

    const allThemes = new Map<string, ThemeInfo>();
    themesList.forEach( themeInfo => {
      allThemes.set(themeInfo.id, themeInfo);
    });

    return allThemes;
  }

  setConfigDatabase(configDistributor: ConfigDatabase): void {
    this._configDatabase = configDistributor;
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
          this._log.debug(`themeInfo<id=${themeInfo.id}, type=${themeInfo.type}>`);
        }

      result.push(themeInfo);
      }
    }
    return result;
  }

  private _scanThemesWithTerminalThemeProviders(paths: string[]): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    for (const provider of this._mainExtensionManager.getTerminalThemeProviderContributions()) {
      for (const theme of provider.terminalThemeProvider.scanThemes(paths)) {
        const themeId = provider.metadata.name + ":" + theme.id;
        const themeInfo: ThemeInfo = {
          id: themeId,
          type: 'terminal',
          debug: false,
          name: theme.name,
          comment: theme.comment,
          path: null,
          provider: provider.metadata.name,
          loadingBackgroundColor: null,
          loadingForegroundColor: null
        };

        if (DEBUG_SCAN) {
          this._log.debug(`themeInfo<id=${themeInfo.id}, type=${themeInfo.type}>`);
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
    const config = <GeneralConfig> this._configDatabase.getConfig(GENERAL_CONFIG);
    switch (themeType) {
      case "gui":
        return await this.renderGui(config.themeGUI, config.themeTerminal, globalVariables);
      case "terminal":
        return await this._renderTerminal(config.themeTerminal, globalVariables);
      case "syntax":
        return await this._renderSyntax(globalVariables);
    }
    return null;
  }

  async renderGui(themeGUI: string, themeTerminal: string=null, globalVariables: GlobalVariableMap=null): Promise<RenderResult> {
    let terminalGlobalVariables: GlobalVariableMap = null;
    if (themeTerminal != null) {    
      const terminalThemeInfo = this._themes.get(themeTerminal);
      terminalGlobalVariables = this._getTerminalThemeVariablesFromInfo(terminalThemeInfo);
    } else {
      terminalGlobalVariables = this._convertTerminalThemeToVariables(DEFAULT_TERMINAL_THEME);
    }

    const completeGlobalVariables = new Map([
      ...terminalGlobalVariables,
      ...(globalVariables == null ? new Map() : globalVariables)
    ]);

    let themeNameStack = [themeGUI, FALLBACK_UI_THEME];
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_GUI);

    // Add extra CSS files needed by extensions.
    let result = await this._renderThemes(themeNameStack, neededCssFiles, completeGlobalVariables);
    if ( ! result.success) {
      themeNameStack = [FALLBACK_UI_THEME];
      const fallbackResult = await this._renderThemes(themeNameStack, neededCssFiles, completeGlobalVariables);
      fallbackResult.errorMessage = result.errorMessage;
      result = fallbackResult;
    }

    // Now render the CSS files for the extensions.
    const extensionResult = await this._renderAllExtensionCss(themeNameStack, completeGlobalVariables);
    if ( ! extensionResult.success) {
      result.success = false;
    }
    result.themeContents.cssFiles = [...result.themeContents.cssFiles, ...extensionResult.themeContents.cssFiles];
    result.errorMessage += extensionResult.errorMessage + "\n";
    return result;
  }

  private async _renderTerminal(themeTerminal: string, globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_TERMINAL);
    try {
      const terminalThemeInfo = this._themes.get(themeTerminal);
      const completeGlobalVariables = new Map([...this._getTerminalThemeVariablesFromInfo(terminalThemeInfo),
                                        ...(globalVariables == null ? new Map() : globalVariables)]);
      const result = await this._renderThemes([TERMINAL_CSS_THEME], neededCssFiles, completeGlobalVariables);
      return result;
    } catch(ex) {
      this._log.warn(ex);
      return null;
    }
  }

  private _getTerminalThemeVariablesFromInfo(terminalThemeInfo: ThemeInfo): GlobalVariableMap {
    const contents = this._getTerminalThemeContentsFromInfo(terminalThemeInfo);
    const completeTheme = this._mergeTerminalThemeDefaults(contents, DEFAULT_TERMINAL_THEME);
    return this._convertTerminalThemeToVariables(completeTheme);
  }

  private _getTerminalThemeContentsFromInfo(terminalThemeInfo: ThemeInfo): TerminalTheme {
    const paths = [...this._paths.terminal, ...this._getTerminalThemeExtensionPaths()];
    for (const provider of this._mainExtensionManager.getTerminalThemeProviderContributions()) {
      if (provider.metadata.name === terminalThemeInfo.provider) {
        const parts = terminalThemeInfo.id.split(":");
        if (parts.length === 2) {
          return provider.terminalThemeProvider.readTheme(paths, parts[1]);
        }
      }
    }

    return null;
  }

  private _mergeTerminalThemeDefaults(terminalTheme: TerminalTheme, defaultTerminalTheme: TerminalTheme): TerminalTheme {

    const keys = ["foregroundColor",
      "backgroundColor",
      "cursorForegroundColor",
      "cursorBackgroundColor",
      "selectionBackgroundColor"];
    for (let i=0; i<256; i++) {
      keys.push("" + i);
    }

    const result: TerminalTheme = {};
    for (const key of keys) {
      result[key] = terminalTheme[key] != null ? terminalTheme[key] : defaultTerminalTheme[key];
    }
  
    return result;
  }

  private _convertTerminalThemeToVariables(terminalTheme: TerminalTheme): GlobalVariableMap {
    const result: GlobalVariableMap = new Map();

    result.set("terminal-foreground-color", {hex: terminalTheme.foregroundColor});
    result.set("terminal-background-color", {hex: terminalTheme.backgroundColor});
    result.set("terminal-cursor-foreground-color", {hex: terminalTheme.cursorForegroundColor});
    result.set("terminal-cursor-background-color", {hex: terminalTheme.cursorBackgroundColor});
    result.set("terminal-selection-background-color", {hex: terminalTheme.selectionBackgroundColor});
  
    for (let i = 0; i < 256; i++) {
      result.set("terminal-color-" + i, {hex: terminalTheme[i]});
    }
    return result;
  }

  async _renderSyntax(globalVariables?: GlobalVariableMap): Promise<RenderResult> {
    const config = <GeneralConfig> this._configDatabase.getConfig(GENERAL_CONFIG);

    const syntaxThemeInfo = this._themes.get(config.themeSyntax);
    const neededCssFiles = cssFileEnumItems.filter(cssFile => cssFileToExtension(cssFile) === CSS_MODULE_INTERNAL_SYNTAX);
    try {
      // Add extra CSS files needed by extensions.
      const result = await this._renderThemes([SYNTAX_CSS_THEME], neededCssFiles, globalVariables);
      const syntaxCss = this._formatSyntaxTheme(syntaxThemeInfo);
      result.themeContents.cssFiles[0].contents = result.themeContents.cssFiles[0].contents + syntaxCss;
      return result;
    } catch(ex) {
      this._log.warn(ex);
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
    const variables = new Map<string, number|boolean|string|Color>(globalVariables);
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
          let formattedValue = "";
          if (typeof(value) === "string") {
            formattedValue = `"${value}"`;
          } else if (typeof(value) === "object" && value.hex != null) {
            formattedValue = value.hex;
          } else {
            formattedValue = "" + value;
          }
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
      for (const viewerMetadata of extensionMetadata.contributes.viewers) {
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

    const variables = new Map<string, number|boolean|string|Color>(globalVariables);
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
    const paths = [...this._paths.syntax, ...this._getSyntaxThemeExtensionPaths()];
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
