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
  GUI_CONTROLS,
  TOP_WINDOW,
  MAIN_UI,
  TERMINAL,
  IMAGE_VIEWER,
  TERMINAL_VIEWER,
  TEXT_VIEWER,
  EMBEDDED_FRAME,
  ABOUT_TAB,
  SETTINGS_TAB,
  GUI_MENUITEM,
  GUI_CONTEXTMENU,
  GUI_TABWIDGET,
  GUI_STACKEDWIDGET,
  GUI_SCROLLBAR
}

export const cssFileEnumItems: CssFile[] = [
  CssFile.GUI_CONTROLS,
  CssFile.TOP_WINDOW,
  CssFile.MAIN_UI,
  CssFile.TERMINAL,
  CssFile.IMAGE_VIEWER,
  CssFile.TERMINAL_VIEWER,
  CssFile.TEXT_VIEWER,
  CssFile.EMBEDDED_FRAME,
  CssFile.ABOUT_TAB,
  CssFile.SETTINGS_TAB,
  CssFile.GUI_MENUITEM,
  CssFile.GUI_CONTEXTMENU,
  CssFile.GUI_TABWIDGET,
  CssFile.GUI_STACKEDWIDGET,
  CssFile.GUI_SCROLLBAR
];

const _CssFileNameMapping = {
  [CssFile.GUI_CONTROLS]: "gui-controls",
  [CssFile.TOP_WINDOW]: "top-window",
  [CssFile.MAIN_UI]: "main-ui",
  [CssFile.TERMINAL]: "terminal",
  [CssFile.IMAGE_VIEWER]: "image-viewer",
  [CssFile.TERMINAL_VIEWER]: "terminal-viewer",
  [CssFile.TEXT_VIEWER]: "text-viewer",
  [CssFile.EMBEDDED_FRAME]: "embedded-frame",
  [CssFile.ABOUT_TAB]: "about-tab",
  [CssFile.SETTINGS_TAB]: "settings-tab",
  [CssFile.GUI_MENUITEM]: "gui-menuitem",
  [CssFile.GUI_CONTEXTMENU]: "gui-contextmenu",
  [CssFile.GUI_TABWIDGET]: "gui-tabwidget",
  [CssFile.GUI_STACKEDWIDGET]: "gui-stackedwidget",
  [CssFile.GUI_SCROLLBAR]: "gui-scrollbar"
};

export function cssFileNameBase(cssFile: CssFile): string {
  return _CssFileNameMapping[cssFile] || null;
}

export interface Themeable {
  setThemeCssMap(cssMap: Map<CssFile, string>): void;
}
