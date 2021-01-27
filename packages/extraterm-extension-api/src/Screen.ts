/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Describes a change on a screen.
 */
export interface ScreenChange {
  /**
   * The index into the scrollback area of the first line added.
   *
   * The complete range of affected lines is from `startLine` up to but not including `endLine`.
   */
  startLine: number;

  /**
   * The index after the last affected line.
   *
   * The range of affected lines is from `startLine` up to but not including `endLine`.
   */
  endLine: number;
}

/**
 * A "screen" or grid of cells.
 *
 * Note that the mapping from code units in a JavaScript style UTF-16 string
 * to and from cells in a grid is complex.
 *
 * A single character / Unicode code point, can require 0, 1 or 2 cells.
 * Many Asian languages and characters are "full width" and occupy 2 cells.
 * Emojis often occupy 2 cells as well.
 *
 * There are also complications on the encoding side too. Unicode code points
 * are 32 bit values, but the code units in a JavaScript string are encoded
 * using UTF-16, and hold 16 bit values. Code points outside the 16 bit range
 * use 2 code units with the "surrogate pairs" system. In this case 2 UTF-16
 * code units can map to just one cell in the grid.
 *
 * For the most part you can ignore the difference between cells and values in
 * JavaScript's UTF-16 based strings. The methods which deal with strings and
 * indexes assume UTF-16 indexes unless noted otherwise.
 */
export interface Screen {

  /**
   * The width of the screen in cells.
   */
  readonly width: number;

  /**
   * The height of the screen in cells.
   */
  readonly height: number;

  /**
   * Get a row of text from the screen as a string.
   *
   * @param line The line/row to fetch. Top line on the screen is line 0. Last
   *    one is `height` - 1.
   * @returns The line as a string.
   */
  getLineText(line: number): string;

  /**
   * Add a hyperlink to a range of characters.
   *
   * @param line The line number of the row to affect.
   * @param x The starting UTF16 index of the characters to affect.
   * @param length The number of characters to apply the link to.
   */
  applyHyperlink(line: number, x: number, length: number, url: string): void;

  /**
   * Remove all links from a line.
   *
   * This only applies to links which were added using `applyHyperlink()`.
   *
   * @param line The line number of the row to affect.
   */
  removeHyperlinks(line: number): void;
}


export interface ScreenWithCursor extends Screen {
  /**
   * The line/row the emulator cursor is on.
   */
  readonly cursorLine: number;

  /**
   * Horizontal position of the cursor in terms of UTF16 code units.
   *
   * See `ScreenWithCursor.cursorLine` and `Screen.getLineText()`.
   */
  readonly cursorX: number;
}