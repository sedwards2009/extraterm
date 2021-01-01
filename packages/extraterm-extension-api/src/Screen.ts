/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "extraterm-event-emitter";

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
 *
 *
 */
export interface Screen {

  /**
   * The width of the screen in columns.
   */
  readonly width: number;

  /**
   * The height of the screen in rows.
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

  applyHyperlink(line: number, x: number, length: number, url: string): void;
}
