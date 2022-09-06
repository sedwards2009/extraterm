/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import plist from "plist";

import { ExtensionContext, Logger, TerminalThemeProvider, TerminalThemeInfo, TerminalTheme } from '@extraterm/extraterm-extension-api';


export class ItermColorTerminalThemeProvider implements TerminalThemeProvider {

  constructor(private _log: Logger) {
  }

  scanThemes(paths: string[]): TerminalThemeInfo[] {
    let results: TerminalThemeInfo[] = [];
    for (const themePath of paths) {
      results = [...results, ...this._scanDirectory(themePath)];
    }

    return results;
  }

  private _scanDirectory(themePath: string): TerminalThemeInfo[] {
    const results: TerminalThemeInfo[] = [];
    for (const item of fs.readdirSync(themePath)) {
      if (item.endsWith(".itermcolors")) {
        results.push({
          id: item,
          name: item.slice(0, -".itermcolors".length),
          comment: ""
        });
      }
    }
    return results;
  }

  readTheme(paths: string[], id: string): TerminalTheme {
    for (const themePath of paths) {
      const fullPath = path.join(themePath, id);
      if (fs.existsSync(fullPath)) {
        return this._readThemeFile(fullPath);
      }
    }
    return null;
  }

  private _readThemeFile(fullPath: string): TerminalTheme {
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const themeContents = plist.parse(fileContents);
    const theme: TerminalTheme = {};

    for (const pair of [
        ["foregroundColor", "Foreground Color"],
        ["backgroundColor", "Background Color"],
        ["cursorForegroundColor", "Cursor Text Color"],
        ["cursorBackgroundColor", "Cursor Color"],
        ["selectionBackgroundColor", "Selection Color"]]) {

      const extratermKey = pair[0];
      const themeKey = pair[1];
      const colorObject = themeContents[themeKey];
      if (colorObject != null) {
        theme[extratermKey] = this._readColorValue(colorObject);
      }
    }

    for (let i=0; i<256; i++) {
      const colorObject = themeContents[`Ansi ${i} Color`];
      if (colorObject != null) {
        theme[i] = this._readColorValue(colorObject);
      }
    }
    return theme;
  }

  private _readColorValue(colorObject: {[index: string]: number}): string {
    return "#" + to2DigitHex(Math.round(colorObject["Red Component"] * 0xff)) +
      to2DigitHex(Math.round(colorObject["Green Component"] * 0xff)) +
      to2DigitHex(Math.round(colorObject["Blue Component"] * 0xff));
  }
}

function to2DigitHex(value: number): string {
  const h = value.toString(16);
  return h.length === 1 ? "0" + h : h;
}


export function activate(context: ExtensionContext): any {
  context.logger.debug("ITermColorTerminalThemeProvider activating");
  context.windows.registerTerminalThemeProvider("iTermColors", new ItermColorTerminalThemeProvider(context.logger));
}
