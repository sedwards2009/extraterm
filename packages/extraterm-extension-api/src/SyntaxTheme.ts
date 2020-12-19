/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TerminalThemeInfo } from "./TerminalTheme";

/**
 * A Syntax Theme Provider supplies syntax themes to Extraterm.
 *
 * It exposes its list of syntax themes and a method to fetch the contents
 * of a requested theme..
 */
export interface SyntaxThemeProvider {
  /**
   * Scan for themes and return a list.
   *
   * @param paths a list of directories which may be used to scan for themes.
   * @return the list of themes found which this provider can also read.
   */
  scanThemes(paths: string[]): SyntaxThemeInfo[];

  /**
   * Read in the contents of request theme.
   *
   * @param paths a list of directories which may contain themes. This is the same list as in `scanThemes()`
   * @return the theme contents.
   */
  readTheme(paths: string[], id: string): SyntaxTheme;
}

export interface SyntaxThemeInfo extends TerminalThemeInfo {

}

/**
 * The contents of a syntax theme.
 *
 * Note: All color strings must be of the form #RRGGBB.
 */
export interface SyntaxTheme {
  /**
   * Default text foreground color.
   */
  foreground: string;

  /**
   * Default text background color.
   */
  background: string;

  /**
   * Color of the cursor.
   */
  cursor: string;

  /**
   * Color to show whitespace characters (when enabled).
   */
  invisibles: string;

  /**
   * Color of the line highlight.
   */
  lineHighlight: string;

  /**
   * Selection color.
   */
  selection: string;

  /**
   * List of token coloring rules.
   */
  syntaxTokenRule: SyntaxTokenRule[];
}

export interface SyntaxTokenRule {
  /**
   * Scope of the rule.
   *
   * This string follows the naming convention for syntax token as described
   * in https://www.sublimetext.com/docs/3/scope_naming.html
   * Note that only one scope rule can be put in this field.
   */
  scope: string;

  /**
   * The text style to apply to this token.
   */
  textStyle: TextStyle;
}

/**
 * Describes a text style.
 */
export interface TextStyle {
  /**
   * Optional foreground color. Format is CSS sstyle #RRGGBB.
   */
  foregroundColor?: string;

  /**
   * Optional background color. Format is CSS sstyle #RRGGBB.
   */
  backgroundColor?: string;

  /**
   * Show as bold text.
   */
  bold?: boolean;

  /**
   * Show as italic text.
   */
  italic?: boolean;

  /**
   * Show as underline text.
   */
  underline?: boolean;
}
