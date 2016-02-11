/**
 * Copyright 2014 Simon Edwards <simon@simonzone.com>
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
  EMBEDDED_FRAME
}

export const cssFileEnumItems: CssFile[] = [
  CssFile.TOP_VIEW,
  CssFile.TERMINAL_VIEWER,
  CssFile.EMBEDDED_FRAME
];

const _CssFileNameMapping = {
  [CssFile.TOP_VIEW]: "top-window",
  [CssFile.TERMINAL_VIEWER]: "terminal-viewer",
  [CssFile.EMBEDDED_FRAME]: "embedded-frame"
};

export function cssFileNameBase(cssFile: CssFile): string {
  return _CssFileNameMapping[cssFile] || null;
}

export interface Themeable {
  getCssFile(): CssFile;
  setThemeCss(cssText: string): void;
}
