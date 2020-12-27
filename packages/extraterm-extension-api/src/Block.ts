/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Tab } from "./Tab";

/**
 * A block of content stacking inside a terminal.
 *
 * This includes terminal out, image viewers, frames, and other things.
 */
export interface Block {
  /**
   * Identifies this type of block.
   *
   * For terminal output and current block receiving terminal output, this
   * string will be equal to `TerminalType`, and the `details` field will
   * contain a `TerminalDetails` object.
   */
  readonly type: string;

  /**
   * Type specific details and methods for this block.
   */
  readonly details: any;

  /**
   * The Tab this block is on.
   */
  readonly tab: Tab;
}

/**
 * Identifies a `Block` of type terminal output in the `Block.type` field.
 */
export const TerminalOutputType = "extraterm:terminal-output";

export enum FindStartPosition {
  CURSOR,
  DOCUMENT_START,
  DOCUMENT_END,
}

export interface FindOptions {
  backwards?: boolean;
  startPosition?: FindStartPosition;
}

/**
 * Terminal output specific details and methods.
 *
 * This object is present in `Block.details` when a block's `type` is
 * equal to `TerminalType`.
 *
 * Some methods return row contents in the form of a normal JavaScript string.
 * Note that there isn't a simple one to one correspondence between
 * 'characters' / values in a string and cells in the terminal. JavaScript
 * strings are an array of 16bit (UTF16) values but Unicode has a 32bit range.
 * Multiple 16bit values can map to one Unicode codepoint. Also, characters
 * inside the terminal can be one cell wide or two cells wide.
 */
export interface TerminalOutputDetails {
  /**
   * True if this output viewer is connected to a live PTY and emulator.
   *
   * @return true if this output viewer is connected to a live PTY and emulator.
   */
  readonly hasPty: boolean;

  /**
   * The number of rows in the scrollback area.
   */
  readonly scrollbackLength: number;

  /**
   * Get a row from the scrollback area as a string.
   *
   * @param line The line/row to fetch from the scrollback area. First/top
   *    line on the scrollback is line 0, the last one is `scrollbackLength` - 1.
   * @returns The line as a string.
   */
  getScrollbackLineText(line: number): string;

  /**
   * The height of the screen in rows.
   *
   * The screen is the active area/grid where which can be changed by the emulation.
   */
  readonly screenHeight: number;

  /**
   * The width of the screen in columns.
   */
  readonly screenWidth: number;

  /**
   * Get a row of text from the screen as a string.
   *
   * @param line The line/row to fetch. Top line on the screen is line 0. Last
   *    one is `screenHeight` - 1.
   * @returns The line as a string.
   */
  getScreenLineText(line: number): string;

  find(needle: string | RegExp, options?: FindOptions): boolean;
  findNext(needle: string | RegExp): boolean;
  findPrevious(needle: string | RegExp): boolean;
  hasSelection(): boolean;
  highlight(needle: string |  RegExp): void;

  /**
   * True if this block of terminal output still exists.
   */
  readonly isAlive: boolean;
}

/**
 * Identifies a `Block` of type text viewer in the `Block.type` field.
 */
export const TextViewerType = "extraterm:text-viewer";

/**
 * Text viewer specific details and methods.
 *
 * This object is present in `Block.details` when a block's `type` is
 * equal to `TextViewerType`.
 */
export interface TextViewerDetails {
  /**
   * The configured tab size.
   */
  readonly tabSize: number;

  /**
   * Set the tab size.
   */
  setTabSize(size: number): void;

  /**
   * The mimetype of the contents of this text viewer.
   */
  readonly mimeType: string;

  /**
   * Set the mimetype of the cotnent of this text viewer.
   */
  setMimeType(mimeType: string): void;

  /**
   * Return true if line numbers are being shown in the gutter.
   */
  readonly showLineNumbers: boolean;

  /**
   * Set whether to show line numebrs in the gutter.
   */
  setShowLineNumbers(show: boolean): void;

  /**
   * True if long lines are set to be wrapped.
   */
  readonly wrapLines: boolean;

  /**
   * Set whether long lines should be wrapped.
   */
  setWrapLines(wrap: boolean): void;

  find(needle: string | RegExp, options?: FindOptions): boolean;
  findNext(needle: string | RegExp): boolean;
  findPrevious(needle: string | RegExp): boolean;
  hasSelection(): boolean;
  highlight(needle: string |  RegExp): void;

  /**
   * True if this block still exists.
   */
  readonly isAlive: boolean;
}
