/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type ThemeType = 'terminal' | 'syntax' | 'gui';

export interface ThemeInfo {
  name: string;
  id: string;
  type: ThemeType[];  // Defines the type of theme this is. FIXME make this singular.
  path: string;
  debug: boolean;
  comment: string;
}

export interface ThemeContents {
  cssFiles: { cssFileName: CssFile, contents: string; }[];
}

export const CSS_MODULE_INTERNAL_GUI = "<gui>";
export const CSS_MODULE_INTERNAL_SYNTAX = "<syntax>";
export const CSS_MODULE_INTERNAL_TERMINAL = "<terminal>";


export type CssFile = string;
export const CssFile = {
  GUI_CONTROLS: CSS_MODULE_INTERNAL_GUI + ":" + "gui-controls",
  TOP_WINDOW: CSS_MODULE_INTERNAL_GUI + ":" + "top-window",
  MAIN_UI: CSS_MODULE_INTERNAL_GUI + ":" + "main-ui",
  TERMINAL: CSS_MODULE_INTERNAL_GUI + ":" + "terminal",
  IMAGE_VIEWER: CSS_MODULE_INTERNAL_GUI + ":" + "image-viewer",
  TERMINAL_VIEWER: CSS_MODULE_INTERNAL_TERMINAL + ":" + "terminal-viewer",
  TEXT_VIEWER: CSS_MODULE_INTERNAL_SYNTAX + ":" + "text-viewer",
  EMBEDDED_FRAME: CSS_MODULE_INTERNAL_GUI + ":" + "embedded-frame",
  ABOUT_TAB: CSS_MODULE_INTERNAL_GUI + ":" + "about-tab",
  SETTINGS_TAB: CSS_MODULE_INTERNAL_GUI + ":" + "settings-tab",
  GUI_MENUITEM: CSS_MODULE_INTERNAL_GUI + ":" + "gui-menuitem",
  GUI_CONTEXTMENU: CSS_MODULE_INTERNAL_GUI + ":" + "gui-contextmenu",
  GUI_TABWIDGET: CSS_MODULE_INTERNAL_GUI + ":" + "gui-tabwidget",
  GUI_STACKEDWIDGET: CSS_MODULE_INTERNAL_GUI + ":" + "gui-stackedwidget",
  GUI_SCROLLBAR: CSS_MODULE_INTERNAL_GUI + ":" + "gui-scrollbar",
  KEY_BINDINGS_TAB: CSS_MODULE_INTERNAL_GUI + ":" + "key-bindings-tab",
  GUI_COMMANDPALETTE: CSS_MODULE_INTERNAL_GUI + ":" + "gui-commandpalette",
  GUI_POP_DOWN_DIALOG: CSS_MODULE_INTERNAL_GUI + ":" + "gui-popdowndialog",
  GUI_POP_DOWN_LIST_PICKER: CSS_MODULE_INTERNAL_GUI + ":" + "gui-popdownlistpicker",
  GUI_LIST_PICKER: CSS_MODULE_INTERNAL_GUI + ":" + "gui-listpicker",
  TIP_VIEWER: CSS_MODULE_INTERNAL_GUI + ":" + "tip-viewer",
  FONT_AWESOME: CSS_MODULE_INTERNAL_GUI + ":" + "font-awesome",
  TERMINAL_VARS: CSS_MODULE_INTERNAL_TERMINAL + ":" + "terminal-vars",
  VIEWER_TAB: CSS_MODULE_INTERNAL_GUI + ":" + "viewer-tab",
  GUI_SPLITTER: CSS_MODULE_INTERNAL_GUI + ":" + "gui-splitter",
  EMPTY_PANE_MENU: CSS_MODULE_INTERNAL_GUI + ":" + "empty-pane-menu",
  GUI_SNAP_DROP_CONTAINER: CSS_MODULE_INTERNAL_GUI + ":" + "gui-snap-drop-container",
  THEME_VARS: CSS_MODULE_INTERNAL_GUI + ":" + "theme-vars",
  GUI_FILE_TRANSFER_PROGRESS: CSS_MODULE_INTERNAL_GUI + ":" + "gui-file-transfer-progress",
  GUI_UPLOAD_PROGRESS_BAR: CSS_MODULE_INTERNAL_GUI + ":" + "gui-upload-progress",
}

export function cssFileToFilename(cssFile: CssFile): string {
  const parts = cssFile.split(":");
  return parts[1];
}

export function cssFileToExtension(cssFile: CssFile): string {
  const parts = cssFile.split(":");
  return parts[0];
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
  CssFile.GUI_SCROLLBAR,
  CssFile.KEY_BINDINGS_TAB,
  CssFile.GUI_COMMANDPALETTE,
  CssFile.GUI_POP_DOWN_DIALOG,
  CssFile.GUI_POP_DOWN_LIST_PICKER,
  CssFile.GUI_LIST_PICKER,
  CssFile.TIP_VIEWER,
  CssFile.FONT_AWESOME,
  CssFile.TERMINAL_VARS,
  CssFile.VIEWER_TAB,
  CssFile.GUI_SPLITTER,
  CssFile.EMPTY_PANE_MENU,
  CssFile.GUI_SNAP_DROP_CONTAINER,
  CssFile.THEME_VARS,
  CssFile.GUI_FILE_TRANSFER_PROGRESS,
  CssFile.GUI_UPLOAD_PROGRESS_BAR
];

export class CssFileMap extends Map<CssFile, string> {
}

export interface Themeable {
  setThemeCssMap(cssFileMap: CssFileMap, themeTimeStamp: number): void;
}

export const FALLBACK_TERMINAL_THEME = "default-terminal";
export const FALLBACK_SYNTAX_THEME = "default-syntax";
export const FALLBACK_UI_THEME = "default";
