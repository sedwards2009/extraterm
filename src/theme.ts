/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ThemeInfo {
  name: string;
  id: string;
  path: string;
  debug: boolean;
}

export interface ThemeContents {
  cssFiles: { [index: string]: string; };
}

export enum CssFile {
  TOP_VIEW,
  TERMINAL_VIEWER,
  EMBEDDED_FRAME,
  SETTINGS_TAB
}

export const cssFileEnumItems: CssFile[] = [
  CssFile.TOP_VIEW,
  CssFile.TERMINAL_VIEWER,
  CssFile.EMBEDDED_FRAME,
  CssFile.SETTINGS_TAB
];

const _CssFileNameMapping = {
  [CssFile.TOP_VIEW]: "top-window",
  [CssFile.TERMINAL_VIEWER]: "terminal-viewer",
  [CssFile.EMBEDDED_FRAME]: "embedded-frame",
  [CssFile.SETTINGS_TAB]: "settings-tab"
};

export function cssFileNameBase(cssFile: CssFile): string {
  return _CssFileNameMapping[cssFile] || null;
}

export interface Themeable {
  getCssFile(): CssFile;
  setThemeCss(cssText: string): void;
}
