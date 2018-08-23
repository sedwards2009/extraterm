/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as path from "path";
import * as plist from "plist";

import { ExtensionContext, Logger, SyntaxThemeProvider, SyntaxThemeInfo, SyntaxTheme, TextStyle, SyntaxTokenRule } from 'extraterm-extension-api';
import { log } from "extraterm-logging";

interface TmThemeBlockSettings {
  foreground?: string;
  background?: string;
  fontStyle?: string;
};

interface TmThemeBlock {
  scope: string;
  settings: TmThemeBlockSettings;
};


export class TextMateSyntaxThemeProvider implements SyntaxThemeProvider {

  constructor(private _log: Logger) {
  }

  scanThemes(paths: string[]): SyntaxThemeInfo[] {
  
    let results: SyntaxThemeInfo[] = [];
    for (const themePath of paths) {
      results = [...results, ...this._scanDirectory(themePath)];
    }

    return results;
  }

  private _scanDirectory(themePath: string): SyntaxThemeInfo[] {
    const results: SyntaxThemeInfo[] = [];
    for (const item of fs.readdirSync(themePath)) {
      if (item.endsWith(".tmTheme")) {
        results.push({
          id: item,
          name: item.slice(0, -".tmTheme".length),
          comment: ""
        });
      }
    }
    return results;
  }

  readTheme(paths: string[], id: string): SyntaxTheme {
    for (const themePath of paths) {
      const fullPath = path.join(themePath, id);
      if (fs.existsSync(fullPath)) {
        return this._readThemeFile(fullPath);
      }
    }
    return null;
  }

  private _readThemeFile(fullPath: string): SyntaxTheme {
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const tmThemeContents = plist.parse(fileContents);

    this._log.debug("plist value: ", JSON.stringify(tmThemeContents, null, "  "));
    
    const foreground = this._readTextStyleValue(tmThemeContents, "settings.0.settings.foreground", "");
    const background = this._readTextStyleValue(tmThemeContents, "settings.0.settings.background", "");
    const cursor = this._readTextStyleValue(tmThemeContents, "settings.0.settings.caret", "");
    const invisibles = this._readTextStyleValue(tmThemeContents, "settings.0.settings.invisibles", "");
    const lineHighlight = this._readTextStyleValue(tmThemeContents, "settings.0.settings.lineHighlight", "");
    const selection = this._readTextStyleValue(tmThemeContents, "settings.0.settings.selection", "");

    return {
      foreground,
      invisibles,
      background,
      cursor,
      lineHighlight,
      selection,

      syntaxTokenRule: this._readTokenRules(tmThemeContents)
    };
  }

  private _readTextStyleValue(data: any, key: string, defaultColor: string): string {
    const parts = key.split(".");
    let currentData = data;
    for (const part of parts) {
      if (currentData[part] == null) {
        return defaultColor;
      }
      currentData = currentData[part];
    }

    return currentData;
  }

  private _readTokenRules(tmThemeContents: any): SyntaxTokenRule[] {
    if (tmThemeContents.settings == null) {
      return [];
    }

    let rules: SyntaxTokenRule[] = [];
    for (const block of tmThemeContents.settings) {
      if (block.scope != null) {
        rules = [...rules, ...this._readTokenRuleBlock(block)];
      }
    }
    return rules;
  }

  private _readTokenRuleBlock(block: TmThemeBlock): SyntaxTokenRule[] {
    const results: SyntaxTokenRule[] = [];
    const scopesList = block.scope.split(/,| /g);
    for (const scope of scopesList) {
      if (scope.trim() === "") {
        continue;
      }

      results.push({
        scope,
        textStyle: this._readTokenRuleBlockSettings(block.settings)
      });
    }
    return results;
  }

  private _readTokenRuleBlockSettings(settings: TmThemeBlockSettings): TextStyle {
    const fontStyle = settings.fontStyle;
    let bold = false;
    let italic = false;
    let underline = false;
  
    if (fontStyle != null) {
      const styles = fontStyle.split(" ");
      bold = styles.indexOf("bold") !== -1;
      italic = styles.indexOf("italic") !== -1;
      underline = styles.indexOf("underline") !== -1;
    }

    return {
      foregroundColor: settings.foreground || null,
      backgroundColor: settings.background || null,
      bold,
      italic,
      underline
    };
  }
}

export function activate(context: ExtensionContext): any {
  context.logger.debug("TextMateSyntaxThemeProvider activating");
  context.backend.registerSyntaxThemeProvider("TextMate", new TextMateSyntaxThemeProvider(context.logger));
}
