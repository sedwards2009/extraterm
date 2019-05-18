/**
 * term.js - an xterm emulator
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * Copyright (c) 2014-2019, Simon Edwards <simon@simonzone.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 *
 * Forked again from Christopher Jeffrey's work by Simon Edwards in 2014 and
 * converted over to TypeScript.
 */
import { CharCellGrid } from 'extraterm-char-cell-grid';

export type CharAttr = number;

// FIXME remove
export interface OldLine {
  chars: Uint32Array;
  attrs: Uint32Array;
}

export type Line = CharCellGrid;

export interface TerminalCoord {
  x: number;
  y: number;
}

export interface TerminalSize {
  rows: number;
  columns: number;
}
export interface RenderEvent {
  rows: number;         // the current number of rows in the emulator screen.
  columns: number;      // the current number of columns comprising the emulator screen.
  realizedRows: number; // the current number of realised rows which have been touched.
  
  refreshStartRow: number;  // The start row of a range on the screen which needs to be refreshed.
                            // -1 indicates no refresh needed.
  refreshEndRow: number;    // The end row of a range on the screen which needds to be refreshed.
  
  scrollbackLines: Line[];  // List of lines which have reached the scrollback. Can be null.
  cursorRow: number;
  cursorColumn: number;
}

export interface RenderEventHandler {
  // Range of row to render from startRow to endRow exclusive.
  (instance: EmulatorApi, event: RenderEvent): void;
}

export interface BellEventListener {
  (instance: EmulatorApi): void;
}

export interface DataEventListener {
  (instance: EmulatorApi, data: string): void;
}

export interface TitleChangeEventListener {
  (instance: EmulatorApi, title: string): void;
}

export interface WriteBufferSizeEventListener {
  (instance: EmulatorApi, status: WriteBufferStatus): void;
}

export interface MouseEventOptions {
  row: number;    // 0 based.
  column: number; // 0 based.
  leftButton: boolean;
  middleButton: boolean;
  rightButton: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey : boolean;
}

export interface WriteBufferStatus {
  bufferSize: number;
}

/**
 * Handler for processing the application mode escape code.
 * 
 * Application mode is a feature specific to Extraterm. It is a generic
 * escape code intend for sending large amounts of data from an application
 * running on the remote end of the pty to the terminal emulator application.
 * 
 * The structure of the escape code is:
 * 
 *   ESC "&" [parameters separated by semicolon] 0x07 [data] 0x00
 * 
 * In english, the escape character followed by ampersand then multiple
 * parameters separated by semicolons, then the 0x07 character (BEL),
 * raw data then terminated by a NUL byte.
 * 
 * Once the 0x07 (BEL) character is received then the `start()` method is
 * called with the parameters. Then the `data()` method is called multiple
 * times as chunks of data are received, finally `end()` is called once the
 * NUL byte is seen.
 * 
 * The `start()` and `data()` methods respond with an
 * `ApplicationModeResponse` object. This is usually just
 * `{action: ApplicationModeResponseAction.CONTINUE}` but in the even that
 * the `ApplicationModeHandler` detects an error or that the remote program
 * has crashed, then `{action: ApplicationModeResponseAction.ABORT}` can be
 * returned. This will immediately exit application mode in the emulator
 * return to normal processing. It is also possible to 'push back' the unused
 * part of the data buffer in this case by using the `remainingData` field in
 * the `ApplicationModeResponse` object.
 * 
 * `ApplicationModeResponseAction.PAUSE`
 * can be used to pause processing of the PTY output stream by the emulator.
 * See `pauseProcessing()` and `resumeProcessing()` in the `EmulatorAPI`. 
 */
export interface ApplicationModeHandler {
  /**
   * Called once the start of the escape code and its parameters have been received.
   * 
   * @param params the parameters to the code.
   */
  start(params: any[]): ApplicationModeResponse;

  /**
   * Called to send the next block of body data.
   * 
   * This method is called multiple times.
   * 
   * @param data the received data.
   */
  data(data: string): ApplicationModeResponse;

  /**
   * Called once the finishing null char is received.
   */
  end(): ApplicationModeResponse;
}

export enum ApplicationModeResponseAction {
  CONTINUE,
  ABORT,
  PAUSE
}

export interface ApplicationModeResponse {
  action: ApplicationModeResponseAction,
  remainingData?: string
}

export interface MinimalKeyboardEvent {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  key: string;
  isComposing: boolean;
}


export interface EmulatorApi {
  
  size(): TerminalSize;
  
  lineAtRow(row: number, showCursor?: boolean): Line;
  
  refreshScreen(): void;
  
  resize(newSize: TerminalSize): void;

  /**
   * Reset the virtual terminal.
   */
  reset(): void;

  // Sending input events into the emulator
  keyDown(ev: KeyboardEvent): boolean;
  keyPress(ev: KeyboardEvent): boolean;
  destroy();
  
  /**
   *
   * @return true if the event has been fully handled.
   */
  mouseDown(ev: MouseEventOptions): boolean;
  
  /**
   *
   * @return true if the event has been fully handled.
   */
  mouseUp(ev: MouseEventOptions): boolean;
  
  /**
   *
   * @return true if the event has been fully handled.
   */
  mouseMove(ev: MouseEventOptions): boolean;
  
  write(data: string): WriteBufferStatus;
  
  focus(): void;
  blur(): void;
  hasFocus(): boolean;

  flushRenderQueue(): void;

  newLine(): void;

  /**
   * Suspend processing of terminal output.
   * 
   * This doesn't affect input processing like keystrokes.
   */
  pauseProcessing(): void;

  /**
   * Resume processing of terminal output.
   */
  resumeProcessing(): void;

  /**
   * Return true if terminal output processing is suspended.
   */
  isProcessingPaused(): boolean;

  // Events
  addRenderEventListener(eventHandler: RenderEventHandler): void;
  addBellEventListener(eventHandler: BellEventListener): void;
  addDataEventListener(eventHandler: DataEventListener): void;
  addTitleChangeEventListener(eventHandler: TitleChangeEventListener): void;
  addWriteBufferSizeEventListener(eventHandler: WriteBufferSizeEventListener): void;
  
  registerApplicationModeHandler(handler: ApplicationModeHandler): void;
}

// FIXME remove the rest of this stuff below

export function flagsFromCharAttr(attr: CharAttr): number {
  return attr >> 18;
}

export function foregroundFromCharAttr(attr: CharAttr): number {
  return (attr >> 9) & 0x1ff;
}

export function backgroundFromCharAttr(attr: CharAttr): number {
  return attr & 0x1ff;
}

export function packAttr(attrFlags: number, foreground: number, background: number): number {
  return (attrFlags << 18) | (foreground << 9) | background;
}

// Character rendering attributes packed inside a CharAttr.
export const BOLD_ATTR_FLAG = 1;
export const UNDERLINE_ATTR_FLAG = 2;
export const BLINK_ATTR_FLAG = 4;
export const INVERSE_ATTR_FLAG = 8;
export const INVISIBLE_ATTR_FLAG = 16;
export const ITALIC_ATTR_FLAG = 32;
export const STRIKE_THROUGH_ATTR_FLAG = 64;
export const FAINT_ATTR_FLAG = 128;
