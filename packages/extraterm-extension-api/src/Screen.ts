/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
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
   * @param lineNumber The line/row to fetch. Top line on the screen is line 0. Last
   *    one is `height` - 1.
   * @returns The line as a string.
   */
  getLineText(lineNumber: number): string;

  /**
   * Returns true if the line was wrapped.
   *
   * @param lineNumber The line/row to fetch. Top line on the screen is line 0. Last
   *    one is `height` - 1.
   * @returns True if the line was too long and had to be wrapped, otherwise false.
   */
  isLineWrapped(lineNumber: number): boolean;

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

  getBaseRow(rowNumber: number): Row;

  hasLayerRow(rowNumber: number, name: string): boolean;

  getLayerRow(rowNumber: number, name: string): Row;
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

export type StyleCode = number;

// Most of this is derived from CharCellLine.ts

export interface Cell {
  codePoint: number;
  flags: number;
  linkID: number;
  style: number;
  fgRGBA: number;
  bgRGBA: number;

  fgClutIndex: number;
  bgClutIndex: number;
}

export const STYLE_MASK_UNDERLINE = 3;
export const STYLE_MASK_BOLD = 4;
export const STYLE_MASK_ITALIC = 8;
export const STYLE_MASK_STRIKETHROUGH = 16;
export const STYLE_MASK_BLINK = 32;
export const STYLE_MASK_INVERSE = 64;
export const STYLE_MASK_INVISIBLE = 128;
export const STYLE_MASK_FAINT = 256;
export const STYLE_MASK_CURSOR = 512;
export const STYLE_MASK_OVERLINE = 1024;
export const STYLE_MASK_HYPERLINK = 2048;
export const STYLE_MASK_HYPERLINK_HIGHLIGHT = 4096;

export const UNDERLINE_STYLE_OFF = 0;
export const UNDERLINE_STYLE_NORMAL = 1;
export const UNDERLINE_STYLE_DOUBLE = 2;
export const UNDERLINE_STYLE_CURLY = 3;


export interface Row {
  readonly width: number;
  readonly isWrapped: boolean;

  /**
   * Add a hyperlink to a range of characters.
   *
   * @param x The starting UTF16 index of the characters to affect.
   * @param length The number of characters to apply the link to.
   */
  // applyHyperlink(x: number, length: number, url: string): void;

  /**
   * Remove all links from a line.
   *
   * This only applies to links which were added using `applyHyperlink()`.
   */
  // removeHyperlinks(): void;

  clear(): void;
  getCell(x: number): Cell;
  setCell(x: number, cell: Cell): void;
  clearCell(x: number): void;
  setCodePoint(x: number, codePoint: number): void;
  getCodePoint(x: number): number;
  getCharExtraWidth(x: number): number;
  getFlags(x: number): number;
  getRowFlags(): Uint8Array;
  setRowFlags(flagsArray: Uint8Array, flagMask?: number): void;
  setString(x: number, str: string): void;
  getString(x: number, count?: number): string;
  getUTF16StringLength(x: number, count?: number): number;
  getRowCodePoints(destinationArray?: Uint32Array): Uint32Array;
  setBgRGBA(x: number, rgba: number): void;
  getBgRGBA(x: number): number;
  setFgRGBA(x: number, rgba: number): void;
  getFgRGBA(x: number): number;
  setFgClutIndex(x: number, index: number): void;
  getFgClutIndex(x: number): number;
  isFgClut(x: number): boolean
  setBgClutIndex(x: number, index: number): void;
  getBgClutIndex(x: number): number;
  isBgClut(x: number): boolean;
  setStyle(x: number, style: StyleCode): void;
  getStyle(x: number): StyleCode;
  getExtraFontsFlag(x: number): boolean;
  setExtraFontsFlag(x: number, on: boolean): void;
  setLigature(x: number, ligatureLength: number): void;
  getLigature(x: number): number;
  shiftCellsRight(x: number, shiftCount: number): void;
  shiftCellsLeft(x: number, shiftCount: number): void;
}
