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
export const TerminalType = "extraterm:terminal-output";

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
 */
export interface TerminalDetails {
  /**
   * Returns true if this output viewer is connected to a live PTY and emulator.
   *
   * @return true if this output viewer is connected to a live PTY and emulator.
   */
  isLive(): boolean;
  find(needle: string | RegExp, options?: FindOptions): boolean;
  findNext(needle: string | RegExp): boolean;
  findPrevious(needle: string | RegExp): boolean;
  hasSelection(): boolean;
  highlight(needle: string |  RegExp): void;
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
   * Get the configured tab size.
   */
  getTabSize(): number;

  /**
   * Set the tab size.
   */
  setTabSize(size: number): void;

  /**
   * Get the mimetype of the contents of this text viewer.
   */
  getMimeType(): string;

  /**
   * Set the mimetype of the cotnent of this text viewer.
   */
  setMimeType(mimeType: string): void;

  /**
   * Return true if line numbers are being shown in the gutter.
   */
  getShowLineNumbers(): boolean;

  /**
   * Set whether to show line numebrs in the gutter.
   */
  setShowLineNumbers(show: boolean): void;

  /**
   * Set whether long lines should be wrapped.
   */
  setWrapLines(wrap: boolean): void;

  /**
   * Return true if long lines are set to be wrapped.
   */
  getWrapLines(): boolean;

  find(needle: string | RegExp, options?: FindOptions): boolean;
  findNext(needle: string | RegExp): boolean;
  findPrevious(needle: string | RegExp): boolean;
  hasSelection(): boolean;
  highlight(needle: string |  RegExp): void;
}
