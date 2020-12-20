/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "./Utilities";


export interface Block {
  readonly type: string;
  readonly details: any;
}

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

export const TextViewerType = "extraterm:text-viewer";
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
