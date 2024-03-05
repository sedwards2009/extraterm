/**
 * term.js - an xterm emulator
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * Copyright (c) 2014-2024, Simon Edwards <simon@simonzone.com>
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
import {
  ApplicationModeHandler,
  ApplicationModeResponseAction,
  BellEvent,
  DataEvent,
  EmulatorApi,
  Line,
  MinimalKeyboardEvent,
  MouseEventOptions,
  RenderEvent,
  ScreenChangeEvent,
  TerminalSize,
  TitleChangeEvent,
  WriteBufferSizeEvent,
  WriteBufferStatus,
} from 'term-api';

import { Event, EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";
import { isWide } from "extraterm-unicode-utilities";

import {
  Cell,
  FLAG_MASK_FG_CLUT,
  FLAG_MASK_BG_CLUT,
  STYLE_MASK_BOLD,
  STYLE_MASK_CURSOR,
  STYLE_MASK_FAINT,
  STYLE_MASK_ITALIC,
  STYLE_MASK_UNDERLINE,
  STYLE_MASK_BLINK,
  STYLE_MASK_INVERSE,
  STYLE_MASK_INVISIBLE,
  STYLE_MASK_STRIKETHROUGH,
  STYLE_MASK_OVERLINE,
  UNDERLINE_STYLE_OFF,
  UNDERLINE_STYLE_NORMAL,
  UNDERLINE_STYLE_DOUBLE,
  UNDERLINE_STYLE_CURLY,
  copyCell,
  setCellFgClutFlag,
  setCellBgClutFlag,
} from "extraterm-char-cell-line";
import { CellWithHyperlink, LineImpl } from "term-api-lineimpl";
import { ControlSequenceParameters } from "./ControlSequenceParameters.js";
import { MouseEncoder, MouseProtocol, MouseProtocolEncoding } from "./MouseEncoder.js";

const DEBUG_RESIZE = false;

const REFRESH_START_NULL = 100000000;
const REFRESH_END_NULL = -100000000;
const MAX_BATCH_TIME = 16;  // 16 ms = 60Hz
const REFRESH_DELAY = 100;  // ms. How long to wait before doing a screen refresh during busy times.
const BLINK_INTERVAL_MS = 500;


/**
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

enum ParserState {
  NORMAL,
  ESCAPE,
  CSI_START,
  CSI_PARAMS,
  OSC_CODE,
  OSC_ITERM_PARMS,
  OSC_PARAMS,
  CHARSET,
  DCS_START,
  DCS_STRING,
  IGNORE,
  APPLICATION_START,
  APPLICATION_END,
  DEC_HASH,
}

const MAX_PROCESS_WRITE_SIZE = 4096;

/*************************************************************************/

export type Platform = "linux" | "win32" | "darwin";

/**
 * Options
 */
interface Options {
  platform: Platform;
  rows?: number;
  columns?: number;
  debug?: boolean;
  applicationModeCookie?: string;
  performanceNowFunc?: () => number;
  setTimeout?: (func: () => void, delayMs: number) => any;
  clearTimeout?: (timerId: any) => void;
};

interface CharSet {
  [key: string]: string;
}

interface SavedState {
  lines: LineImpl[];
  cols: number;
  rows: number;
  x: number;
  y: number;
  scrollTop: number;
  scrollBottom: number;
  tabs: { [i: number]: boolean;  };
}

export const MAX_WRITE_BUFFER_SIZE = 1024 * 100;  // 100 KB


export class Emulator implements EmulatorApi {
  private _log: Logger = null;
  #cols = 80;
  #rows = 24;
  #cellWidthPixels = 8;
  #cellHeightPixels = 8;

  #state = ParserState.NORMAL;

  #mouseEncoder = new MouseEncoder();

  #x = 0;      // Cursor x position
  #y = 0;      // Cursor y position
  #savedX = 0;
  #savedY = 0;

  #oldy = 0;

  #cursorBlinkState = false;

  #cursorHidden = false;
  #hasFocus = false;

  #queue = '';
  #scrollTop = 0;
  #scrollBottom = 23;

  // modes
  #applicationKeypad = false;
  #applicationCursorKeys = false;
  #originMode = false;
  #insertMode = false;
  #wraparoundMode = false;
  #normalSavedState: SavedState = null;
  #bracketedPaste = false;  // See https://cirw.in/blog/bracketed-paste

  // charset
  #charset: CharSet = null;
  #savedCharset: CharSet = null;
  #gcharset: number = null;
  #glevel = 0;
  #charsets: CharSet[] = [null];

  // Default character style
  static defAttr: CellWithHyperlink = {
    codePoint: " ".codePointAt(0),
    flags: FLAG_MASK_FG_CLUT | FLAG_MASK_BG_CLUT,
    style: 0,
    linkID: 0,
    hyperlinkID: null,
    hyperlinkURL: null,
    fgClutIndex: 257,
    bgClutIndex: 256,
    fgRGBA: 0xffffffff,
    bgRGBA: 0x00000000,
    imageID: 0,
    imageX: 0,
    imageY: 0,
  };

  // Current character style.
  readonly #curAttr: CellWithHyperlink = {
    codePoint: " ".codePointAt(0),
    flags: FLAG_MASK_FG_CLUT | FLAG_MASK_BG_CLUT,
    style: 0,
    linkID: 0,
    hyperlinkID: null,
    hyperlinkURL: null,
    fgClutIndex: 257,
    bgClutIndex: 256,
    fgRGBA: 0xffffffff,
    bgRGBA: 0x00000000,
    imageID: 0,
    imageX: 0,
    imageY: 0,
  };

  readonly #savedCurAttr: CellWithHyperlink = {
    codePoint: " ".codePointAt(0),
    flags: 0,
    style: 0,
    linkID: 0,
    hyperlinkID: null,
    hyperlinkURL: null,
    fgClutIndex: 257,
    bgClutIndex: 256,
    fgRGBA: 0xffffffff,
    bgRGBA: 0x00000000,
    imageID: 0,
    imageX: 0,
    imageY: 0,
  };

  #params = new ControlSequenceParameters();
  #blinkIntervalId: null | number = null;
  #lines: LineImpl[] = [];
  #isCursorBlink: boolean = false;
  debug: boolean;

  #applicationModeCookie: string;
  #applicationModeHandler: ApplicationModeHandler = null;

  #platform: Platform = "linux";

  #writeBuffers: string[] = [];         // Buffer for incoming data waiting to be processed.
  #processWriteChunkTimer: any = null;  // Timer ID for our write chunk timer.
  #paused = false;
  #refreshTimer: any = null;            // Timer ID for triggering an on scren refresh.
  #performanceNow: () => number = null;

  #setTimeout: (func: () => void, delayMs: number) => number = null;
  #clearTimeout: (timerId: number) => void = null;

  #scrollbackLineQueue: Line[] = [];  // Queue of scrollback lines which need to sent via an event.
  #refreshStart = REFRESH_START_NULL;
  #refreshEnd = REFRESH_END_NULL;

  #tabs: { [key: number]: boolean };
  #sendFocus = false;

  #blinker: Function = null;
  #savedCols: number;
  #title: string = "";

  onRender: Event<RenderEvent>;
  #onRenderEventEmitter = new EventEmitter<RenderEvent>();

  onBell: Event<BellEvent>;
  #onBellEventEmitter = new EventEmitter<BellEvent>();

  // Events to support OSC 133 shell intergration codes as documented here:
  //   https://iterm2.com/documentation-escape-codes.html
  // and also for OSC 633 codes as documented here:
  //   https://code.visualstudio.com/docs/terminal/shell-integration

  // OSC 133 ; A ST
  // OSC 633 ; A ST
  onPromptStart: Event<void>;
  #onPromptStartEventEmitter = new EventEmitter<void>();

  // OSC 133 ; B ST
  // OSC 633 ; B ST
  onPromptEnd: Event<void>;
  #onPromptEndEventEmitter = new EventEmitter<void>();

  // OSC 133 ; C ST
  // OSC 633 ; C ST
  onPreexecution: Event<void>;
  #onPreexecutionEventEmitter = new EventEmitter<void>();

  // OSC 133 ; D ST
  // OSC 633 ; D ST
  onEndExecution: Event<string>;
  #onEndExecutionEventEmitter = new EventEmitter<string>();

  // OSC 633 ; E ST
  onCommandLineSet: Event<string>;
  #onCommandLineSetEventEmitter = new EventEmitter<string>();

  onData: Event<DataEvent>;
  #onDataEventEmitter = new EventEmitter<DataEvent>();

  onTitleChange: Event<TitleChangeEvent>;
  #onTitleChangeEventEmitter = new EventEmitter<TitleChangeEvent>();

  onWriteBufferSize: Event<WriteBufferSizeEvent>;
  #onWriteBufferSizeEventEmitter = new EventEmitter<WriteBufferSizeEvent>();

  onScreenChange: Event<ScreenChangeEvent>;
  #onScreenChangeEventEmitter = new EventEmitter<ScreenChangeEvent>();

  constructor(options: Options) {
    this._log = getLogger("Emulator", this);
    this.#rows = options.rows === undefined ? 24 : options.rows;
    this.#cols = options.columns === undefined ? 80 : options.columns;
    this.debug = options.debug === undefined ? false : options.debug;
    this.#applicationModeCookie = options.applicationModeCookie === undefined ? null : options.applicationModeCookie;
    if (options.performanceNowFunc == null) {
      this.#performanceNow = window.performance.now.bind(window.performance);
    } else {
      this.#performanceNow = options.performanceNowFunc;
    }

    this.#setTimeout = options.setTimeout ?? setTimeout;
    this.#clearTimeout = options.clearTimeout ?? clearTimeout;

    this.#platform = options.platform;

    this.onRender = this.#onRenderEventEmitter.event;
    this.onScreenChange = this.#onScreenChangeEventEmitter.event;
    this.onBell = this.#onBellEventEmitter.event;

    this.onPromptStart = this.#onPromptStartEventEmitter.event;
    this.onPromptEnd = this.#onPromptEndEventEmitter.event;
    this.onPreexecution = this.#onPreexecutionEventEmitter.event;
    this.onEndExecution = this.#onEndExecutionEventEmitter.event;
    this.onCommandLineSet = this.#onCommandLineSetEventEmitter.event;

    this.onData = this.#onDataEventEmitter.event;
    this.onTitleChange = this.#onTitleChangeEventEmitter.event;
    this.onWriteBufferSize = this.#onWriteBufferSizeEventEmitter.event;

    this.#state = ParserState.NORMAL;

    this.#resetVariables();
    this.#hasFocus = false;

    this.#writeBuffers = [];  // Buffer for incoming data waiting to be processed.
    this.#processWriteChunkTimer = null;  // Timer ID for our write chunk timer.

    this.#refreshTimer = null;  // Timer ID for triggering an on scren refresh.

    this.#startBlink();
  }

  destroy(): void {
    if (this.#processWriteChunkTimer !== null) {
      this.#clearTimeout(this.#processWriteChunkTimer);
      this.#processWriteChunkTimer = null;
    }

    if (this.#refreshTimer !== null) {
      this.#clearTimeout(this.#refreshTimer);
    }

    this.handler = function() {};
    this.write = () => ( { bufferSize: 0 } );
    this.#applicationModeHandler = null;
  }

  #resetVariables(): void {
    this.#x = 0;
    this.#setCursorY(0);
    this.#oldy = 0;

    this.#cursorBlinkState = true;       // Cursor blink state.

    this.#cursorHidden = false;
    this.#hasFocus = false;

  //  this.convertEol;

    this.#queue = '';
    this.#scrollTop = 0;
    this.#scrollBottom = this.#rows - 1;

    // modes
    this.#applicationKeypad = false;
    this.#applicationCursorKeys = false;
    this.#originMode = false;
    this.#insertMode = false;
    this.#wraparoundMode = false;
    this.#normalSavedState = null;
    this.#bracketedPaste = false;

    // charset
    this.#charset = null;
    this.#gcharset = null;
    this.#glevel = 0;
    this.#charsets = [null];

    copyCell(Emulator.defAttr, this.#curAttr); // Current character style.

    this.#params = new ControlSequenceParameters();
    this.#lines = [];
    this.#setupStops();

    this.#mouseEncoder = new MouseEncoder();
  }

  // back_color_erase feature for xterm.
  eraseAttr(): Cell {
    return this.#curAttr;
  }

  focus(): void {
    if (this.#sendFocus) {
      this.#send('\x1b[I');
    }
    this.#hasFocus = true;
    this.#showCursor();
    this.#dispatchRenderEvent();
  }

  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    return this.#hasFocus;
  }

  getCursorRow(): number {
    return this.#y;
  }

  blur(): void {
    if (!this.#hasFocus) {
      return;
    }

    this.#markRowRangeForRefresh(this.#y, this.#y);
    if (this.#sendFocus) {
      this.#send('\x1b[O');
    }
    this.#hasFocus = false;
    this.#dispatchRenderEvent();
  }

  mouseDown(ev: MouseEventOptions): boolean {
    const sequence = this.#mouseEncoder.mouseDown(ev);
    if (sequence != null) {
      this.#send(sequence);
      return true;
    } else {
      return false;
    }
  }

  mouseMove(ev: MouseEventOptions): boolean {
    const sequence = this.#mouseEncoder.mouseMove(ev);
    if (sequence != null) {
      this.#send(sequence);
      return true;
    } else {
      return false;
    }
  }

  mouseUp(ev: MouseEventOptions): boolean {
    const sequence = this.#mouseEncoder.mouseUp(ev);
    if (sequence != null) {
      this.#send(sequence);
      return true;
    } else {
      return false;
    }
  }

  mouseWheelUp(ev: MouseEventOptions): boolean {
    const sequence = this.#mouseEncoder.wheelUp(ev);
    if (sequence != null) {
      this.#send(sequence);
      return true;
    } else {
      return false;
    }
  }

  mouseWheelDown(ev: MouseEventOptions): boolean {
    const sequence = this.#mouseEncoder.wheelDown(ev);
    if (sequence != null) {
      this.#send(sequence);
      return true;
    } else {
      return false;
    }
  }

  refreshScreen(): void {
    this.#markRowRangeForRefresh(0, this.#lines.length);
    this.#dispatchRenderEvent();
  }

  /**
   * Moves all of the rows above the cursor into the physical scrollback area.
   */
  moveRowsAboveCursorToScrollback(): void {
    const lines = this.#lines.slice(0, this.#y);
    const newLines = this.#lines.slice(this.#y);

    lines.forEach(line => this.#scrollbackLineQueue.push(line));

    this.#lines = newLines;

    this.#markAllRowsForRefresh();
    this.#setCursorY(0);
    this.#oldy = 0;

    this.#scheduleRefresh(true);
  }

  flushRenderQueue(): void {
    this.#dispatchRenderEvent();
  }

  #getRow(row: number): LineImpl {
    while (row >= this.#lines.length) {
      this.#lines.push(this.#blankLine());
    }
    return this.#lines[row];
  }

  // Fetch the LineCell at row 'row' if it exists, else return null.
  #tryGetRow(row: number): LineImpl {
    return row >= this.#lines.length ? null : this.#lines[row];
  }

  getDimensions(): { rows: number; cols: number; materializedRows: number; cursorX: number; cursorY: number; } {
    return {
      rows: this.#rows,
      cols: this.#cols,
      materializedRows: this.#lines.length,
      cursorX: this.#x,
      cursorY: this.#y
    };
  }

  getLineText(y: number): string {
    if (y <0 || y >= this.#lines.length) {
      return null;
    }
    const row = this.#lines[y];
    return row.getString(0);
  }

  /**
   * Rendering Engine
   */

  /**
   * Schedule a screen refresh and update.
   *
   * @param {boolean} immediate True if the refresh should occur as soon as possible. False if a slight delay is permitted.
   */
  #scheduleRefresh(immediate: boolean): void {
    if (this.#refreshTimer === null) {
      this.#refreshTimer = this.#setTimeout(() => {
        this.#refreshTimer = null;
        this.#refreshFrame();
      }, immediate ? 0 : REFRESH_DELAY);
    }
  }

  /**
   * Refresh and update the screen.
   *
   * Usually call via a timer.
   */
  #refreshFrame(): void {
    this.#dispatchRenderEvent();
    this.#refreshStart = REFRESH_START_NULL;
    this.#refreshEnd = REFRESH_END_NULL;
  }

  /**
   * Marks a range of rows to be refreshed on the screen.
   *
   * @param {number} start start row to refresh
   * @param {number} end   end row (INCLUSIVE!) to refresh
   */
  #markRowRangeForRefresh(start: number, end: number): void {
    this.#refreshStart = Math.min(start, this.#refreshStart);
    this.#refreshEnd = Math.max(end + 1, this.#refreshEnd);
  }

  lineAtRow(row: number): Line {
    if (row < 0 || row >= this.#rows) {
      return null;
    }

    const line = this.#getRow(row);

    // Place the cursor in the row.
    if (row === this.#y &&
        this.#cursorBlinkState &&
        ! this.#cursorHidden &&
        this.#x < this.#cols) {

      const newLine = line.clone();
      newLine.setStyle(this.#x, newLine.getStyle(this.#x) | STYLE_MASK_CURSOR);
      newLine.layers = line.layers;
      return newLine;
    }
    return line;
  }

  applyHyperlink(row: number, column: number, length: number, url: string, group: string=""): void {
    if (row < 0 || row >= this.#rows) {
      return;
    }

    const line = this.#getRow(row);
    const linkID = line.getOrCreateLinkIDForURL(url, group);
    for (let i = 0; i < length; i++) {
      line.setLinkID(column + i, linkID);
    }
    this.#markRowForRefresh(row);
  }

  removeHyperlinks(row: number, group: string=""): void {
    if (row < 0 || row >= this.#rows) {
      return;
    }

    const line = this.#getRow(row);
    const width = line.width;
    let didRemove = false;
    if (group === "") {
      for (let i=0; i<width; i++) {
        const linkID = line.getLinkID(i);
        if (linkID !== 0) {
          line.setLinkID(i, 0);
          didRemove = true;
        }
      }

    } else {
      const targetLinkIDs = line.getAllLinkIDs(group);
      if (targetLinkIDs.length !== 0) {
        for (let i=0; i<width; i++) {
          const linkID = line.getLinkID(i);
          if (targetLinkIDs.includes(linkID)) {
            line.setLinkID(i, 0);
            didRemove = true;
          }
        }
      }
    }

    if (didRemove) {
      this.#markRowForRefresh(row);
    }
  }

  #XcursorBlink(): void {
    if ( ! this.hasFocus()) {
      return;
    }
    this.#cursorBlinkState = ! this.#cursorBlinkState;
    this.#markRowForRefresh(this.#y);
    this.#scheduleRefresh(true);
  }

  #showCursor(): void {
    if ( ! this.#isCursorBlink) {
      return;
    }

    if (this.#blinkIntervalId !== null) {
      clearInterval(this.#blinkIntervalId);
    }
    this.#blinkIntervalId = setInterval(this.#blinker, BLINK_INTERVAL_MS);

    this.#cursorBlinkState = true;
    this.#getRow(this.#y);
    this.#markRowForRefresh(this.#y);
    this.#scheduleRefresh(true);
  }

  /**
   * Set cursor blinking on or off.
   *
   * @param {boolean} blink True if the cursor should blink.
   */
  setCursorBlink(blink: boolean): void {
    if (blink === this.#isCursorBlink) {
      return;
    }

    if (this.#blinkIntervalId !== null) {
      clearInterval(this.#blinkIntervalId);
      this.#blinkIntervalId = null;
    }

    this.#isCursorBlink = blink;
    if (blink) {
      this.#startBlink();
    } else {
      this.#cursorBlinkState = true;
      this.#getRow(this.#y);
      this.#markRowForRefresh(this.#y);
      this.#scheduleRefresh(true);
    }
  }

  #startBlink(): void {
    this.#blinker = () => this.#XcursorBlink();
    this.#showCursor();
  }

  #scroll(): void {
    // Drop the oldest line into the scrollback buffer.
    if (this.#scrollTop === 0) {
      this.#scrollbackLineQueue.push(this.#lines[0]);
    }

    // last line
    const lastline = this.#rows - 1;

    // subtract the bottom scroll region
    const insertRow = lastline - this.#rows + 1 + this.#scrollBottom;

    this.#lines.splice(this.#scrollTop, 1);

    // add our new line
    this.#lines.splice(insertRow, 0, this.#blankLine());

    this.#markRowForRefresh(this.#scrollTop);
    this.#markRowForRefresh(this.#scrollBottom);
  }

  write(data: string): WriteBufferStatus {
    this.#writeBuffers.push(data);
    this.#scheduleProcessWriteChunk();
    return this.#writeBufferStatus();
  }

  getWriteBufferStatus(): WriteBufferStatus {
    return this.#writeBufferStatus();
  }

  #writeBufferStatus(): WriteBufferStatus {
    const size = this.#writeBuffers.map( (buf) => buf.length ).reduce( (accu, x) => accu + x, 0);
    return { bufferSize: MAX_WRITE_BUFFER_SIZE - size };
  }

  #emitWriteBufferSizeEvent(): void {
    this.#onWriteBufferSizeEventEmitter.fire({
      instance: this,
      status: this.#writeBufferStatus()
    });
  }

  /**
   * Schedule the write chunk process to run the next time the event loop is entered.
   */
  #scheduleProcessWriteChunk(): void {
    if (this.#processWriteChunkTimer === null) {
      this.#processWriteChunkTimer = this.#setTimeout(() => {
        this.#processWriteChunkTimer = null;
        this.#processWriteChunkRealTime();
      }, 0);
    }
  }

  pauseProcessing(): void {
    if (this.#paused) {
      return;
    }

    this.#paused = true;
    if (this.#processWriteChunkTimer === null) {
      this.#clearTimeout(this.#processWriteChunkTimer);
      this.#processWriteChunkTimer = null;
    }
  }

  resumeProcessing(): void {
    if ( ! this.#paused) {
      return;
    }

    this.#paused = false;
    this.#scheduleProcessWriteChunk();
    this.#emitWriteBufferSizeEvent();
  }

  isProcessingPaused(): boolean {
    return this.#paused;
  }

  /**
   * Process the next chunk of data to written into a the line array.
   */
  #processWriteChunkRealTime(): void {
    const starttime = this.#performanceNow();
  //console.log("++++++++ _processWriteChunk() start time: " + starttime);

    // Schedule a call back just in case. setTimeout(.., 0) still carries a ~4ms delay.
    this.#scheduleProcessWriteChunk();

    while (! this.#paused) {
      if (this.#processOneWriteChunk() === false) {
        this.#clearTimeout(this.#processWriteChunkTimer);
        this.#processWriteChunkTimer = null;

        this.#scheduleRefresh(true);
        this.#emitWriteBufferSizeEvent();
        break;
      }

      const nowtime = this.#performanceNow();
      if ((nowtime - starttime) > MAX_BATCH_TIME) {
        this.#scheduleRefresh(false);
        this.#emitWriteBufferSizeEvent();
        break;
      }
    }
  //  console.log("---------- _processWriteChunk() end time: " + this._performanceNow());
  }

  /**
   * Process one chunk of written data.
   *
   * @returns {boolean} True if there are extra chunks available which need processing.
   */
  #processOneWriteChunk(): boolean {
    if (this.#writeBuffers.length === 0) {
      return false; // Nothing to do.
    }

    let chunk = this.#writeBuffers[0];
    if (chunk.length <= MAX_PROCESS_WRITE_SIZE) {
      this.#writeBuffers.splice(0, 1);
    } else {
      this.#writeBuffers[0] = chunk.slice(MAX_PROCESS_WRITE_SIZE);
      chunk = chunk.slice(0, MAX_PROCESS_WRITE_SIZE);
    }

    const remainingPartOfChunk = this.#processWriteData(chunk);
    if (remainingPartOfChunk != null && remainingPartOfChunk.length !== 0) {
      this.#writeBuffers.splice(0, 0, remainingPartOfChunk);
    }
    return this.#writeBuffers.length !== 0;
  }

  #flushWriteBuffer(): void {
    while(this.#processOneWriteChunk()) {
      // Keep on going until it is all done.
    }
    this.#emitWriteBufferSizeEvent();
  }

  /**
   * Process a block of characters and control sequences and render them to the screen.
   *
   * @param data the string of characters and control sequences to process.
   */
  #processWriteData(data: string): string {
  //console.log("write() data.length: " + data.length);
  //var starttime = window.performance.now();
  //var endtime;
  //console.log("write() start time: " + starttime);

    this.#oldy = this.#y;

    let i = 0;
    for (i=0; i < data.length && ! this.#paused; i++) {
      let ch = data[i];

      let codePoint = 0;

      // Unicode UTF-16 surrogate handling.
      if ((ch.charCodeAt(0) & 0xFC00) === 0xD800) { // High surrogate.
        const highSurrogate = ch.charCodeAt(0);
        i++;
        if (i < data.length) {
          const lowSurrogate = data[i].charCodeAt(0);
          codePoint = ((highSurrogate & 0x03FF) << 10) | (lowSurrogate & 0x03FF) + 0x10000;
        }
        ch = ' '; // fake it just enough to hit the right code below.
      } else {
        codePoint = ch.codePointAt(0);
      }

      switch (this.#state) {
        case ParserState.NORMAL:
          switch (ch) {
            // '\0'
            // case '\0':
            // case '\200':l
            //   break;

            // '\a'
            case '\x07':
              this.#bell();
              break;

            // '\n', '\v', '\f'
            case '\n':
            case '\x0b':
            case '\x0c':
              this.newLine();
              break;

            // '\r'
            case '\r':
              this.carriageReturn();
              break;

            // '\b'
            case '\x08':
              if (this.#x > 0) {
                this.#x--;
              }
              break;

            // '\t'
            case '\t':
              this.#x = this.#nextStop();
              break;

            // shift out
            case '\x0e':
              this.#setgLevel(1);
              break;

            // shift in
            case '\x0f':
              this.#setgLevel(0);
              break;

            // '\e'
            case '\x1b':
              this.#state = ParserState.ESCAPE;
              break;

            default:
              // ' '
              if (ch >= ' ') {
                if (this.#charset && this.#charset[ch]) {
                  ch = this.#charset[ch];
                  codePoint = ch.codePointAt(0);
                }

                if (this.#x >= this.#cols) {
                  this.#x = 0;
                  this.#markRowForRefresh(this.#y);
                  this.#markRowAsWrapped(this.#y);
                  if (this.#y+1 > this.#scrollBottom) {
                    this.#scroll();
                  } else {
                    this.#setCursorY(this.#y+1);
                  }
                }

                const line = this.#getRow(this.#y);
                if (this.#insertMode) {
                  // Push the characters out of the way to make space.
                  line.shiftCellsRight(this.#x, 1);
                  line.setCodePoint(this.#x, " ".codePointAt(0));
                  if (isWide(codePoint)) {
                    line.shiftCellsRight(this.#x, 1);
                    line.setCodePoint(this.#x, " ".codePointAt(0));
                  }
                }

                line.setCellAndLink(this.#x, this.#curAttr);
                line.setCodePoint(this.#x, codePoint);

                this.#x++;
                this.#markRowForRefresh(this.#y);

                if (isWide(codePoint)) {
                  const j = this.#y;
                  const line = this.#getRow(j);
                  if (this.#cols < 2 || this.#x >= this.#cols) {
                    line.setCellAndLink(this.#x - 1, this.#curAttr);
                    line.setCodePoint(this.#x - 1, " ".codePointAt(0));
                    break;
                  }
                  line.setCellAndLink(this.#x, this.#curAttr);
                  line.setCodePoint(this.#x, " ".codePointAt(0));
                  this.#x++;
                }
              }
              break;
          }
          break;

        case ParserState.ESCAPE:
          i = this.#processDataEscape(ch, i);
          break;

        case ParserState.CHARSET:
          i = this.#processDataCharset(ch, i);
          break;

        case ParserState.OSC_CODE:
        case ParserState.OSC_ITERM_PARMS:
        case ParserState.OSC_PARAMS:
          i = this.#processDataOSC(ch, i);
          break;

        case ParserState.CSI_START:
        case ParserState.CSI_PARAMS:
          i = this.#processDataCSI(ch, i);
          break;

        case ParserState.DCS_START:
        case ParserState.DCS_STRING:
          i = this.#processDataDCS(ch, i);
          break;

        case ParserState.IGNORE:
          i = this.#processDataIgnore(ch, i);
          break;

        case ParserState.APPLICATION_START:
          this.#processDataApplicationStart(ch);
          break;

        case ParserState.APPLICATION_END:
          [data, i] = this.#processDataApplicationEnd(data, i);
          break;

        case ParserState.DEC_HASH:
          this.#processDataDecHash(ch);
          break;
      }

      if (this.#y !== this.#oldy) {
        this.#markRowForRefresh(this.#oldy);
        this.#markRowForRefresh(this.#y);
        this.#oldy = this.#y;
      }
    }
    this.#markRowForRefresh(this.#y);

  //  endtime = window.performance.now();
  //console.log("write() end time: " + endtime);
  //  console.log("duration: " + (endtime - starttime) + "ms");
    if (i < data.length) {
      return data.slice(i);
    }
    return null;
  }

  #processDataCSI(ch: string, i: number): number {
    switch (this.#state) {
      case ParserState.CSI_START:
        // '?', '>', '!'
        if (ch === '?' || ch === '>' || ch === '!') {
          this.#params.prefix = ch;
        } else {
          // Push this char back and try again.
          i--;
        }
        this.#state = ParserState.CSI_PARAMS;
        return i;

      case ParserState.CSI_PARAMS:
        // 0 - 9
        if (ch >= '0' && ch <= '9') {
          this.#params.appendDigit(ch);
          return i;
        }

        // '$', '"', ' ', '\''
        if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
          return i;
        }

        this.#params.nextParameter();

        if (ch === ';') {
          return i;
        }

        if (ch === ':') {
          this.#params.startSubparameter();
          return i;
        }

        this.#executeCSICommand(this.#params, ch);
        this.#state = ParserState.NORMAL;
        break;
    }
    return i;
  }

  #executeCSICommand(params: ControlSequenceParameters, ch: string): void {
    switch (ch) {
      // CSI Ps A
      // Cursor Up Ps Times (default = 1) (CUU).
      case 'A':
        if (params.prefix === "") {
          this.#cursorUp(params);
        }
        break;

      // CSI Ps B
      // Cursor Down Ps Times (default = 1) (CUD).
      case 'B':
        if (params.prefix === "") {
          this.#cursorDown(params);
        }
        break;

      // CSI Ps C
      // Cursor Forward Ps Times (default = 1) (CUF).
      case 'C':
        if (params.prefix === "") {
          this.#cursorForward(params);
        }
        break;

      // CSI Ps D
      // Cursor Backward Ps Times (default = 1) (CUB).
      case 'D':
        if (params.prefix === "") {
          this.#cursorBackward(params);
        }
        break;

      // CSI Ps ; Ps H
      // Cursor Position [row;column] (default = [1,1]) (CUP).
      case 'H':
        if (params.prefix === "") {
          this.#cursorPos(params);
        }
        break;

      // CSI Ps J  Erase in Display (ED).
      // CSI ? Ps J
      //   Erase in Display (DECSED).
      case 'J':
        if (params.prefix === "") {
          this.#eraseInDisplay(params);
        }
        break;

      // CSI Ps K  Erase in Line (EL).
      // CSI ? Ps K
      //   Erase in Line (DECSEL).
      case 'K':
        this.#eraseInLine(params);
        break;

      // CSI Pm m  Character Attributes (SGR).
      case 'm':
        if ( ! params.prefix) {
          this.#charAttributes(params);
        }
        break;

      // CSI Ps n  Device Status Report (DSR).
      case 'n':
        if ( ! params.prefix) {
          this.#deviceStatus(params);
        }
        break;

      /**
       * Additions
       */

      // CSI Ps @
      // Insert Ps (Blank) Character(s) (default = 1) (ICH).
      case '@':
        if (params.prefix === "") {
          this.#insertChars(params);
        }
        break;

      // CSI Ps E
      // Cursor Next Line Ps Times (default = 1) (CNL).
      case 'E':
        if (params.prefix === "") {
          this.#cursorNextLine(params);
        }
        break;

      // CSI Ps F
      // Cursor Preceding Line Ps Times (default = 1) (CNL).
      case 'F':
        if (params.prefix === "") {
          this.#cursorPrecedingLine(params);
        }
        break;

      // CSI Ps G
      // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
      case 'G':
        if (params.prefix === "") {
          this.#cursorCharAbsolute(params);
        }
        break;

      // CSI Ps L
      // Insert Ps Line(s) (default = 1) (IL).
      case 'L':
        if (params.prefix === "") {
          this.#insertLines(params);
        }
        break;

      // CSI Ps M
      // Delete Ps Line(s) (default = 1) (DL).
      case 'M':
        if (params.prefix === "") {
          this.#deleteLines(params);
        }
        break;

      // CSI Ps P
      // Delete Ps Character(s) (default = 1) (DCH).
      case 'P':
        if (params.prefix === "") {
          this.#deleteChars(params);
        }
        break;

      // CSI Ps X
      // Erase Ps Character(s) (default = 1) (ECH).
      case 'X':
        if (params.prefix === "") {
          this.#eraseChars(params);
        }
        break;

      // CSI Pm `  Character Position Absolute
      //   [column] (default = [row,1]) (HPA).
      case '`':
        if (params.prefix === "") {
          this.#charPosAbsolute(params);
        }
        break;

      // 141 61 a * HPR -
      // Horizontal Position Relative
      case 'a':
        if (params.prefix === "") {
          this.#HPositionRelative(params);
        }
        break;

      // CSI P s c
      // Send Device Attributes (Primary DA).
      // CSI > P s c
      // Send Device Attributes (Secondary DA)
      case 'c':
        this.#sendDeviceAttributes(params);
        break;

      // CSI Pm d
      // Line Position Absolute  [row] (default = [1,column]) (VPA).
      case 'd':
        if (params.prefix === "") {
          this.#linePosAbsolute(params);
        }
        break;

      // 145 65 e * VPR - Vertical Position Relative
      case 'e':
        if (params.prefix === "") {
          this.#VPositionRelative(params);
        }
        break;

      // CSI Ps ; Ps f
      //   Horizontal and Vertical Position [row;column] (default =
      //   [1,1]) (HVP).
      case 'f':
        if (params.prefix === "") {
          this.#HVPosition(params);
        }
        break;

      // CSI Pm h  Set Mode (SM).
      // CSI ? Pm h - mouse escape codes, cursor escape codes
      case 'h':
        this.#setMode(params);
        break;

      // CSI Pm l  Reset Mode (RM).
      // CSI ? Pm l
      case 'l':
        this.#resetMode(params);
        break;

      // CSI Ps ; Ps r
      //   Set Scrolling Region [top;bottom] (default = full size of win-
      //   dow) (DECSTBM).
      // CSI ? Pm r
      case 'r':
        this.#setScrollRegion(params);
        break;

      // CSI s     Save cursor (ANSI.SYS).
      // CSI ? Pm s
      case 's':
        if (params.prefix === '?') {
          this.#savePrivateValues(params);
        } else if (params.prefix === '') {
          this.#saveCursor();
        }
        break;

      // CSI Ps ; Ps ; Ps t
      //         Window manipulation (from dtterm, as well as extensions).
      //         These controls may be disabled using the allowWindowOps
      //         resource.  Valid values for the first (and any additional
      //         parameters) are:
      //           Ps = 1  -> De-iconify window.
      //           Ps = 2  -> Iconify window.
      //           Ps = 3  ;  x ;  y -> Move window to [x, y].
      //           Ps = 4  ;  height ;  width -> Resize the xterm window to
      //         given height and width in pixels.  Omitted parameters reuse
      //         the current height or width.  Zero parameters use the dis-
      //         play's height or width.
      //           Ps = 5  -> Raise the xterm window to the front of the stack-
      //         ing order.
      //           Ps = 6  -> Lower the xterm window to the bottom of the
      //         stacking order.
      //           Ps = 7  -> Refresh the xterm window.
      //           Ps = 8  ;  height ;  width -> Resize the text area to given
      //         height and width in characters.  Omitted parameters reuse the
      //         current height or width.  Zero parameters use the display's
      //         height or width.
      //           Ps = 9  ;  0  -> Restore maximized window.
      //           Ps = 9  ;  1  -> Maximize window (i.e., resize to screen
      //         size).
      //           Ps = 9  ;  2  -> Maximize window vertically.
      //           Ps = 9  ;  3  -> Maximize window horizontally.
      //           Ps = 1 0  ;  0  -> Undo full-screen mode.
      //           Ps = 1 0  ;  1  -> Change to full-screen.
      //           Ps = 1 0  ;  2  -> Toggle full-screen.
      //           Ps = 1 1  -> Report xterm window state.  If the xterm window
      //         is open (non-iconified), it returns CSI 1 t .  If the xterm
      //         window is iconified, it returns CSI 2 t .
      //           Ps = 1 3  -> Report xterm window position.
      //         Result is CSI 3 ; x ; y t
      //           Ps = 1 4  -> Report xterm window in pixels.
      //         Result is CSI  4  ;  height ;  width t
      //           Ps = 1 8  -> Report the size of the text area in characters.
      //         Result is CSI  8  ;  height ;  width t
      //           Ps = 1 9  -> Report the size of the screen in characters.
      //         Result is CSI  9  ;  height ;  width t
      //           Ps = 2 0  -> Report xterm window's icon label.
      //         Result is OSC  L  label ST
      //           Ps = 2 1  -> Report xterm window's title.
      //         Result is OSC  l  label ST
      //           Ps = 2 2  ;  0  -> Save xterm icon and window title on
      //         stack.
      //           Ps = 2 2  ;  1  -> Save xterm icon title on stack.
      //           Ps = 2 2  ;  2  -> Save xterm window title on stack.
      //           Ps = 2 3  ;  0  -> Restore xterm icon and window title from
      //         stack.
      //           Ps = 2 3  ;  1  -> Restore xterm icon title from stack.
      //           Ps = 2 3  ;  2  -> Restore xterm window title from stack.
      //           Ps >= 2 4  -> Resize to Ps lines (DECSLPP).
      // CSI > Ps; Ps t
      //         Set one or more features of the title modes.  Each parameter
      //         enables a single feature.
      //           Ps = 0  -> Set window/icon labels using hexadecimal.
      //           Ps = 1  -> Query window/icon labels using hexadecimal.
      //           Ps = 2  -> Set window/icon labels using UTF-8.
      //           Ps = 3  -> Query window/icon labels using UTF-8.  (See dis-
      //         cussion of "Title Modes")
      // CSI Ps SP t
      //         Set warning-bell volume (DECSWBV, VT520).
      //           Ps = 0  or 1  -> off.
      //           Ps = 2 , 3  or 4  -> low.
      //           Ps = 5 , 6 , 7 , or 8  -> high.
      // CSI Pt; Pl; Pb; Pr; Ps$ t
      //         Reverse Attributes in Rectangular Area (DECRARA), VT400 and
      //         up.
      //           Pt; Pl; Pb; Pr denotes the rectangle.
      //           Ps denotes the attributes to reverse, i.e.,  1, 4, 5, 7.
      case 't':
        switch (params[0].intValue) {
          case 16:  // Report the pixel size of a cell
            this.#send(`\x1b[6;${this.#cellWidthPixels};${this.#cellHeightPixels}t`);
            break;

          case 14:
          case 18:  // Report the size of the text area in characters.
            this.#send(`\x1b[8;${this.#cols};${this.#rows}t`);
            break;
          default:
            // ignore the rest
            break;
        }
        break;

      // CSI u
      //   Restore cursor (ANSI.SYS).
      case 'u':
        if (params.prefix === '') {
          this.#restoreCursor();
        }
        break;

      /**
       * Lesser Used
       */

      // CSI Ps I
      // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
      case 'I':
        if (params.prefix === '') {
          this.#cursorForwardTab(params);
        }
        break;

      // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
      case 'S':
        if (params.prefix === '') {
          this.#scrollUp(params);
        }
        break;

      // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
      // CSI Ps ; Ps ; Ps ; Ps ; Ps T
      // CSI > Ps; Ps T
      case 'T':
        if (params.length < 2 && !params.prefix) {
          this.#scrollDown(params);
        }
        break;

      // CSI Ps Z
      // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
      case 'Z':
        if (params.prefix === '') {
          this.#cursorBackwardTab(params);
        }
        break;

      // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
      case 'b':
        if (params.prefix === '') {
          this.#repeatPrecedingCharacter(params);
        }
        break;

      // CSI Ps g  Tab Clear (TBC).
      case 'g':
        if (params.prefix === '') {
          this.#tabClear(params);
        }
        break;

      // CSI Pm i  Media Copy (MC).
      // CSI ? Pm i

      // CSI Pm m  Character Attributes (SGR).
      // CSI > Ps; Ps m

      // CSI Ps n  Device Status Report (DSR).
      // CSI > Ps n

      // CSI > Ps p  Set pointer mode.
      // CSI ! p   Soft terminal reset (DECSTR).
      // CSI Ps$ p
      //   Request ANSI mode (DECRQM).
      // CSI ? Ps$ p
      //   Request DEC private mode (DECRQM).
      // CSI Ps ; Ps " p
      case 'p':
        switch (params.prefix) {
          case '!':
            this.#softReset(params);
            break;
          default:
            break;
        }
        break;

      // CSI Ps q  Load LEDs (DECLL).
      // CSI Ps SP q
      // CSI Ps " q

      // CSI Ps ; Ps r
      //   Set Scrolling Region [top;bottom] (default = full size of win-
      //   dow) (DECSTBM).
      // CSI ? Pm r
      // CSI Pt; Pl; Pb; Pr; Ps$ r

      // CSI Ps ; Ps ; Ps t
      // CSI Pt; Pl; Pb; Pr; Ps$ t
      // CSI > Ps; Ps t
      // CSI Ps SP t

      // CSI u     Restore cursor (ANSI.SYS).
      // CSI Ps SP u

      // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v

      // CSI Pt ; Pl ; Pb ; Pr ' w

      // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
      // CSI Ps x  Select Attribute Change Extent (DECSACE).
      // CSI Pc; Pt; Pl; Pb; Pr$ x

      // CSI Ps ; Pu ' z
      // CSI Pt; Pl; Pb; Pr$ z

      // CSI Pm ' {
      // CSI Pt; Pl; Pb; Pr$ {

      // CSI Ps ' |

      // CSI P m SP }
      // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.

      // CSI P m SP ~
      // Delete P s Column(s) (default = 1) (DECDC), VT420 and up

      default:
        this.log(`Unknown CSI code: ${ch} (${"" + ch.charCodeAt(0)}).`);
        break;
    }
  }

  #processDataEscape(ch: string, i: number): number {
    switch (ch) {
      // ESC [ Control Sequence Introducer ( CSI is 0x9b).
      case '[':
        this.#params = new ControlSequenceParameters();
        this.#state = ParserState.CSI_START;
        break;

      // ESC ] Operating System Command ( OSC is 0x9d).
      case ']':
        this.#params = new ControlSequenceParameters();
        this.#state = ParserState.OSC_CODE;
        break;

      // ESC & Application mode
      case '&':
        this.#params = new ControlSequenceParameters();
        this.#state = ParserState.APPLICATION_START;
        break;

      // ESC P Device Control String ( DCS is 0x90).
      case 'P':
        this.#params = new ControlSequenceParameters();
        this.#state = ParserState.DCS_START;
        break;

      // ESC _ Application Program Command ( APC is 0x9f).
      case '_':
        this.#state = ParserState.IGNORE;
        break;

      // ESC ^ Privacy Message ( PM is 0x9e).
      case '^':
        this.#state = ParserState.IGNORE;
        break;

      // ESC c Full Reset (RIS).
      case 'c':
        this.#fullReset();
        break;

      // ESC E Next Line ( NEL is 0x85).
      case 'E':
        this.#x = 0;
        this.#index();
        break;

      // ESC D Index ( IND is 0x84).
      case 'D':
        this.#index();
        break;

      // ESC M Reverse Index ( RI is 0x8d).
      case 'M':
        this.#reverseIndex();
        break;

      // ESC % Select default/utf-8 character set.
      // @ = default, G = utf-8
      case '%':
        //this.charset = null;
        this.#setgLevel(0);
        this.#setgCharset(0, Emulator.charsets.US);
        this.#state = ParserState.NORMAL;
        i++;
        break;

      // ESC (,),*,+,-,. Designate G0-G2 Character Set.
      case '(': // <-- this seems to get all the attention
      case ')':
      case '*':
      case '+':
      case '-':
      case '.':
        switch (ch) {
          case '(':
            this.#gcharset = 0;
            break;
          case ')':
            this.#gcharset = 1;
            break;
          case '*':
            this.#gcharset = 2;
            break;
          case '+':
            this.#gcharset = 3;
            break;
          case '-':
            this.#gcharset = 1;
            break;
          case '.':
            this.#gcharset = 2;
            break;
        }
        this.#state = ParserState.CHARSET;
        break;

      // Designate G3 Character Set (VT300).
      // A = ISO Latin-1 Supplemental.
      // Not implemented.
      case '/':
        this.#gcharset = 3;
        this.#state = ParserState.CHARSET;
        i--;
        break;

      // ESC N
      // Single Shift Select of G2 Character Set
      // ( SS2 is 0x8e). This affects next character only.
      case 'N':
        break;
      // ESC O
      // Single Shift Select of G3 Character Set
      // ( SS3 is 0x8f). This affects next character only.
      case 'O':
        break;
      // ESC n
      // Invoke the G2 Character Set as GL (LS2).
      case 'n':
        this.#setgLevel(2);
        break;
      // ESC o
      // Invoke the G3 Character Set as GL (LS3).
      case 'o':
        this.#setgLevel(3);
        break;
      // ESC |
      // Invoke the G3 Character Set as GR (LS3R).
      case '|':
        this.#setgLevel(3);
        break;
      // ESC }
      // Invoke the G2 Character Set as GR (LS2R).
      case '}':
        this.#setgLevel(2);
        break;
      // ESC ~
      // Invoke the G1 Character Set as GR (LS1R).
      case '~':
        this.#setgLevel(1);
        break;

      // ESC 7 Save Cursor (DECSC).
      case '7':
        this.#saveCursor();
        this.#state = ParserState.NORMAL;
        break;

      // ESC 8 Restore Cursor (DECRC).
      case '8':
        this.#restoreCursor();
        this.#state = ParserState.NORMAL;
        break;

      // ESC # 3 DEC line height/width
      case '#':
        this.#state = ParserState.DEC_HASH;
        break;

      // ESC H Tab Set (HTS is 0x88).
      case 'H':
        this.#tabSet();
        break;

      // ESC = Application Keypad (DECPAM).
      case '=':
        this.#applicationKeypad = true;
        this.#state = ParserState.NORMAL;
        break;

      // ESC > Normal Keypad (DECPNM).
      case '>':
        this.#applicationKeypad = false;
        this.#state = ParserState.NORMAL;
        break;

      default:
        this.#state = ParserState.NORMAL;
        this.#error(`Unknown ESC control: ${ch}.`);
        break;
    }
    return i;
  }

  #processDataCharset(ch: string, i: number): number {
    let cs;
    switch (ch) {
      case '0': // DEC Special Character and Line Drawing Set.
        cs = Emulator.charsets.SCLD;
        break;
      case 'A': // UK
        cs = Emulator.charsets.UK;
        break;
      case 'B': // United States (USASCII).
        cs = Emulator.charsets.US;
        break;
      case '4': // Dutch
        cs = Emulator.charsets.Dutch;
        break;
      case 'C': // Finnish
      case '5':
        cs = Emulator.charsets.Finnish;
        break;
      case 'R': // French
        cs = Emulator.charsets.French;
        break;
      case 'Q': // FrenchCanadian
        cs = Emulator.charsets.FrenchCanadian;
        break;
      case 'K': // German
        cs = Emulator.charsets.German;
        break;
      case 'Y': // Italian
        cs = Emulator.charsets.Italian;
        break;
      case 'E': // NorwegianDanish
      case '6':
        cs = Emulator.charsets.NorwegianDanish;
        break;
      case 'Z': // Spanish
        cs = Emulator.charsets.Spanish;
        break;
      case 'H': // Swedish
      case '7':
        cs = Emulator.charsets.Swedish;
        break;
      case '=': // Swiss
        cs = Emulator.charsets.Swiss;
        break;
      case '/': // ISOLatin (actually /A)
        cs = Emulator.charsets.ISOLatin;
        i++;
        break;
      default: // Default
        cs = Emulator.charsets.US;
        break;
    }
    this.#setgCharset(this.#gcharset, cs);
    this.#gcharset = null;
    this.#state = ParserState.NORMAL;
    return i;
  }

  #processDataOSC(ch: string, i: number): number {
    // OSC Ps ; Pt ST
    // OSC Ps ; Pt BEL
    //   Set Text Parameters.
    const isTerminator = ch === '\x1b' || ch === '\x07';

    switch (this.#state) {
      case ParserState.OSC_CODE:
        if (ch >= '0' && ch <= '9') {
          this.#params.appendDigit(ch);
        } else if (ch === ';') {
          this.#params.nextParameter();
          if (this.#params[0].intValue === 1337) {
            this.#state = ParserState.OSC_ITERM_PARMS;
          } else {
            this.#state = ParserState.OSC_PARAMS;
          }
        } else {
          if (isTerminator) {
            this.#params.nextParameter();
            this.#executeOSC();
            this.#params = new ControlSequenceParameters();
          }
          this.#state = ParserState.NORMAL;
        }
        break;

      case ParserState.OSC_PARAMS:
        if (ch === ';') {
          this.#params.nextParameter();
        } else if (! isTerminator) {
          this.#params.appendString(ch);
        } else {
          this.#params.nextParameter();
          this.#executeOSC();
          this.#params = new ControlSequenceParameters();
          this.#state = ParserState.NORMAL;
        }
        break;

      case ParserState.OSC_ITERM_PARMS:
        // TODO
        break;
    }
    return i;
  }

  #executeOSC(): void {
    switch (this.#params[0].intValue) {
      case 0:
      case 1:
      case 2:
        if (this.#params[1]) {
          this.#title = this.#params[1].stringValue;
          this.#handleTitle(this.#title);
        }
        break;
      case 3: // set X property
      case 4:
      case 5: // change dynamic colors
        break;
      case 8:
        // Hyperlink
        let url = this.#params[2].rawStringValue;
        if (url === "") {
          url = null;
        }
        this.#curAttr.hyperlinkURL = url;
        break;
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
      case 15:
      case 16:
      case 17:
      case 18:
      case 19:  // change dynamic ui colors
      case 46:  // change log file
      case 50:  // dynamic font
      case 51:  // emacs shell
      case 52:  // manipulate selection data
      case 104:
      case 105:
      case 110:
      case 111:
      case 112:
      case 113:
      case 114:
      case 115:
      case 116:
      case 117:
      case 118: // reset colors
        break;
      case 133:
      case 633:
        this.#executeShellIntegration(this.#params);
        break;
    }
  }

  #executeShellIntegration(params: ControlSequenceParameters): void {
    if (params.length === 1) {
      this.log("No parameters were given to OSC 133 or OSC 633 command.");
      return;
    }

    this.#dispatchRenderEvent();  // Flush any rendering and buffers, sync everything up.
    const command = params[1].stringValue;
    switch (command) {
      case 'A':
        this.#onPromptStartEventEmitter.fire();
        break;

      case 'B':
        this.#onPromptEndEventEmitter.fire();
        break;

      case 'C':
        this.#onPreexecutionEventEmitter.fire();
        break;

      case 'D':
        this.#onEndExecutionEventEmitter.fire(params.length === 2 ? "" : params[2].stringValue);
        break;

      case 'E':
        if (params.length !== 3) {
          this.log("Wrong number of parameters were given to OSC 133 E or OSC 633 E command.");
          return;
        }
        this.#onCommandLineSetEventEmitter.fire(params[2].stringValue);
        break;

      default:
        this.log("Unknown command code given to OSC 133 or OSC 633 command.");
        break;
    }
  }

  #processDataDCS(ch: string, i: number): number {
    switch (this.#state) {
      case ParserState.DCS_START:
        this.#params.appendPrefix(ch);
        if (this.#params.prefix.length === 2) {
          this.#state = ParserState.DCS_STRING;
        }
        break;

      case ParserState.DCS_STRING:
        const isStringTerminator = ch === '\x1b' || ch === '\x07';
        if ( ! isStringTerminator) {
          this.#params.appendString(ch);
        } else {
          if (ch === '\x1b') {
            i++;
          }
          this.#params.nextParameter();
          this.#executeDCSCommand(this.#params);

          this.#params = new ControlSequenceParameters();
          this.#state = ParserState.NORMAL;
        }
        break;

      default:
        break;
    }
    return i;
  }

  #executeDCSCommand(params: ControlSequenceParameters): void {
    switch (this.#params.prefix) {
      // User-Defined Keys (DECUDK).
      case '':
        break;

      // Request Status String (DECRQSS).
      // test: echo -e '\eP$q"p\e\\'
      case '$q':
        const pt = params[0].stringValue;
        const valid = false;
        let replyPt = "";

        switch (pt) {
          // DECSCA
          case '"q':
            replyPt = '0"q';
            break;

          // DECSCL
          case '"p':
            replyPt = '61"p';
            break;

          // DECSTBM
          case 'r':
            replyPt = '' + (this.#scrollTop + 1) + ';' + (this.#scrollBottom + 1) + 'r';
            break;

          // SGR
          case 'm':
            replyPt = '0m';
            break;

          default:
            this.#error(`Unknown DCS Pt: ${""+pt}.`);
            replyPt = '';
            break;
        }

        this.#send('\x1bP' + (valid ? 1 : 0) + '$r' + replyPt + '\x1b\\');
        break;

      // Set Termcap/Terminfo Data (xterm, experimental).
      case '+p':
        break;

      // Request Termcap/Terminfo String (xterm, experimental)
      // Regular xterm does not even respond to this sequence.
      // This can cause a small glitch in vim.
      // test: echo -ne '\eP+q6b64\e\\'
      case '+q':
        // FIXME This is disabled due to the fact that it isn't completely implemented.

        // pt = this.currentParam;
        // valid = false;

        // this.send('\x1bP' + (valid ? 1 : 0) + '+r' + pt + '\x1b\\');
        break;

      default:
        this.#error(`Unknown DCS prefix: ${this.#params.prefix}.`);
        break;
    }
  }

  #processDataIgnore(ch: string, i: number): number {
    // For PM and APC.
    if (ch === '\x1b' || ch === '\x07') {
      if (ch === '\x1b') {
        i++;
      }
      this.#state = ParserState.NORMAL;
    }
    return i;
  }

  registerApplicationModeHandler(handler: ApplicationModeHandler): void {
    this.#applicationModeHandler = handler;
  }

  #processDataApplicationStart(ch: string): void {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-'
        || ch === '/') {

      // Add to the current parameter.
      this.#params.appendString(ch);  // FIXME don't absorb infinite data here.

    } else if (ch === ';') {
      // Parameter separator.
      this.#params.nextParameter();

    } else if (ch === '\x07') {
      // End of parameters.
      this.#params.nextParameter();
      if (this.#params[0].stringValue === this.#applicationModeCookie) {
        this.#state = ParserState.APPLICATION_END;
        this.#dispatchRenderEvent();
        if (this.#applicationModeHandler != null) {
          const response = this.#applicationModeHandler.start(this.#params.getStringList());
          if (response.action === ApplicationModeResponseAction.ABORT) {
            this.#state = ParserState.NORMAL;
          } else if (response.action === ApplicationModeResponseAction.PAUSE) {
            this.pauseProcessing();
          }
        }
      } else {
        this.log("Invalid application mode cookie.");
        this.#state = ParserState.NORMAL;
      }
    } else {
      // Invalid application start.
      this.#state = ParserState.NORMAL;
      this.log("Invalid application mode start command.");
    }
  }

  #processDataApplicationEnd(data: string, i: number): [string, number] {
    // Efficiently look for an end-mode character.
    const nextzero = data.indexOf('\x00', i);
    if (nextzero === -1) {
      // Send all of the data on right now.
      if (this.#applicationModeHandler != null) {
        const effectiveString = data.slice(i);
        const response = this.#applicationModeHandler.data(effectiveString);
        if (response.action === ApplicationModeResponseAction.ABORT) {
          this.#state = ParserState.NORMAL;

          if (response.remainingData != null) {
            return [response.remainingData, 0];
          }

        } else if (response.action === ApplicationModeResponseAction.PAUSE) {
          this.pauseProcessing();
          if (response.remainingData != null) {
            return [response.remainingData, 0];
          }
        }
      }
      i = data.length - 1;

    } else if (nextzero === i) {
      // We are already at the end-mode character.
      this.#dispatchRenderEvent();
      if (this.#applicationModeHandler != null) {
        const response = this.#applicationModeHandler.end();
        if (response.action === ApplicationModeResponseAction.ABORT) {
          if (response.remainingData != null) {
            this.#state = ParserState.NORMAL;
            return [response.remainingData, 0];
          }
        }
      }
      this.#state = ParserState.NORMAL;

    } else {
      // Incoming end-mode character. Send the last piece of data.
      this.#dispatchRenderEvent();
      if (this.#applicationModeHandler != null) {
        const response = this.#applicationModeHandler.data(data.slice(i, nextzero));
        if (response.action === ApplicationModeResponseAction.ABORT) {
          this.#state = ParserState.NORMAL;
        } else if (response.action === ApplicationModeResponseAction.PAUSE) {
          this.pauseProcessing();
        }
      }
      i = nextzero - 1;
    }
    return [data, i];
  }

  // ESC # variations
  #processDataDecHash(ch: string): void {
    switch(ch) {
      // ESC # 8
      // Screen Alignment Display (DECALN)
      case '8':
        this.#fillScreen('E');
        break;

      default:
        break;
    }

    this.#state = ParserState.NORMAL;
  }

  writeln(data: string): void {
    this.write(data + '\r\n');
  };

  static isKeySupported(platform: Platform, ev: MinimalKeyboardEvent): boolean {

    if (ev.shiftKey) {
      const value = this._translateKey(platform, ev, false, false);
      if (value == null) {
        return false;
      }

      const shiftFreeEv: MinimalKeyboardEvent = {
        shiftKey: false,
        altKey: ev.altKey,
        ctrlKey: ev.ctrlKey,
        key: ev.key,
        metaKey: ev.metaKey,
      };

      const newValue = this._translateKey(platform, shiftFreeEv, false, false);
      if (newValue == null) {
        return true;
      }

      // If the shifted and non-shifted version of this event give the same code, then we
      // consider then shifted version to not really be supported. It is just duplicate.
      return newValue !== value;
    }

    return this._translateKey(platform, ev, false, false) != null;
  }

  /**
   * @return true if the event and key was understood and handled.
   */
  static _translateKey(platform: Platform, ev: MinimalKeyboardEvent, applicationKeypad: boolean, applicationCursorKeys: boolean): string {
    const isMac = platform === "darwin";
    let key: string = null;

    const altKey = ev.altKey;
    const ctrlKey = ev.ctrlKey;

    // Modifiers keys are often encoded using this scheme.
    const mod = (ev.shiftKey ? 1 : 0) + (altKey ? 2 : 0) + (ctrlKey ? 4: 0) + 1;
    const modStr = mod === 1 ? "" : ";" + mod;

    switch (ev.key) {
      // backspace
      case 'Backspace':
        if (( ! isMac && altKey) || (isMac && ev.metaKey)) {  // Alt modifier handling.
          key = '\x1b\x7f'; // ^[^?
          break;
        }

        if (ctrlKey) {
          key = "\x08";
          break;
        }

        key = '\x7f'; // ^?
        break;

      // tab
      case 'Tab':
        if (ev.shiftKey) {
          key = '\x1b[Z';
        } else {
          key = '\t';
        }
        break;

      // return/enter
      case 'Enter':
        key = '\r';
        break;

      // escape
      case 'Escape':
        key = '\x1b';
        break;

      // left-arrow
      case 'ArrowLeft':
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "D";
        } else {
          if (applicationCursorKeys) {
            key = '\x1bOD';
          } else {
            key = '\x1b[D';
          }
        }
        break;

      // right-arrow
      case 'ArrowRight':
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "C";
        } else {
          if (applicationCursorKeys) {
            key = '\x1bOC';
          } else {
            key = '\x1b[C';
          }
        }
        break;

      // up-arrow
      case 'ArrowUp':
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "A";
        } else {
          if (applicationCursorKeys) {
            key = '\x1bOA';
          } else {
            key = '\x1b[A';
          }
        }
        break;

      // down-arrow
      case 'ArrowDown':
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "B";
        } else {
          if (applicationCursorKeys) {
            key = '\x1bOB';
          } else {
            key = '\x1b[B';
          }
        }
        break;

      // home
      case 'Home':
        if (applicationKeypad) {
          key = '\x1bOH';
          break;
        }
        if (mod !== 1) {
          key = '\x1b[1' + modStr + 'H';
        } else {
          key = '\x1b[H';
        }
        break;

      // end
      case 'End':
        if (applicationKeypad) {
          key = '\x1bOF';
          break;
        }
        if (mod !== 1) {
          key = '\x1b[1' + modStr + 'F';
        } else {
          key = '\x1b[F';
        }
        break;

      case 'PageUp':
      case 'PageDown':
      case 'Delete':
      case 'Insert':
      case 'F1':
      case 'F2':
      case 'F3':
      case 'F4':
      case 'F5':
      case 'F6':
      case 'F7':
      case 'F8':
      case 'F9':
      case 'F10':
      case 'F11':
      case 'F12':
        if (mod === 1) {
          switch (ev.key) {
            case 'F1': key = '\x1bOP'; break;
            case 'F2': key = '\x1bOQ'; break;
            case 'F3': key = '\x1bOR'; break;
            case 'F4': key = '\x1bOS'; break;
            default: break;
          }
          if (key !== null) {
            break;
          }
        }

        switch (ev.key) {
          case 'PageUp': key = '\x1b[5' + modStr + '~'; break;
          case 'PageDown': key = '\x1b[6' + modStr + '~'; break;
          case 'Delete': key = '\x1b[3' + modStr + '~'; break;
          case 'Insert': key = '\x1b[2' + modStr + '~'; break;
          case 'F1': key = '\x1b[1' + modStr + 'P'; break;
          case 'F2': key = '\x1b[1' + modStr + 'Q'; break;
          case 'F3': key = '\x1b[1' + modStr + 'R'; break;
          case 'F4': key = '\x1b[1' + modStr + 'S'; break;
          case 'F5': key = '\x1b[15' + modStr + '~'; break;
          case 'F6': key = '\x1b[17' + modStr + '~'; break;
          case 'F7': key = '\x1b[18' + modStr + '~'; break;
          case 'F8': key = '\x1b[19' + modStr + '~'; break;
          case 'F9': key = '\x1b[20' + modStr + '~'; break;
          case 'F10': key = '\x1b[21' + modStr + '~'; break;
          case 'F11': key = '\x1b[23' + modStr + '~'; break;
          case 'F12': key = '\x1b[24' + modStr + '~'; break;
          default: break;
        }
        break;

      default:
        // Control codes
        if (ev.key.length === 1) {
          if (ctrlKey) {
            if (ev.key >= '@' && ev.key <= '_') {
              key = String.fromCodePoint(ev.key.codePointAt(0)-'@'.codePointAt(0));
            } else if (ev.key >= 'a' && ev.key <= 'z') {
              key = String.fromCodePoint(ev.key.codePointAt(0)-'a'.codePointAt(0)+1);
            } else if (ev.key === ' ' || ev.key === '`' || ev.key === '2') {
              // Ctrl space
              key = '\x00';
            } else if (ev.key === '3') {
              key = '\x1b';
            } else if (ev.key === '|' || ev.key === '4') {
              key = '\x1c';
            } else if (ev.key === '5') {
              key = '\x1d';
            } else if (ev.key === '8') {
              key = '\xf7';
            } else if (ev.key === '?') {
              key = '\x1f';
            } else if (ev.key === "~" || ev.key === '6') {
              key = '\x1e';
            }

          } else if ((!isMac && altKey) || (isMac && ev.metaKey)) {  // Alt modifier handling.
            if (ev.key.length === 1) {
              key = '\x1b' + ev.key;
            }
          } else {
            key = ev.key;
          }
        }
        break;
    }
    return key;
  }

  keyDown(ev: MinimalKeyboardEvent): boolean {
    const key = Emulator._translateKey(this.#platform, ev, this.#applicationKeypad, this.#applicationCursorKeys);
    if (key === null) {
      return false;
    }
    this.#showCursor();
    this.handler(key);
    return true;
  }

  #setgLevel(g: number): void {
    this.#glevel = g;
    this.#charset = this.#charsets[g];
  }

  #setgCharset(g: number, charset): void {
    this.#charsets[g] = charset;
    if (this.#glevel === g) {
      this.#charset = charset;
    }
  }

  plainKeyPress(key: string): boolean {
    this.#showCursor();
    this.handler(key);
    return true;
  }

  #send(data: string): void {
    if (!this.#queue) {
      this.#setTimeout(() => {
        this.handler(this.#queue);
        this.#queue = '';
      }, 1);
    }

    this.#queue += data;
  }

  #bell(): void {
    this.#onBellEventEmitter.fire({instance: this});
  }

  newLine(): void {
    // TODO: Implement eat_newline_glitch.
    // if (this.realX >= this.cols) break;
    // this.realX = 0;
    if (this.#y+1 > this.#scrollBottom) {
      this.#scroll();
    } else {
      this.#setCursorY(this.#y+1);
    }
  }

  carriageReturn(): void {
    this.#getRow(this.#y);
    this.#x = 0;
    this.#markRowRangeForRefresh(this.#y, this.#y);
  }

  pasteText(text: string): void {
    if (text == null) {
      return;
    }

    const fixedEndingText = text.replace(/\x0a/g, "\r");
    if (this.#bracketedPaste) {
      this.#send("\x1b[200~");
      const cleanText = fixedEndingText.replace(/\x1b[[]201~/g, "");
      this.#send(cleanText);
      this.#send("\x1b[201~");
    } else {
      this.#send(fixedEndingText);
    }
  }

  log(...args: any[]): void {
    if (!this.debug) {
      return;
    }

    console.log.apply(console, ["[TERM] ", ...args]);
    console.log.apply(console, ["[TERM] "+ args]);
  }

  #error(...args: string[]): void {
    if (!this.debug) {
      return;
    }
    console.error.apply(console, args);
    console.trace();
  }

  size(): TerminalSize {
    return { rows: this.#rows, columns: this.#cols,
      cellWidthPixels: this.#cellWidthPixels, cellHeightPixels: this.#cellHeightPixels };
  }

  resize(newSize: TerminalSize): void {
    const newcols = Math.max(newSize.columns, 1);
    const newrows = Math.max(newSize.rows, 1);
    this.#cellWidthPixels = newSize.cellWidthPixels;
    this.#cellHeightPixels = newSize.cellHeightPixels;

    // resize cols
    for (let i = 0; i< this.#lines.length; i++) {
      const line = this.#lines[i];
      const newLine = new LineImpl(newcols);
      newLine.pasteLine(line, 0);

      for(let j=line.width; j<newcols; j++) {
        newLine.setCellAndLink(j, Emulator.defAttr);
      }

      this.#lines[i] = newLine;
    }

    this.#setupStops(newcols);
    this.#cols = newcols;

    // resize rows
    if (this.#rows < newrows) {

    } else if (this.#rows > newrows) {

      // Remove rows to match the new smaller rows value.
      while (this.#lines.length > newrows) {
        this.#scrollbackLineQueue.push(this.#lines.shift());
      }
    }
    this.#rows = newrows;

    // make sure the cursor stays on screen
    if (this.#y >= newrows) {
      this.#setCursorY(newrows - 1);
    }
    if (this.#x >= newcols) {
      this.#x = newcols - 1;
    }

    this.#scrollTop = 0;
    this.#scrollBottom = newrows - 1;

    // it's a real nightmare trying
    // to resize the original
    // screen buffer. just set it
    // to null for now.
    this.#normalSavedState = null;
    this.#mouseEncoder.sendCursorKeysForWheel = false;

    this.#markRowRangeForRefresh(0, this.#lines.length-1);

    this.#dispatchRenderEvent();
  }

  #dispatchRenderEvent(): void {
    let checkedRefreshEnd = Math.min(this.#refreshEnd, this.#lines.length);
    let checkedRefreshStart = this.#refreshStart;
    if (checkedRefreshEnd === REFRESH_END_NULL || checkedRefreshStart === checkedRefreshEnd) {
      // Don't signal to refresh anything. This can happen when there are no realized rows yet.
      checkedRefreshEnd = -1;
      checkedRefreshStart = -1;
    }

    const screenChangeEvent: ScreenChangeEvent = {
      instance: this,

      rows: this.#rows,
      columns: this.#cols,
      realizedRows: this.#lines.length,

      refreshStartRow: checkedRefreshStart,
      refreshEndRow: checkedRefreshEnd,
      cursorRow: this.#y,
      cursorColumn: this.#x
    };
    this.#onScreenChangeEventEmitter.fire(screenChangeEvent);

    checkedRefreshEnd = Math.min(this.#refreshEnd, this.#lines.length);
    checkedRefreshStart = this.#refreshStart;
    if (checkedRefreshEnd === REFRESH_END_NULL || checkedRefreshStart === checkedRefreshEnd) {
      // Don't signal to refresh anything. This can happen when there are no realized rows yet.
      checkedRefreshEnd = -1;
      checkedRefreshStart = -1;
    }

    const renderEvent: RenderEvent = {
      instance: this,

      rows: this.#rows,
      columns: this.#cols,
      realizedRows: this.#lines.length,

      refreshStartRow: checkedRefreshStart,
      refreshEndRow: checkedRefreshEnd,
      scrollbackLines: this.#scrollbackLineQueue,
      cursorRow: this.#y,
      cursorColumn: this.#x
    };

    this.#refreshStart = REFRESH_START_NULL;
    this.#refreshEnd = REFRESH_END_NULL;
    this.#scrollbackLineQueue = [];

    this.#onRenderEventEmitter.fire(renderEvent);
  }

  #markRowForRefresh(y: number): void {
    this.#markRowRangeForRefresh(y, y);
  }

  #markRowAsWrapped(y: number): void {
    const line = this.#getRow(y);
    line.isWrapped = true;
  }

  #setCursorY(newY: number): void {
    this.#getRow(newY);
    this.#y = newY;
    this.#markRowRangeForRefresh(newY, newY);
  }

  #markAllRowsForRefresh(): void {
    this.#markRowRangeForRefresh(0, this.#rows-1);
  }

  #setupStops(maxCols?: number): void {
    const cols = maxCols === undefined ? this.#cols : maxCols;
    this.#tabs = {};
    for (let i = 0; i < cols; i += 8) {
      this.#tabs[i] = true;
    }
  }

  #prevStop(x?: number): number {
    if (x === undefined) {
      x = this.#x;
    }
    x--;
    while (!this.#tabs[x] && x > 0) {
      x--;
    }
    return x >= this.#cols ? this.#cols - 1 : (x < 0 ? 0 : x);
  }

  #nextStop(x?: number): number {
    if (x === undefined) {
      x = this.#x;
    }
    x++;
    while (!this.#tabs[x] && x < this.#cols) {
      x++;
    }
    return x >= this.#cols ? this.#cols - 1 : (x < 0 ? 0 : x);
  }

  #eraseRight(x: number, y: number): void {
    this.#fillRight(x, y);
  }

  #fillRight(x: number, y: number, ch: string = ' '): void {
    const line = this.#tryGetRow(y);
    if (line === null) {
      return;
    }

    const chCodePoint = ch.codePointAt(0);
    for (; x < this.#cols; x++) {
      line.setCellAndLink(x, this.#curAttr);
      line.setCodePoint(x, chCodePoint);
    }

    this.#markRowForRefresh(y);
  }

  #fillScreen(fillChar: string = ' '): void {
    let j = this.#rows;
    while (j--) {
      this.#fillRight(0, j, fillChar);
    }
  }

  #eraseLeft(x: number, y: number): void {
    const line = this.#getRow(y);

    const clearCellAttrs = { ...this.#curAttr };
    clearCellAttrs.style = 0;

    x++;
    while (x !== 0) {
      x--;
      line.setCellAndLink(x, clearCellAttrs);
    }

    this.#markRowForRefresh(y);
  }

  #eraseLine(y: number): void {
    this.#eraseRight(0, y);
  }

  #blankLine(cur?: boolean): LineImpl {
    return new LineImpl(this.#cols);
  }

  handler(data: string): void {
    this.#onDataEventEmitter.fire({instance: this, data});
  }

  #handleTitle(title: string): void {
    this.#onTitleChangeEventEmitter.fire({instance: this, title});
  }

  /**
   * ESC
   */

  // ESC D Index (IND is 0x84).
  #index(): void {
    if (this.#y+1 > this.#scrollBottom) {
      this.#scroll();
    } else {
      this.#setCursorY(this.#y+1);
    }
    this.#state = ParserState.NORMAL;
  }

  // ESC M Reverse Index (RI is 0x8d).
  #reverseIndex(): void {
    if (this.#y-1 < this.#scrollTop) {
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      this.#lines.splice(this.#y, 0, this.#blankLine(true));
      const j = this.#rows - 1 - this.#scrollBottom;
      this.#lines.splice(this.#rows - 1 - j + 1, 1);

      this.#markRowForRefresh(this.#scrollTop);
      this.#markRowForRefresh(this.#scrollBottom);
    } else {
      this.#setCursorY(this.#y-1);
    }
    this.#state = ParserState.NORMAL;
  }

  reset(): void {
    this.#fullReset();
    this.#x = 0;
    this.#setCursorY(0);
    this.#dispatchRenderEvent();
  }

  // ESC c Full Reset (RIS).
  #fullReset(): void {
    this.#resetVariables();
    this.#eraseAllRows();
  }

  // ESC H Tab Set (HTS is 0x88).
  #tabSet(): void {
    this.#tabs[this.#x] = true;
    this.#state = ParserState.NORMAL;
  }

  /**
   * CSI
   */

  // CSI Ps A
  // Cursor Up Ps Times (default = 1) (CUU).
  #cursorUp(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }

    if (this.#y-param < this.#scrollTop) {
      this.#setCursorY(this.#scrollTop);
    } else {
      this.#setCursorY(this.#y - param);
    }
  }

  // CSI Ps B
  // Cursor Down Ps Times (default = 1) (CUD).
  #cursorDown(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }

    const bottom = this.#scrollBottom !== 0  ? this.#scrollBottom : this.#rows -1;
    if (this.#y+param > bottom) {
      this.#setCursorY(bottom);
    } else {
      this.#setCursorY(this.#y + param);
    }
  }

  // CSI Ps C
  // Cursor Forward Ps Times (default = 1) (CUF).
  #cursorForward(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    this.#x += param;
    if (this.#x >= this.#cols) {
      this.#x = this.#cols - 1;
    }
  }

  // CSI Ps D
  // Cursor Backward Ps Times (default = 1) (CUB).
  #cursorBackward(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    this.#x -= param;
    if (this.#x < 0) {
      this.#x = 0;
    }
  }

  // CSI Ps ; Ps H
  // Cursor Position [row;column] (default = [1,1]) (CUP).
  #cursorPos(params: ControlSequenceParameters): void {
    let y = params[0].intValue - 1 + (this.#originMode ? this.#scrollTop : 0);
    let x = (params.length >= 2) ? params[1].intValue - 1 : 0;

    if (y < 0) {
      y = 0;
    } else if (y >= this.#rows) {
      y = this.#rows - 1;
    }

    if (x < 0) {
      x = 0;
    } else if (x >= this.#cols) {
      x = this.#cols - 1;
    }

    this.#x = x;
    this.#setCursorY(y);
  }

  // CSI Ps J  Erase in Display (ED).
  //     Ps = 0  -> Erase Below (default).
  //     Ps = 1  -> Erase Above.
  //     Ps = 2  -> Erase All.
  //     Ps = 3  -> Erase Saved Lines (xterm).
  // CSI ? Ps J
  //   Erase in Display (DECSED).
  //     Ps = 0  -> Selective Erase Below (default).
  //     Ps = 1  -> Selective Erase Above.
  //     Ps = 2  -> Selective Erase All.
  #eraseInDisplay(params: ControlSequenceParameters): void {
    let j: number;
    switch (params[0].intValue) {
      case 0:
        this.#eraseRight(this.#x, this.#y);
        j = this.#y + 1;
        for (; j < this.#rows; j++) {
          this.#eraseLine(j);
        }
        break;
      case 1:
        this.#eraseLeft(this.#x, this.#y);
        j = this.#y;
        while (j--) {
          this.#eraseLine(j);
        }
        break;
      case 2:
        this.#eraseAllRows();
        break;
      case 3:
        // no saved lines
        break;
    }
  }

  #eraseAllRows(): void {
    let j = this.#rows;
    while (j--) {
      this.#getRow(j);
      this.#eraseLine(j);
    }
  }

  // CSI Ps K  Erase in Line (EL).
  //     Ps = 0  -> Erase to Right (default).
  //     Ps = 1  -> Erase to Left.
  //     Ps = 2  -> Erase All.
  // CSI ? Ps K
  //   Erase in Line (DECSEL).
  //     Ps = 0  -> Selective Erase to Right (default).
  //     Ps = 1  -> Selective Erase to Left.
  //     Ps = 2  -> Selective Erase All.
  #eraseInLine(params: ControlSequenceParameters): void {
    switch (params[0].intValue) {
      case 0:
        this.#eraseRight(this.#x, this.#y);
        break;
      case 1:
        this.#eraseLeft(this.#x, this.#y);
        break;
      case 2:
        this.#eraseLine(this.#y);
        break;
    }
  }

  // CSI Pm m  Character Attributes (SGR).
  //     Ps = 0  -> Normal (default).
  //     Ps = 1  -> Bold.
  //     Ps = 2  -> Faint, decreased intensity (ISO 6429).
  //     Ps = 3  -> Italicized (ISO 6429).
  //     Ps = 4  -> Underlined.
  //     Ps = 5  -> Blink (appears as Bold).
  //     Ps = 7  -> Inverse.
  //     Ps = 8  -> Invisible, i.e., hidden (VT300).
  //     Ps = 9  -> Crossed-out characters (ISO 6429).
  //     Ps = 2 2  -> Normal (neither bold nor faint).
  //     Ps = 2 4  -> Not underlined.
  //     Ps = 2 5  -> Steady (not blinking).
  //     Ps = 2 7  -> Positive (not inverse).
  //     Ps = 2 8  -> Visible, i.e., not hidden (VT300).
  //     Ps = 3 0  -> Set foreground color to Black.
  //     Ps = 3 1  -> Set foreground color to Red.
  //     Ps = 3 2  -> Set foreground color to Green.
  //     Ps = 3 3  -> Set foreground color to Yellow.
  //     Ps = 3 4  -> Set foreground color to Blue.
  //     Ps = 3 5  -> Set foreground color to Magenta.
  //     Ps = 3 6  -> Set foreground color to Cyan.
  //     Ps = 3 7  -> Set foreground color to White.
  //     Ps = 3 9  -> Set foreground color to default (original).
  //     Ps = 4 0  -> Set background color to Black.
  //     Ps = 4 1  -> Set background color to Red.
  //     Ps = 4 2  -> Set background color to Green.
  //     Ps = 4 3  -> Set background color to Yellow.
  //     Ps = 4 4  -> Set background color to Blue.
  //     Ps = 4 5  -> Set background color to Magenta.
  //     Ps = 4 6  -> Set background color to Cyan.
  //     Ps = 4 7  -> Set background color to White.
  //     Ps = 4 9  -> Set background color to default (original).

  //   If 16-color support is compiled, the following apply.  Assume
  //   that xterm's resources are set so that the ISO color codes are
  //   the first 8 of a set of 16.  Then the aixterm colors are the
  //   bright versions of the ISO colors:
  //     Ps = 9 0  -> Set foreground color to Black.
  //     Ps = 9 1  -> Set foreground color to Red.
  //     Ps = 9 2  -> Set foreground color to Green.
  //     Ps = 9 3  -> Set foreground color to Yellow.
  //     Ps = 9 4  -> Set foreground color to Blue.
  //     Ps = 9 5  -> Set foreground color to Magenta.
  //     Ps = 9 6  -> Set foreground color to Cyan.
  //     Ps = 9 7  -> Set foreground color to White.
  //     Ps = 1 0 0  -> Set background color to Black.
  //     Ps = 1 0 1  -> Set background color to Red.
  //     Ps = 1 0 2  -> Set background color to Green.
  //     Ps = 1 0 3  -> Set background color to Yellow.
  //     Ps = 1 0 4  -> Set background color to Blue.
  //     Ps = 1 0 5  -> Set background color to Magenta.
  //     Ps = 1 0 6  -> Set background color to Cyan.
  //     Ps = 1 0 7  -> Set background color to White.

  //   If xterm is compiled with the 16-color support disabled, it
  //   supports the following, from rxvt:
  //     Ps = 1 0 0  -> Set foreground and background color to
  //     default.

  //   If 88- or 256-color support is compiled, the following apply.
  //     Ps = 3 8  ; 5  ; Ps -> Set foreground color to the second
  //     Ps.
  //     Ps = 4 8  ; 5  ; Ps -> Set background color to the second
  //     Ps.
  #charAttributes(params: ControlSequenceParameters): void {
    // Optimize a single SGR0.
    if (params.length === 1 && params[0].intValue === 0) {
      copyCell(Emulator.defAttr, this.#curAttr);
      return;
    }

    const len = params.length;
    let fg = 0;
    let bg = 0;

    for (let i = 0; i < len; i++) {
      let p = params[i].intValue;
      if (p >= 30 && p <= 37) {
        // fg color 8
        fg = p - 30;
        this.#curAttr.fgClutIndex = fg;
        setCellFgClutFlag(this.#curAttr, true);
      } else if (p >= 40 && p <= 47) {
        // bg color 8
        bg = p - 40;
        this.#curAttr.bgClutIndex = bg;
        setCellBgClutFlag(this.#curAttr, true);
      } else if (p === 58 || p === 59) {
        // DECO. set/reset the color of character decorations.
        // Not supported here.
        break;
      } else if (p >= 90 && p <= 97) {
        // fg color 16
        p += 8;
        fg = p - 90;
        this.#curAttr.fgClutIndex = fg;
        setCellFgClutFlag(this.#curAttr, true);
      } else if (p >= 100 && p <= 107) {
        // bg color 16
        p += 8;
        bg = p - 100;
        this.#curAttr.bgClutIndex = bg;
        setCellBgClutFlag(this.#curAttr, true);
      } else if (p === 0) {
        // default
        copyCell(Emulator.defAttr, this.#curAttr);
      } else if (p === 1) {
        // bold text
        this.#curAttr.style |= STYLE_MASK_BOLD;

      } else if (p === 2) {
        // Faint, decreased intensity (ISO 6429).
        this.#curAttr.style |= STYLE_MASK_FAINT;

      } else if (p === 3) {
        // Italic
        this.#curAttr.style |= STYLE_MASK_ITALIC;

      } else if (p === 4) {
        // underlined text
        if (params[i].subparameters.length === 0) {
          this.#curAttr.style |= UNDERLINE_STYLE_NORMAL;
        } else {
          switch (params[i].subparameters[0].intValue) {
            case 0:
              // not underlined
              this.#curAttr.style &= ~STYLE_MASK_UNDERLINE;
              break;
            case 1:
              // Plain underline
              this.#curAttr.style |= UNDERLINE_STYLE_NORMAL;
              break;
            case 2:
              // Double underline
              this.#curAttr.style |= UNDERLINE_STYLE_DOUBLE;
              break;
            case 3:
              // Curly underline
              this.#curAttr.style |= UNDERLINE_STYLE_CURLY;
              break;
            default:
              break;
          }
        }

      } else if (p === 5) {
        // blink
        this.#curAttr.style |= STYLE_MASK_BLINK;

      } else if (p === 7) {
        // inverse and positive
        // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
        this.#curAttr.style |= STYLE_MASK_INVERSE;

      } else if (p === 8) {
        // invisible
        this.#curAttr.style |= STYLE_MASK_INVISIBLE;

      } else if (p === 9) {
        // Crossed-out characters (ISO 6429).
        this.#curAttr.style |= STYLE_MASK_STRIKETHROUGH;

      } else if (p >= 10 && p <= 20) {
        // Font setting. Ignore

      } else if (p === 21) {
        // Double underline
        this.#curAttr.style |= UNDERLINE_STYLE_DOUBLE;

      } else if (p === 22) {
        // not bold and not faint.
        this.#curAttr.style &= ~STYLE_MASK_BOLD;
        this.#curAttr.style &= ~STYLE_MASK_FAINT;

      } else if (p === 23) {
        // not italic
        this.#curAttr.style &= ~STYLE_MASK_ITALIC;

      } else if (p === 24) {
        // not underlined
        this.#curAttr.style &= ~STYLE_MASK_UNDERLINE;

      } else if (p === 25) {
        // not blink
        this.#curAttr.style &= ~STYLE_MASK_BLINK;

      } else if (p === 27) {
        // not inverse
        this.#curAttr.style &= ~STYLE_MASK_INVERSE;

      } else if (p === 28) {
        // not invisible
        this.#curAttr.style &= ~STYLE_MASK_INVISIBLE;

      } else if (p === 29) {
        // not strike through
        this.#curAttr.style &= ~STYLE_MASK_STRIKETHROUGH;

      } else if (p === 39) {
        // reset fg
        this.#curAttr.fgClutIndex = Emulator.defAttr.fgClutIndex;
        setCellFgClutFlag(this.#curAttr, true);

      } else if (p === 49) {
        // reset bg
        this.#curAttr.bgClutIndex = Emulator.defAttr.bgClutIndex;
        setCellBgClutFlag(this.#curAttr, true);

      } else if (p === 38) {
        // fg color 256
        if (params[i].subparameters.length === 0) {
          i = this.#setForegroundColorFromParams(params, i);
        } else {
          this.#setForegroundColorFromParams(params[i].subparameters, -1);
        }

      } else if (p === 48) {
        // bg color 256
        if (params[i].subparameters.length === 0) {
          i = this.#setBackgroundColorFromParams(params, i);
        } else {
          this.#setBackgroundColorFromParams(params[i].subparameters, -1);
        }

      } else if (p === 53) {
        // Overline style
        this.#curAttr.style |= STYLE_MASK_OVERLINE;

      } else if (p === 55) {
        // Reset overline style
        this.#curAttr.style &= ~STYLE_MASK_OVERLINE;

      } else if (p === 100) {
        // reset fg/bg
        this.#curAttr.fgClutIndex = Emulator.defAttr.fgClutIndex;
        this.#curAttr.bgClutIndex = Emulator.defAttr.bgClutIndex;
        setCellFgClutFlag(this.#curAttr, true);
        setCellBgClutFlag(this.#curAttr, true);

      } else {
        this.#error(`Unknown SGR attribute: ${"" + p}.`);
      }
    }
  }

  #setForegroundColorFromParams(params: ControlSequenceParameters, paramIndex: number): number {
    // fg color 256
    if (params.getDefaultInt(paramIndex + 1, -1) === 2) {  // Set to RGB color
      paramIndex += 2;
      const fg = ((params.getDefaultInt(paramIndex, 0) & 0xff) << 24) |
            ((params.getDefaultInt(paramIndex + 1, 0) & 0xff) << 16) |
            ((params.getDefaultInt(paramIndex + 2, 0) & 0xff) << 8) |
            0xff;
      paramIndex += 2;
      this.#curAttr.fgRGBA = fg;
      setCellFgClutFlag(this.#curAttr, false);

    } else if (params.getDefaultInt(paramIndex + 1, -1) === 5) { // Set to index color
      paramIndex += 2;
      const p = params.getDefaultInt(paramIndex, 0) & 0xff;
      this.#curAttr.fgClutIndex = p;
      setCellFgClutFlag(this.#curAttr, true);
    }
    return paramIndex;
  }

  #setBackgroundColorFromParams(params: ControlSequenceParameters, paramIndex: number): number {
    // bg color 256
    if (params.getDefaultInt(paramIndex + 1, -1) === 2) {  // Set to RGB color
      paramIndex += 2;
      const fg = ((params.getDefaultInt(paramIndex, 0) & 0xff) << 24) |
            ((params.getDefaultInt(paramIndex + 1, 0) & 0xff) << 16) |
            ((params.getDefaultInt(paramIndex + 2, 0) & 0xff) << 8) |
            0xff;
      paramIndex += 2;
      this.#curAttr.bgRGBA = fg;
      setCellBgClutFlag(this.#curAttr, false);

    } else if (params.getDefaultInt(paramIndex + 1, -1) === 5) { // Set to index color
      paramIndex += 2;
      const p = params.getDefaultInt(paramIndex, 0) & 0xff;
      this.#curAttr.bgClutIndex = p;
      setCellBgClutFlag(this.#curAttr, true);
    }
    return paramIndex;
  }

  // CSI Ps n  Device Status Report (DSR).
  //     Ps = 5  -> Status Report.  Result (``OK'') is
  //   CSI 0 n
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column].
  //   Result is
  //   CSI r ; c R
  // CSI ? Ps n
  //   Device Status Report (DSR, DEC-specific).
  //     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
  //     ? r ; c R (assumes page is zero).
  //     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
  //     or CSI ? 1 1  n  (not ready).
  //     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
  //     or CSI ? 2 1  n  (locked).
  //     Ps = 2 6  -> Report Keyboard status as
  //   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
  //   The last two parameters apply to VT400 & up, and denote key-
  //   board ready and LK01 respectively.
  //     Ps = 5 3  -> Report Locator status as
  //   CSI ? 5 3  n  Locator available, if compiled-in, or
  //   CSI ? 5 0  n  No Locator, if not.
  #deviceStatus(params: ControlSequenceParameters): void {
    if ( ! params.prefix) {
      switch (params.getDefaultInt(0, 0)) {
        case 5:
          // status report
          this.#send('\x1b[0n');
          break;
        case 6:
          // cursor position
          this.#send('\x1b[' + (this.#y + 1) + ';' + (this.#x + 1) + 'R');
          break;
      }
    } else if (params.prefix === '?') {
      // modern xterm doesnt seem to
      // respond to any of these except ?6, 6, and 5
      switch (params.getDefaultInt(0, 0)) {
        case 6:
          // cursor position
          this.#send('\x1b[?' + (this.#y + 1) + ';' + (this.#x + 1) + 'R');
          break;
        case 15:
          // no printer
          // this.send('\x1b[?11n');
          break;
        case 25:
          // dont support user defined keys
          // this.send('\x1b[?21n');
          break;
        case 26:
          // north american keyboard
          // this.send('\x1b[?27;1;0;0n');
          break;
        case 53:
          // no dec locator/mouse
          // this.send('\x1b[?50n');
          break;
      }
    }
  }

  /**
   * Additions
   */

  // CSI Ps @
  // Insert Ps (Blank) Character(s) (default = 1) (ICH).
  #insertChars(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }

    const row = this.#y;
    let j = this.#x;
    const eraseCell = this.eraseAttr();
    const line = this.#getRow(row);

    line.shiftCellsRight(j, param);

    while (param-- && j < this.#cols) {
      line.setCell(j, eraseCell);
      j++;
    }
  }

  // CSI Ps E
  // Cursor Next Line Ps Times (default = 1) (CNL).
  // same as CSI Ps B ?
  #cursorNextLine(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    if (this.#y+param >= this.#rows) {
      this.#setCursorY(this.#rows - 1);
    } else {
      this.#setCursorY(this.#y + param);
    }
    this.#x = 0;
  }

  // CSI Ps F
  // Cursor Preceding Line Ps Times (default = 1) (CNL).
  // reuse CSI Ps A ?
  #cursorPrecedingLine(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    if (this.#y-param < 0) {
      this.#setCursorY(0);
    } else {
      this.#setCursorY(this.#y - param);
    }
    this.#x = 0;
  }

  // CSI Ps G
  // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
  #cursorCharAbsolute(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    this.#x = param - 1;
  }

  // CSI Ps L
  // Insert Ps Line(s) (default = 1) (IL).
  #insertLines(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    const row = this.#y;
    const j = this.#scrollBottom + 1;
    while (param--) {
      // test: echo -e '\e[44m\e[1L\e[0m'
      // blankLine(true) - xterm/linux behavior
      this.#getRow(row);
      this.#lines.splice(row, 0, this.#blankLine(true));
      this.#lines.splice(j, 1);
    }

    this.#markRowForRefresh(this.#y);
    this.#markRowForRefresh(this.#scrollBottom);
  }

  // CSI Ps M
  // Delete Ps Line(s) (default = 1) (DL).
  #deleteLines(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    const row = this.#y;
    const j = this.#scrollBottom;

    while (param--) {
      // test: echo -e '\e[44m\e[1M\e[0m'
      // blankLine(true) - xterm/linux behavior
      this.#getRow(j + 1);
      this.#lines.splice(j + 1, 0, this.#blankLine(true));
      this.#lines.splice(row, 1);
    }

    this.#markRowForRefresh(this.#y);
    this.#markRowForRefresh(this.#scrollBottom);
  }

  // CSI Ps P
  // Delete Ps Character(s) (default = 1) (DCH).
  #deleteChars(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }

    const row = this.#y;
    const emptyCell = this.eraseAttr();
    const line = this.#lines[row];

    line.shiftCellsLeft(this.#x, param);

    while (param--) {
      line.setCell(line.width-1-param, emptyCell);
    }
  }

  // CSI Ps X
  // Erase Ps Character(s) (default = 1) (ECH).
  #eraseChars(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }

    const row = this.#y;
    let j = this.#x;
    const emptyCell = this.eraseAttr();
    const line = this.#getRow(row);
    while (param-- && j < this.#cols) {
      line.setCell(j, emptyCell);
      j++;
    }
  }

  // CSI Pm `  Character Position Absolute
  //   [column] (default = [row,1]) (HPA).
  #charPosAbsolute(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    this.#x = param - 1;
    if (this.#x >= this.#cols) {
      this.#x = this.#cols - 1;
    }
  }

  // 141 61 a * HPR -
  // Horizontal Position Relative
  // reuse CSI Ps C ?
  #HPositionRelative(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    this.#x += param;
    if (this.#x >= this.#cols) {
      this.#x = this.#cols - 1;
    }
  }

  // CSI Ps c  Send Device Attributes (Primary DA).
  //     Ps = 0  or omitted -> request attributes from terminal.  The
  //     response depends on the decTerminalID resource setting.
  //     -> CSI ? 1 ; 2 c  (``VT100 with Advanced Video Option'')
  //     -> CSI ? 1 ; 0 c  (``VT101 with No Options'')
  //     -> CSI ? 6 c  (``VT102'')
  //     -> CSI ? 6 0 ; 1 ; 2 ; 6 ; 8 ; 9 ; 1 5 ; c  (``VT220'')
  //   The VT100-style response parameters do not mean anything by
  //   themselves.  VT220 parameters do, telling the host what fea-
  //   tures the terminal supports:
  //     Ps = 1  -> 132-columns.
  //     Ps = 2  -> Printer.
  //     Ps = 6  -> Selective erase.
  //     Ps = 8  -> User-defined keys.
  //     Ps = 9  -> National replacement character sets.
  //     Ps = 1 5  -> Technical characters.
  //     Ps = 2 2  -> ANSI color, e.g., VT525.
  //     Ps = 2 9  -> ANSI text locator (i.e., DEC Locator mode).
  // CSI > Ps c
  //   Send Device Attributes (Secondary DA).
  //     Ps = 0  or omitted -> request the terminal's identification
  //     code.  The response depends on the decTerminalID resource set-
  //     ting.  It should apply only to VT220 and up, but xterm extends
  //     this to VT100.
  //     -> CSI  > Pp ; Pv ; Pc c
  //   where Pp denotes the terminal type
  //     Pp = 0  -> ``VT100''.
  //     Pp = 1  -> ``VT220''.
  //   and Pv is the firmware version (for xterm, this was originally
  //   the XFree86 patch number, starting with 95).  In a DEC termi-
  //   nal, Pc indicates the ROM cartridge registration number and is
  //   always zero.
  // More information:
  //   xterm/charproc.c - line 2012, for more information.
  //   vim responds with ^[[?0c or ^[[?1c after the terminal's response (?)
  #sendDeviceAttributes(params: ControlSequenceParameters): void {
    if (params.getDefaultInt(0, 0) > 0) {
      return;
    }

    if ( ! params.prefix) {
      // Primary Device Attributes
      this.#send('\x1b[?1;2c');
    } else if (params.prefix === '>') {
      // Secondary Device Attributes
      this.#send('\x1b[>1;1;0c'); // VT220
    }
  }

  // CSI Pm d
  // Line Position Absolute  [row] (default = [1,column]) (VPA).
  #linePosAbsolute(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    let y = param - 1 + (this.#originMode ? this.#scrollTop : 0);
    if (y >= this.#rows) {
      y = this.#rows - 1;
    }
    this.#setCursorY(y);
  }

  // 145 65 e * VPR - Vertical Position Relative
  // reuse CSI Ps B ?
  #VPositionRelative(params: ControlSequenceParameters): void {
    let param = params[0].intValue;
    if (param < 1) {
      param = 1;
    }
    if (this.#y+param >= this.#rows) {
      this.#setCursorY(this.#rows - 1);
    } else {
      this.#setCursorY(this.#y + param);
    }
  }

  // CSI Ps ; Ps f
  //   Horizontal and Vertical Position [row;column] (default =
  //   [1,1]) (HVP).
  #HVPosition(params: ControlSequenceParameters): void {
    this.#cursorPos(params);
  }

  // CSI Pm h  Set Mode (SM).
  //     Ps = 2  -> Keyboard Action Mode (AM).
  //     Ps = 4  -> Insert Mode (IRM).
  //     Ps = 1 2  -> Send/receive (SRM).
  //     Ps = 2 0  -> Automatic Newline (LNM).
  // CSI ? Pm h
  //   DEC Private Mode Set (DECSET).
  //     Ps = 1  -> Application Cursor Keys (DECCKM).
  //     Ps = 2  -> Designate USASCII for character sets G0-G3
  //     (DECANM), and set VT100 mode.
  //     Ps = 3  -> 132 Column Mode (DECCOLM).
  //     Ps = 4  -> Smooth (Slow) Scroll (DECSCLM).
  //     Ps = 5  -> Reverse Video (DECSCNM).
  //     Ps = 6  -> Origin Mode (DECOM).
  //     Ps = 7  -> Wraparound Mode (DECAWM).
  //     Ps = 8  -> Auto-repeat Keys (DECARM).
  //     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
  //     tion Mouse Tracking.
  //     Ps = 1 0  -> Show toolbar (rxvt).
  //     Ps = 1 2  -> Start Blinking Cursor (att610).
  //     Ps = 1 8  -> Print form feed (DECPFF).
  //     Ps = 1 9  -> Set print extent to full screen (DECPEX).
  //     Ps = 2 5  -> Show Cursor (DECTCEM).
  //     Ps = 3 0  -> Show scrollbar (rxvt).
  //     Ps = 3 5  -> Enable font-shifting functions (rxvt).
  //     Ps = 3 8  -> Enter Tektronix Mode (DECTEK).
  //     Ps = 4 0  -> Allow 80 -> 132 Mode.
  //     Ps = 4 1  -> more(1) fix (see curses resource).
  //     Ps = 4 2  -> Enable Nation Replacement Character sets (DECN-
  //     RCM).
  //     Ps = 4 4  -> Turn On Margin Bell.
  //     Ps = 4 5  -> Reverse-wraparound Mode.
  //     Ps = 4 6  -> Start Logging.  This is normally disabled by a
  //     compile-time option.
  //     Ps = 4 7  -> Use Alternate Screen Buffer.  (This may be dis-
  //     abled by the titeInhibit resource).
  //     Ps = 6 6  -> Application keypad (DECNKM).
  //     Ps = 6 7  -> Backarrow key sends backspace (DECBKM).
  //     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  //     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
  //     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
  //     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
  //     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
  //     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
  //     Ps = 1 0 1 0  -> Scroll to bottom on tty output (rxvt).
  //     Ps = 1 0 1 1  -> Scroll to bottom on key press (rxvt).
  //     Ps = 1 0 3 4  -> Interpret "meta" key, sets eighth bit.
  //     (enables the eightBitInput resource).
  //     Ps = 1 0 3 5  -> Enable special modifiers for Alt and Num-
  //     Lock keys.  (This enables the numLock resource).
  //     Ps = 1 0 3 6  -> Send ESC   when Meta modifies a key.  (This
  //     enables the metaSendsEscape resource).
  //     Ps = 1 0 3 7  -> Send DEL from the editing-keypad Delete
  //     key.
  //     Ps = 1 0 3 9  -> Send ESC  when Alt modifies a key.  (This
  //     enables the altSendsEscape resource).
  //     Ps = 1 0 4 0  -> Keep selection even if not highlighted.
  //     (This enables the keepSelection resource).
  //     Ps = 1 0 4 1  -> Use the CLIPBOARD selection.  (This enables
  //     the selectToClipboard resource).
  //     Ps = 1 0 4 2  -> Enable Urgency window manager hint when
  //     Control-G is received.  (This enables the bellIsUrgent
  //     resource).
  //     Ps = 1 0 4 3  -> Enable raising of the window when Control-G
  //     is received.  (enables the popOnBell resource).
  //     Ps = 1 0 4 7  -> Use Alternate Screen Buffer.  (This may be
  //     disabled by the titeInhibit resource).
  //     Ps = 1 0 4 8  -> Save cursor as in DECSC.  (This may be dis-
  //     abled by the titeInhibit resource).
  //     Ps = 1 0 4 9  -> Save cursor as in DECSC and use Alternate
  //     Screen Buffer, clearing it first.  (This may be disabled by
  //     the titeInhibit resource).  This combines the effects of the 1
  //     0 4 7  and 1 0 4 8  modes.  Use this with terminfo-based
  //     applications rather than the 4 7  mode.
  //     Ps = 1 0 5 0  -> Set terminfo/termcap function-key mode.
  //     Ps = 1 0 5 1  -> Set Sun function-key mode.
  //     Ps = 1 0 5 2  -> Set HP function-key mode.
  //     Ps = 1 0 5 3  -> Set SCO function-key mode.
  //     Ps = 1 0 6 0  -> Set legacy keyboard emulation (X11R6).
  //     Ps = 1 0 6 1  -> Set VT220 keyboard emulation.
  //     Ps = 2 0 0 4  -> Set bracketed paste mode.
  // Modes:
  //   http://vt100.net/docs/vt220-rm/chapter4.html
  #setMode(params: ControlSequenceParameters): void {
    for (let i=0; i < params.length; i++) {
      if (params.prefix === '') {
        switch (params[i].intValue) {
          case 4:
            this.#insertMode = true;
            break;
          case 20:
            //this.convertEol = true;
            break;
        }
      } else if (params.prefix === '?') {
        switch (params[i].intValue) {
          case 1:
            this.#applicationCursorKeys = true;
            break;
          case 2:
            this.#setgCharset(0, Emulator.charsets.US);
            this.#setgCharset(1, Emulator.charsets.US);
            this.#setgCharset(2, Emulator.charsets.US);
            this.#setgCharset(3, Emulator.charsets.US);
            // set VT100 mode here
            break;
          case 3: // 132 col mode
            this.#savedCols = this.#cols;
            this.resize( { rows:this.#rows, columns: 132,
              cellWidthPixels: this.#cellWidthPixels, cellHeightPixels: this.#cellHeightPixels } );
            break;
          case 6:
            this.#originMode = true;
            this.#x = 0;
            this.#setCursorY(this.#scrollTop);
            break;
          case 7:
            this.#wraparoundMode = true;
            break;
          case 12:
            // this.cursorBlink = true;
            break;
          case 66:
            this.#applicationKeypad = true;
            break;
          case 9: // X10 Mouse
            // no release, no motion, no wheel, no modifiers.
            this.#mouseEncoder.mouseProtocol = MouseProtocol.X10;
            break;
          case 1000: // vt200 mouse
            // no motion.
            // no modifiers, except control on the wheel.
            this.#mouseEncoder.mouseProtocol = MouseProtocol.VT200;
            break;
          case 1002: // button event mouse
            this.#mouseEncoder.mouseProtocol = MouseProtocol.DRAG_EVENTS;
            break;
          case 1003: // any event mouse
            // any event - sends motion events,
            // even if there is no button held down.
            this.#mouseEncoder.mouseProtocol = MouseProtocol.ANY_EVENTS;
            break;
          case 1004: // send focusin/focusout events
            // focusin: ^[[I
            // focusout: ^[[O
            this.#sendFocus = true;
            break;
          case 1005: // utf8 ext mode mouse
            this._log.warn("Escape sequence for UTF8 mouse was received, but is unsupported. (1005)");
            // for wide terminals
            // simply encodes large values as utf8 characters
            break;
          case 1006: // sgr ext mode mouse
            this.#mouseEncoder.mouseEncoding = MouseProtocolEncoding.SGR;
            // for wide terminals
            // does not add 32 to fields
            // press: ^[[<b;x;yM
            // release: ^[[<b;x;ym
            break;
          case 1015: // urxvt ext mode mouse
            this._log.warn("Escape sequence for URXVT mouse was received, but is unsupported. (1015)");
            // for wide terminals
            // numbers for fields
            // press: ^[[b;x;yM
            // motion: ^[[b;x;yT
            break;
          case 25: // show cursor
            this.#cursorHidden = false;
            break;
          case 1049: // alt screen buffer cursor
            this.#saveCursor();
            // FALL-THROUGH
          case 47: // alt screen buffer
          case 1047: // alt screen buffer
            if (this.#normalSavedState == null) {
              const normalSavedState: SavedState = {
                cols: this.#cols,
                rows: this.#rows,
                lines: this.#lines,
                x: this.#x,
                y: this.#y,
                scrollTop: this.#scrollTop,
                scrollBottom: this.#scrollBottom,
                tabs: this.#tabs,
              };

              // Preserve these variables during the reset().
              const previousCharset = this.#charset;
              const previousGlevel = this.#glevel;
              const previousCharsets = this.#charsets;

              const previousMouseEncoder = this.#mouseEncoder;
              this.#fullReset();
              this.#mouseEncoder = previousMouseEncoder;
              this.#mouseEncoder.sendCursorKeysForWheel = true;

              this.#charset = previousCharset;
              this.#glevel = previousGlevel;
              this.#charsets = previousCharsets;

              // Materialize the same number of rows as the normal lines array to ensure that
              // the new screen buffer is rendered over all of the previous screen.
              while (this.#lines.length < normalSavedState.lines.length) {
                this.#getRow(this.#lines.length);
              }

              this.#normalSavedState = normalSavedState;
              this.#markRowRangeForRefresh(0, this.#rows - 1);

              this.#showCursor();
            }
            break;

          case 2004:  // Bracketed paste
            this.#bracketedPaste = true;
            break;
        }
      }
    }
  }

  // CSI Pm l  Reset Mode (RM).
  //     Ps = 2  -> Keyboard Action Mode (AM).
  //     Ps = 4  -> Replace Mode (IRM).
  //     Ps = 1 2  -> Send/receive (SRM).
  //     Ps = 2 0  -> Normal Linefeed (LNM).
  // CSI ? Pm l
  //   DEC Private Mode Reset (DECRST).
  //     Ps = 1  -> Normal Cursor Keys (DECCKM).
  //     Ps = 2  -> Designate VT52 mode (DECANM).
  //     Ps = 3  -> 80 Column Mode (DECCOLM).
  //     Ps = 4  -> Jump (Fast) Scroll (DECSCLM).
  //     Ps = 5  -> Normal Video (DECSCNM).
  //     Ps = 6  -> Normal Cursor Mode (DECOM).
  //     Ps = 7  -> No Wraparound Mode (DECAWM).
  //     Ps = 8  -> No Auto-repeat Keys (DECARM).
  //     Ps = 9  -> Don't send Mouse X & Y on button press.
  //     Ps = 1 0  -> Hide toolbar (rxvt).
  //     Ps = 1 2  -> Stop Blinking Cursor (att610).
  //     Ps = 1 8  -> Don't print form feed (DECPFF).
  //     Ps = 1 9  -> Limit print to scrolling region (DECPEX).
  //     Ps = 2 5  -> Hide Cursor (DECTCEM).
  //     Ps = 3 0  -> Don't show scrollbar (rxvt).
  //     Ps = 3 5  -> Disable font-shifting functions (rxvt).
  //     Ps = 4 0  -> Disallow 80 -> 132 Mode.
  //     Ps = 4 1  -> No more(1) fix (see curses resource).
  //     Ps = 4 2  -> Disable Nation Replacement Character sets (DEC-
  //     NRCM).
  //     Ps = 4 4  -> Turn Off Margin Bell.
  //     Ps = 4 5  -> No Reverse-wraparound Mode.
  //     Ps = 4 6  -> Stop Logging.  (This is normally disabled by a
  //     compile-time option).
  //     Ps = 4 7  -> Use Normal Screen Buffer.
  //     Ps = 6 6  -> Numeric keypad (DECNKM).
  //     Ps = 6 7  -> Backarrow key sends delete (DECBKM).
  //     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
  //     release.  See the section Mouse Tracking.
  //     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
  //     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
  //     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
  //     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
  //     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
  //     Ps = 1 0 1 0  -> Don't scroll to bottom on tty output
  //     (rxvt).
  //     Ps = 1 0 1 1  -> Don't scroll to bottom on key press (rxvt).
  //     Ps = 1 0 3 4  -> Don't interpret "meta" key.  (This disables
  //     the eightBitInput resource).
  //     Ps = 1 0 3 5  -> Disable special modifiers for Alt and Num-
  //     Lock keys.  (This disables the numLock resource).
  //     Ps = 1 0 3 6  -> Don't send ESC  when Meta modifies a key.
  //     (This disables the metaSendsEscape resource).
  //     Ps = 1 0 3 7  -> Send VT220 Remove from the editing-keypad
  //     Delete key.
  //     Ps = 1 0 3 9  -> Don't send ESC  when Alt modifies a key.
  //     (This disables the altSendsEscape resource).
  //     Ps = 1 0 4 0  -> Do not keep selection when not highlighted.
  //     (This disables the keepSelection resource).
  //     Ps = 1 0 4 1  -> Use the PRIMARY selection.  (This disables
  //     the selectToClipboard resource).
  //     Ps = 1 0 4 2  -> Disable Urgency window manager hint when
  //     Control-G is received.  (This disables the bellIsUrgent
  //     resource).
  //     Ps = 1 0 4 3  -> Disable raising of the window when Control-
  //     G is received.  (This disables the popOnBell resource).
  //     Ps = 1 0 4 7  -> Use Normal Screen Buffer, clearing screen
  //     first if in the Alternate Screen.  (This may be disabled by
  //     the titeInhibit resource).
  //     Ps = 1 0 4 8  -> Restore cursor as in DECRC.  (This may be
  //     disabled by the titeInhibit resource).
  //     Ps = 1 0 4 9  -> Use Normal Screen Buffer and restore cursor
  //     as in DECRC.  (This may be disabled by the titeInhibit
  //     resource).  This combines the effects of the 1 0 4 7  and 1 0
  //     4 8  modes.  Use this with terminfo-based applications rather
  //     than the 4 7  mode.
  //     Ps = 1 0 5 0  -> Reset terminfo/termcap function-key mode.
  //     Ps = 1 0 5 1  -> Reset Sun function-key mode.
  //     Ps = 1 0 5 2  -> Reset HP function-key mode.
  //     Ps = 1 0 5 3  -> Reset SCO function-key mode.
  //     Ps = 1 0 6 0  -> Reset legacy keyboard emulation (X11R6).
  //     Ps = 1 0 6 1  -> Reset keyboard emulation to Sun/PC style.
  //     Ps = 2 0 0 4  -> Reset bracketed paste mode.
  #resetMode(params: ControlSequenceParameters): void {
    for (let i=0; i < params.length; i++) {

      if ( ! params.prefix) {
        switch (params[i].intValue) {
          case 4:
            this.#insertMode = false;
            break;
          case 20:
            //this.convertEol = false;
            break;
        }
      } else if (params.prefix === '?') {
        switch (params[i].intValue) {
          case 1:
            this.#applicationCursorKeys = false;
            break;

          // 80 Column Mode (DECCOLM).
          case 3:
            this.#fillScreen();
            this.#x = 0;
            this.#setCursorY(0);

            if (this.#cols === 132 && this.#savedCols) {
              this.resize( { rows: this.#rows, columns: this.#savedCols,
                cellWidthPixels: this.#cellWidthPixels, cellHeightPixels: this.#cellHeightPixels } );
            }
            break;
          case 6:
            this.#originMode = false;
            this.#x = 0;
            this.#setCursorY(0);
            break;
          case 7:
            this.#wraparoundMode = false;
            break;
          case 12:
            // this.cursorBlink = false;
            break;
          case 25: // hide cursor
            this.#cursorHidden = true;
            break;
          case 66:
            this.#applicationKeypad = false;
            break;
          case 9: // X10 Mouse
          case 1000: // vt200 mouse
          case 1002: // button event mouse
          case 1003: // any event mouse
            this.#mouseEncoder.mouseProtocol = MouseProtocol.NONE;
            break;
          case 1004: // send focusin/focusout events
            this.#sendFocus = false;
            break;
          case 1005: // utf8 ext mode mouse
            break;
          case 1006: // sgr ext mode mouse
            this.#mouseEncoder.mouseEncoding = MouseProtocolEncoding.NORMAL;
            break;
          case 1015: // urxvt ext mode mouse
            break;
          case 1049: // alt screen buffer cursor
            // FALL-THROUGH
          case 47: // normal screen buffer
          case 1047: // normal screen buffer - clearing it first
            if (this.#normalSavedState != null) {
              const currentcols = this.#cols;
              const currentrows = this.#rows;

              this.#lines = this.#normalSavedState.lines;
              this.#cols = this.#normalSavedState.cols;
              this.#rows = this.#normalSavedState.rows;
              this.#x = this.#normalSavedState.x;
              this.#setCursorY(this.#normalSavedState.y);
              this.#scrollTop = this.#normalSavedState.scrollTop;
              this.#scrollBottom = this.#normalSavedState.scrollBottom;
              this.#tabs = this.#normalSavedState.tabs;

              this.#normalSavedState = null;
              this.#mouseEncoder.sendCursorKeysForWheel = false;

              // if (params === 1049) {
              //   this.x = this.savedX;
              //   this._setCursorY(this.savedY);
              // }
              this.resize( { rows: currentrows, columns: currentcols,
                cellWidthPixels: this.#cellWidthPixels, cellHeightPixels: this.#cellHeightPixels } );
              this.#markRowRangeForRefresh(0, this.#rows - 1);
              this.#showCursor();
            }
            break;

          case 2004:  // Bracketed paste
            this.#bracketedPaste = false;
            break;
        }
      }
    }
  }

  // CSI Ps ; Ps r
  //   Set Scrolling Region [top;bottom] (default = full size of win-
  //   dow) (DECSTBM).
  // CSI ? Pm r
  #setScrollRegion(params: ControlSequenceParameters): void {
    if (params.prefix === '') {
      const top = Math.max(1, params.getDefaultInt(0, 1)) - 1;
      const bottom = Math.max(1, params.getDefaultInt(1, this.#rows)) - 1;
      if ( ! (top >= 0 && bottom < this.#rows && top < bottom)) {
        return;
      }
      this.#scrollTop = top;
      this.#scrollBottom = bottom;
      this.#x = 0;
      this.#setCursorY(this.#originMode ? this.#scrollTop : 0);
    }
  }

  // CSI s
  //   Save cursor (ANSI.SYS).
  #saveCursor(): void {
    this.#savedX = this.#x;
    this.#savedY = this.#y;
    this.#savedCharset = this.#charset;
    copyCell(this.#curAttr, this.#savedCurAttr);
  }

  // CSI u
  //   Restore cursor (ANSI.SYS).
  #restoreCursor(): void {
    this.#x = this.#savedX;
    this.#setCursorY(this.#savedY);
    this.#charset = this.#savedCharset;

    copyCell(this.#savedCurAttr, this.#curAttr);
  }

  /**
   * Lesser Used
   */

  // CSI Ps I
  //   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
  #cursorForwardTab(params: ControlSequenceParameters): void {
    let param = params[0].intValue || 1;
    while (param--) {
      this.#x = this.#nextStop();
    }
  }

  // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
  #scrollUp(params: ControlSequenceParameters): void {
    let param = params[0].intValue || 1;
    while (param--) {
      this.#lines.splice(this.#scrollTop, 1);
      this.#lines.splice(this.#scrollBottom, 0, this.#blankLine());
    }
    // this.maxRange();
    this.#markRowForRefresh(this.#scrollTop);
    this.#markRowForRefresh(this.#scrollBottom);
  }

  // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
  #scrollDown(params: ControlSequenceParameters): void {
    let param = params[0].intValue || 1;
    while (param--) {
      this.#lines.splice(this.#scrollBottom, 1);
      this.#lines.splice(this.#scrollTop, 0, this.#blankLine());
    }
    // this.maxRange();
    this.#markRowForRefresh(this.#scrollTop);
    this.#markRowForRefresh(this.#scrollBottom);
  }

  // CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
  #cursorBackwardTab(params: ControlSequenceParameters): void {
    let param = params[0].intValue || 1;
    while (param--) {
      this.#x = this.#prevStop();
    }
  }

  // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
  #repeatPrecedingCharacter(params: ControlSequenceParameters): void {
    let param = params[0].intValue || 1;
    const line = this.#getRow(this.#y);

    const cell = this.#x === 0 ? Emulator.defAttr : line.getCellAndLink(this.#x-1, 0);
    const chCodePoint = this.#x === 0 ? ' '.codePointAt(0) : line.getCodePoint(this.#x-1);

    while (param--) {
      line.setCellAndLink(this.#x, cell);
      line.setCodePoint(this.#x, chCodePoint);
      this.#x++;
    }
  }

  // CSI Ps g  Tab Clear (TBC).
  //     Ps = 0  -> Clear Current Column (default).
  //     Ps = 3  -> Clear All.
  // Potentially:
  //   Ps = 2  -> Clear Stops on Line.
  //   http://vt100.net/annarbor/aaa-ug/section6.html
  #tabClear(params: ControlSequenceParameters): void {
    const param = params.getDefaultInt(0, 0);
    if (param <= 0) {
      delete this.#tabs[this.#x];
    } else if (param === 3) {
      this.#tabs = {};
    }
  }

  // CSI ! p   Soft terminal reset (DECSTR).
  // http://vt100.net/docs/vt220-rm/table4-10.html
  #softReset(params: ControlSequenceParameters): void {
    this.#cursorHidden = false;
    this.#insertMode = false;
    this.#originMode = false;
    this.#wraparoundMode = false; // autowrap
    this.#applicationKeypad = false; // ?
    this.#applicationCursorKeys = false;
    this.#bracketedPaste = false;
    this.#scrollTop = 0;
    this.#scrollBottom = this.#rows - 1;
    copyCell(Emulator.defAttr, this.#curAttr);
    this.#x = 0;
    this.#setCursorY(0);
    this.#charset = null;
    this.#glevel = 0; // ??
    this.#charsets = [null]; // ??
  }

  // CSI ? Pm s
  //   Save DEC Private Mode Values.  Ps values are the same as for
  //   DECSET.
  #savePrivateValues(params: ControlSequenceParameters): void {
  }

  /**
   * Character Sets
   */

  static charsets = {
    // DEC Special Character and Line Drawing Set.
    // http://vt100.net/docs/vt102-ug/table5-13.html
    // A lot of curses apps use this if they see TERM=xterm.
    // testing: echo -e '\e(0a\e(B'
    // The xterm output sometimes seems to conflict with the
    // reference above. xterm seems in line with the reference
    // when running vttest however.
    // The table below now uses xterm's output from vttest.
    SCLD: { // (0
      '`': '\u25c6', // '◆'
      'a': '\u2592', // '▒'
      'b': '\u0009', // '\t'
      'c': '\u000c', // '\f'
      'd': '\u000d', // '\r'
      'e': '\u000a', // '\n'
      'f': '\u00b0', // '°'
      'g': '\u00b1', // '±'
      'h': '\u2424', // '\u2424' (NL)
      'i': '\u000b', // '\v'
      'j': '\u2518', // '┘'
      'k': '\u2510', // '┐'
      'l': '\u250c', // '┌'
      'm': '\u2514', // '└'
      'n': '\u253c', // '┼'
      'o': '\u23ba', // '⎺'
      'p': '\u23bb', // '⎻'
      'q': '\u2500', // '─'
      'r': '\u23bc', // '⎼'
      's': '\u23bd', // '⎽'
      't': '\u251c', // '├'
      'u': '\u2524', // '┤'
      'v': '\u2534', // '┴'
      'w': '\u252c', // '┬'
      'x': '\u2502', // '│'
      'y': '\u2264', // '≤'
      'z': '\u2265', // '≥'
      '{': '\u03c0', // 'π'
      '|': '\u2260', // '≠'
      '}': '\u00a3', // '£'
      '~': '\u00b7'  // '·'
    },

    "UK": null, // (A
    "US": null, // (B (USASCII)
    "Dutch": null, // (4
    "Finnish": null, // (C or (5
    "French": null, // (R
    "FrenchCanadian": null, // (Q
    "German": null, // (K
    "Italian": null, // (Y
    "NorwegianDanish": null, // (E or (6
    "Spanish": null, // (Z
    "Swedish": null, // (H or (7
    "Swiss": null, // (=
    "ISOLatin": null // /A
  };

  dumpLines(): void {
    for (let y=0; y<this.#lines.length; y++) {
      this.log(""+y+": "+this.getLineText(y));
    }
  }
}
