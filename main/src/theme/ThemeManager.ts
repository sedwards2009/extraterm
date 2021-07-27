/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';

import {Logger, log, getLogger} from "extraterm-logging";
import { ThemeInfo } from './Theme';
import { ExtensionManager } from '../extension/ExtensionManager';
import { TerminalTheme } from '@extraterm/extraterm-extension-api';


const DEBUG_SCAN = false;

export interface Color {
  hex?: string;
  variableRGB?: number | string;
}

export interface ThemeTypePaths {
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

export class ThemeManager {

  private _log: Logger = null;
  #themes: Map<string, ThemeInfo> = null;
  #paths: ThemeTypePaths = null;
  #extensionManager: ExtensionManager = null;

  constructor(paths: ThemeTypePaths, mainExtensionManager: ExtensionManager) {
    this._log = getLogger("ThemeManagerImpl", this);
    this.#paths = paths;
    this.#extensionManager = mainExtensionManager;
    this._updateThemesList();
  }

  rescan(): void {
    this._updateThemesList();
  }

  private _updateThemesList(): void {
    this.#themes = this._scanThemePaths(this.#paths, this._getTerminalThemeExtensionPaths());
  }

  private _getTerminalThemeExtensionPaths(): string [] {
    const paths: string[] = [];
    for (const extension of this.#extensionManager.getExtensionMetadata()) {
      for (const st of extension.contributes.terminalThemes) {
        paths.push(path.join(extension.path, st.path));
      }
    }
    return paths;
  }

  private _scanThemePaths(paths: ThemeTypePaths, terminalThemePaths: string[]): Map<string, ThemeInfo> {
    let themesList: ThemeInfo[] = [];

    themesList = [...themesList,
      ...this._scanThemesWithTerminalThemeProviders([...paths.terminal, ...terminalThemePaths]),
    ];

    const allThemes = new Map<string, ThemeInfo>();
    themesList.forEach( themeInfo => {
      allThemes.set(themeInfo.id, themeInfo);
    });

    return allThemes;
  }

  private _scanThemesWithTerminalThemeProviders(paths: string[]): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    for (const provider of this.#extensionManager.getTerminalThemeProviderContributions()) {
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
    return this.#themes.get(themeId) || null;
  }

  getAllThemes(): ThemeInfo[] {
    const result: ThemeInfo[] = [];
    this.#themes.forEach( themeInfo => {
      result.push(themeInfo);
    });
    return result;
  }

  private _getTerminalThemeContentsFromInfo(terminalThemeInfo: ThemeInfo): TerminalTheme {
    const paths = [...this.#paths.terminal, ...this._getTerminalThemeExtensionPaths()];
    for (const provider of this.#extensionManager.getTerminalThemeProviderContributions()) {
      if (provider.metadata.name === terminalThemeInfo.provider) {
        const parts = terminalThemeInfo.id.split(":");
        if (parts.length === 2) {
          return provider.terminalThemeProvider.readTheme(paths, parts[1]);
        }
      }
    }

    return null;
  }

  getTerminalTheme(id: string): TerminalTheme {
    const terminalThemeInfo = this.#themes.get(id);
    if (terminalThemeInfo == null) {
      return null;
    }
    const contents = this._getTerminalThemeContentsFromInfo(terminalThemeInfo);
    const completeTheme = this._mergeTerminalThemeDefaults(contents, DEFAULT_TERMINAL_THEME);
    return completeTheme;
  }

  private _mergeTerminalThemeDefaults(terminalTheme: TerminalTheme, defaultTerminalTheme: TerminalTheme): TerminalTheme {
    const keys = ["foregroundColor",
      "backgroundColor",
      "cursorForegroundColor",
      "cursorBackgroundColor",
      "selectionBackgroundColor",
      "findHighlightBackgroundColor"];
    for (let i=0; i<256; i++) {
      keys.push("" + i);
    }

    const result: TerminalTheme = {};
    for (const key of keys) {
      result[key] = terminalTheme[key] != null ? terminalTheme[key] : defaultTerminalTheme[key];
    }

    return result;
  }
}
