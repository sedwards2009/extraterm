/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type ThemeType = "terminal";

export interface ThemeInfo {
  name: string;
  id: string;
  type: ThemeType;
  path: string;
  provider: string;
  debug: boolean;
  comment: string;
  loadingBackgroundColor: string;
  loadingForegroundColor: string;
}

export const FALLBACK_TERMINAL_THEME = "itermcolors-terminal-theme-provider:Two Dark.itermcolors";
