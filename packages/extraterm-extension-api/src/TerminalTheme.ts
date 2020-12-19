/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * A Terminal Theme Provider supplies terminal themes to Extraterm.
 *
 * It exposes its list of terminal themes and a method to fetch the contents
 * of a requested theme..
 */
export interface TerminalThemeProvider {
  /**
   * Scan for themes and return a list.
   *
   * @param paths a list of directories which may be used to scan for themes.
   * @return the list of themes found which this provider can also read.
   */
  scanThemes(paths: string[]): TerminalThemeInfo[];

  /**
   * Read in the contents of request theme.
   *
   * @param paths a list of directories which may contain themes. This is the same list as in `scanThemes()`
   * @return the theme contents.
   */
  readTheme(paths: string[], id: string): TerminalTheme;
}

/**
 * Describes a terminal theme.
 */
export interface TerminalThemeInfo {
  /** Unique (for this provider) ID of the theme. */
  id: string;

  /**
   * Human readable name of the theme.
   */
  name: string;

  /**
   * Human readable comment regarding this theme.
   */
  comment: string;
}

export interface TerminalTheme {
  foregroundColor?: string;
  backgroundColor?: string;
  cursorForegroundColor?: string;
  cursorBackgroundColor?: string;
  selectionBackgroundColor?: string;
  findHighlightBackgroundColor?: string;

  [colorIndex: number]: string;
  // selectionunfocused-background-color: #404040;
}
