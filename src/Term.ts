/**
 * term.js - an xterm emulator
 * Copyright (c) 2012-2013, Christopher Jeffrey (MIT License)
 * Copyright (c) 2014-2015, Simon Edwards <simon@simonzone.com>
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
  
const DEBUG_RESIZE = false;
  
const REFRESH_START_NULL = 100000000;
const REFRESH_END_NULL = -100000000;
const MAX_BATCH_TIME = 16;  // 16 ms = 60Hz
const REFRESH_DELAY = 100;  // ms. How long to wait before doing a screen refresh during busy times.
const WHEELSCROLL_CHARS = 3;
  
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

'use strict';
function trace(): void {
    try {
      throw new Error("");
    } catch (e) {
      console.log(e);
    }
}
/**
 * Shared
 */

let idCounter = 1;


/**
 * States
 */

const STATE_NORMAL = 0;
const STATE_ESCAPE = 1;
const STATE_CSI = 2;
const STATE_OSC = 3;
const STATE_CHARSET = 4;
const STATE_DCS = 5;
const STATE_IGNORE = 6;
const STATE_APPLICATION_START = 7;
const STATE_APPLICATION_END = 8;
const STATE_DEC_HASH = 9;

const TERMINAL_ACTIVE_CLASS = "terminal-active";
const MAX_PROCESS_WRITE_SIZE = 4096;

/*************************************************************************/

/**
 * Options
 */
interface Options {
  convertEol?: boolean;
  termName?: string;
  geometry?: [number, number];
  cursorBlink?: boolean;
  visualBell?: boolean;
  popOnBell?: boolean;
  scrollback?: number;
  debug?: boolean;
  useStyle?: boolean;
  applicationModeCookie?: string;
};

interface CharSet {
  [key: string]: string;
}

interface SavedState {
  lines: Line[];
  cols: number;
  rows: number;
  ybase: number;
  ydisp: number;
  x: number;
  y: number;
  scrollTop: number;
  scrollBottom: number;
  tabs: { [i: number]: boolean;  };
}

// ------------------------------------------------------------------------
//
//        #    ######  ### 
//       # #   #     #  #  
//      #   #  #     #  #  
//     #     # ######   #  
//     ####### #        #  
//     #     # #        #  
//     #     # #       ### 
//                     
// ------------------------------------------------------------------------

export type CharAttr = number;

export interface Line {
  chars: Uint32Array;
  attrs: Uint32Array;
}

export interface TerminalCoord {
  x: number;
  y: number;
}

export interface TerminalSize {
  rows: number;
  columns: number;
}

const RENDER_EVENT = "RENDER_EVENT";
const BELL_EVENT = "BELL_EVENT";
const DATA_EVENT = "DATA_EVENT";
const TITLE_EVENT = "TITLE_EVENT";
const APPLICATIONMODESTART_EVENT = "APPLICATIONMODESTART_EVENT";
const APPLICATIONMODEDATA_EVENT = "APPLICATIONMODEDATA_EVENT";
const APPLICATIONMODEEND_EVENT = "APPLICATIONMODEEND_EVENT";
const WRITEBUFFERSIZE_EVENT = "WRITEBUFFERSIZE_EVENT";

export interface RenderEvent {
  rows: number;         // the current number of rows in the emulator screen.
  columns: number;      // the current number of columns comprising the emulator screen.
  realizedRows: number; // the current number of realised rows which have been touched.
  
  refreshStartRow: number;  // The start row of a range on the screen which needs to be refreshed.
                            // -1 indicates no refresh needed.
  refreshEndRow: number;    // The end row of a range on the screen which needds to be refreshed.
  
  scrollbackLines: Line[];  // List of lines which have reached the scrollback. Can be null.
}

export interface RenderEventHandler {
  // Range of row to render from startRow to endRow exclusive.
  (instance: Emulator, event: RenderEvent): void;
}

export interface BellEventListener {
  (instance: Emulator): void;
}

export interface DataEventListener {
  (instance: Emulator, data: string): void;
}

export interface TitleChangeEventListener {
  (instance: Emulator, title: string): void;
}

export interface ApplicationModeEventListener {
  (instance: Emulator): void;
}

export interface ApplicationModeDataEventListener {
  (instance: Emulator, data: string): void;
}

export interface WriteBufferSizeEventListener {
  (instance: Emulator, status: WriteBufferStatus): void;
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

export interface EmulatorAPI {
  
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

  startBlink(); // FIXME remove
  setCursorBlink(blink: boolean): void;
  
  // Events
  addRenderEventListener(eventHandler: RenderEventHandler): void;
  addBellEventListener(eventHandler: BellEventListener): void;
  addDataEventListener(eventHandler: DataEventListener): void;
  addTitleChangeEventListener(eventHandler: TitleChangeEventListener): void;
  
  addApplicationModeStartEventListener(eventHandler: ApplicationModeEventListener): void;
  addApplicationModeDataEventListener(eventHandler: ApplicationModeDataEventListener): void;
  addApplicationModeEndEventListener(eventHandler: ApplicationModeEventListener): void;  

  addWriteBufferSizeEventListener(eventHandler: WriteBufferSizeEventListener): void;
}

export interface TerminalDataEventListener {
  (instance: Terminal, data: string): void;
}

// ------------------------------------------------------------------------
//
//   #######                                             
//      #    ###### #####  #    # # #    #   ##   #      
//      #    #      #    # ##  ## # ##   #  #  #  #      
//      #    #####  #    # # ## # # # #  # #    # #      
//      #    #      #####  #    # # #  # # ###### #      
//      #    #      #   #  #    # # #   ## #    # #      
//      #    ###### #    # #    # # #    # #    # ###### 
//                     
// ------------------------------------------------------------------------

export class Terminal {
  
  static NO_STYLE_HACK = "NO_STYLE_HACK";
  
  static EVENT_SCROLLBACK_AVAILABLE = "scrollback-available";
  
  static EVENT_MANUAL_SCROLL = "manual-scroll";
  
  static EVENT_WHEEL = "wheel";
  
  private parent: HTMLElement = null;
  public element: HTMLElement = null;
  private context: Window = null;
  private document: Document = null;
  private body: HTMLElement = null;
  private _scrollbackBuffer: Line[] = [];  // Array of lines which have not been rendered to the browser.
  private children: HTMLDivElement[] = [];
  private emulator: EmulatorAPI = null;
  
  private _events: { [type: string]: EventListener[]; } = {};
  private _termId: number;
  private isMac = false;
  private vpad = 0;
  private charHeight = 12; // resizeToContainer() will fix this for us.
  private visualBell: boolean;
  private popOnBell: boolean;
  debug: boolean = false;

  private dataEventListeners: TerminalDataEventListener[] = [];

  constructor(options: Options) {
    // Every term gets a unique ID.
    this._termId = idCounter;
    idCounter++;

    this.emulator = new Emulator(options);
    this._scrollbackBuffer = [];  // Array of lines which have not been rendered to the browser.
    
    this.charHeight = 12; // resizeToContainer() will fix this for us.
    this.visualBell = options.visualBell === undefined ? false : options.visualBell;
    this.popOnBell = options.popOnBell === undefined ? false : options.popOnBell;
    this.debug = options.debug === undefined ? false : options.debug;
  }

  focus(): void {
    this.emulator.focus();
    this.element.focus();
  }
  
  hasFocus(): boolean {
    return this.emulator.hasFocus();
  }
  
  blur(): void {
    this.emulator.blur();
    this.element.blur();
  }
  
  /**
   * Initialize global behavior
   */
  initGlobal(): void {
    const document = this.document;
  }

  /**
   * Insert an extra style of adding extra padding to the last row in the terminal.
   * 
   * This is only relevant when physical scrolling is used. It is desirable
   * that the first row of the terminal align with the visible top of the
   * containing element. When using curses based programs like editors you don't want to 
   * see part of the scrollback cut off and just above the top row of your editor.
   */
  _initLastLinePadding(): void {
    const style = this.document.createElement('style');
    style.id = 'term-padding-style' + this._termId;

    style.innerHTML = '';

    const domRoot = getDOMRoot(this.element);
    if (domRoot.nodeName === "#document") {
      const head = this.document.getElementsByTagName('head')[0];
      if (!head) {
        return;
      }
      head.insertBefore(style, head.firstChild);
      
    } else {
      // Shadow DOM.
      domRoot.appendChild(style);
    }
  }

  /**
   * Set the size of the extra padding for the last row.
   * 
   * @param {number} padh The size of the pad in pixels
   */
  _setLastLinePadding(padh: number): void {
    const style = <HTMLStyleElement> getDOMRoot(this.element).getElementById('term-padding-style' + this._termId);
    const cssStyleSheet = <CSSStyleSheet> style.sheet;
    while (cssStyleSheet.cssRules.length !== 0) {
      cssStyleSheet.deleteRule(0);
    }
    cssStyleSheet.insertRule(`DIV.${TERMINAL_ACTIVE_CLASS}:last-child{padding-bottom:${padh}px}`, 0);
  }
 
  /**
   * Global Events for key handling
   */
  /**
   * Set up key event handlers
   */
  bindKeys(): void {
    // We should only need to check `target === body` below,
    // but we can check everything for good measure.
    this.element.addEventListener('keydown', (ev: KeyboardEvent): boolean => {
      const target = ev.target || ev.srcElement;
      if (!target) {
        return false;
      }
      if (target === this.element ||
          target === this.context ||
          target === this.document ||
          target === this.body ||
          // target === self._textarea ||
          target === this.parent) {
        return this.emulator.keyDown(ev);
      }
      return false;
    }, true);

    this.element.addEventListener('keypress', (ev: KeyboardEvent): boolean => {
      const target = ev.target || ev.srcElement;
      if (!target) {
        return false;
      }
      if (target === this.element ||
          target === this.context ||
          target === this.document ||
          target === this.body ||
          // target === self._textarea ||
          target === this.parent) {
        return this.emulator.keyPress(ev);
      }
      return false;
    }, true);
  }

  /**
   * Insert a default style
   */
  static insertStyle(document, bg, fg) {
    var style = document.getElementById('term-style');
    if (style) return;

    var head = document.getElementsByTagName('head')[0];
    if (!head) return;

    style = document.createElement('style');
    style.id = 'term-style';

    // textContent doesn't work well with IE for <style> elements.
    style.innerHTML = '' +
      '.terminal {\n' +
      '  float: left;\n' +
      '  border: ' + bg + ' solid 5px;\n' +
      '  font-family: "DejaVu Sans Mono", "Liberation Mono", monospace;\n' +
      '  font-size: 11px;\n' +
      '  color: ' + fg + ';\n' +
      '  background: ' + bg + ';\n' +
      '}\n' +
      '\n' +
      '.terminal-cursor {\n' +
      '  color: ' + bg + ';\n' +
      '  background: ' + fg + ';\n' +
      '}\n';

    head.insertBefore(style, head.firstChild);
  }
  
  /**
   * Append a DOM element to the bottom of the terminal.
   * 
   * The existing rows in the terminal pushed into the scrollback area and
   * any new term rendering occurs below the placed element.
   * 
   * @param {Element} element The DOM element to append.
   */
  // appendElement(element: HTMLElement): void {
  //   this.moveRowsToScrollback();
  //   if (this.children.length !== 0) {
  //     this.element.insertBefore(element, this.children[0]);
  //   } else {
  //     this.element.appendChild(element);
  //   }
  // }

  private _getChildDiv(y: number): HTMLDivElement {
    while (y >= this.children.length) {
        const div = this.document.createElement('div');
        div.className = TERMINAL_ACTIVE_CLASS;
        this.element.appendChild(div);
        this.children.push(div);
    }
    return this.children[y];
  }
  
  /**
   * Open Terminal
   */
  open(parent: HTMLDivElement): void {
    this.parent = parent;

    this.emulator.addDataEventListener( (instance, data) => {
      this.emitDataEvent(data);
    });

    this.emulator.addRenderEventListener(this._handleRenderLine.bind(this));
    this.emulator.addBellEventListener(this._handleBellEvent.bind(this));

    if (!this.parent) {
      throw new Error('Terminal requires a parent element.');
    }

    // Grab global elements.
    this.context = this.parent.ownerDocument.defaultView;
    this.document = this.parent.ownerDocument;
    this.body = this.document.getElementsByTagName('body')[0];

    // Parse user-agent strings.
    if (this.context.navigator && this.context.navigator.userAgent) {
      this.isMac = !!~this.context.navigator.userAgent.indexOf('Mac');
    }

    // Create our main terminal element.
    this.element = this.document.createElement('div');
    this.element.className = 'terminal';
    this.element.setAttribute('tabindex', "0");

    // Create the lines for our terminal.
    this.children = [];
    // if ( !this.physicalScroll) {
    //   for (let i=0; i < this.rows; i++) {
    //     this._getChildDiv(i);
    //   }
    // }
    this.parent.appendChild(this.element);

    // Initialize global actions that
    // need to be taken on the document.
    this.initGlobal();

    this._initLastLinePadding();

    // Ensure there is a Terminal.focus.
    this.focus();

    // Start blinking the cursor.
    this.emulator.startBlink();

    this.element.addEventListener('mousedown', this._handleMouseDown.bind(this));
    this.element.addEventListener('mousemove', this._handleMouseMove.bind(this));
    this.element.addEventListener('mouseup', this._handleMouseUp.bind(this));
    this.element.addEventListener('mouseleave', this._handleMouseLeave.bind(this));
    this.bindKeys();

    // Bind to DOM events related
    // to focus and paste behavior.
    on(this.element, 'focus', () => {
      this.focus();
    });

    on(this.element, 'blur', () => {
      this.blur();
    });

    on(this.element, 'mousedown', (ev: MouseEvent) => {
      this.focus();
    });

    // This can be useful for pasting,
    // as well as the iPad fix.
    setTimeout(() => {
      this.element.focus();
    }, 100);
  }
  
  write(data: string): void {
    this.emulator.write(data);
  }
  
  addDataEventListener(eventHandler: TerminalDataEventListener): void {
    this.dataEventListeners.push(eventHandler);
  }

  private emitDataEvent(data: string): void {
    this.dataEventListeners.forEach( (listener) => {
      listener(this, data);
    });
  }
  

  private _handleMouseDown(ev: MouseEvent): void {
    // Ctrl click prevents the mouse being taken over by
    // the application and allows the user to select stuff.
    if (ev.ctrlKey) { 
      return;
    }
    
    const pos = this.getTerminalCoordsFromEvent(ev);
    if (pos === null) {
      this.focus();
      return;
    }
    
    const button = ev.button !== undefined ? ev.button : (ev.which !== undefined ? ev.which - 1 : null);

    // send the button
    const options: MouseEventOptions = {
      leftButton: button === 0,
      middleButton: button === 1,
      rightButton: button === 2,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.y,
      column: pos.x
    };
    
    if (this.emulator.mouseDown(options)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleMouseMove(ev: MouseEvent): void {
    const pos = this.getTerminalCoordsFromEvent(ev);
    if (pos === null) {
      return;
    }
    
    const button = ev.button !== undefined ? ev.button : (ev.which !== undefined ? ev.which - 1 : null);
    
    // send the button
    const options: MouseEventOptions = {
      leftButton: button === 0,
      middleButton: button === 1,
      rightButton: button === 2,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.y,
      column: pos.x
    };
    
    if (this.emulator.mouseMove(options)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleMouseUp(ev: MouseEvent): void {
    const pos = this.getTerminalCoordsFromEvent(ev);
    if (pos === null) {
      return;
    }
    
    const button = ev.button !== undefined ? ev.button : (ev.which !== undefined ? ev.which - 1 : null);

    // send the button
    const options: MouseEventOptions = {
      leftButton: button === 0,
      middleButton: button === 1,
      rightButton: button === 2,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.y,
      column: pos.x
    };
    
    if (this.emulator.mouseUp(options)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleMouseLeave(ev: MouseEvent): void {
    if (this.emulator.mouseUp(null)) {
      ev.stopPropagation();
      ev.preventDefault();
    }    
  }

  // mouse coordinates measured in cols/rows
  getTerminalCoordsFromEvent(ev: MouseEvent): TerminalCoord {
    // Identify the row DIV that was clicked.
    let rowElement = null;
    if (getDOMRoot(this.element).nodeName === "#document") {
      let target: HTMLElement = <HTMLElement> ev.target;
      while (target !== this.element) {
        if (target.className === TERMINAL_ACTIVE_CLASS) {
          rowElement = target;
          break;
        }
        target = <HTMLElement> target.parentNode;
      }
    } else {
      // Inside a Shadow DOM.
      const matches = ev.path.filter(
        (pathEl) => (<HTMLElement> pathEl).className === TERMINAL_ACTIVE_CLASS );
      if (matches.length === 0) {
        return null;
      }
      rowElement = matches[0];
    }
    
    if (rowElement === null) {
      return null;
    }
    
    let row = this.children.indexOf(rowElement);
    
    let x = ev.pageX;
    let el = rowElement;
    while (el && el !== self.document.documentElement) {
      x -= el.offsetLeft;
      el = 'offsetParent' in el ? el.offsetParent : el.parentNode;
    }

    const emulatorSize = this.emulator.size();

    // convert to cols
    const w = rowElement.clientWidth;
    let col = Math.floor((x / w) * emulatorSize.columns);

    // be sure to avoid sending
    // bad positions to the program
    if (col < 0) {
      col = 0;
    }
    if (col > emulatorSize.columns) {
      col = emulatorSize.columns;
    }
    if (row < 0) {
      row = 0;
    }
    if (row > emulatorSize.rows) {
      row = emulatorSize.rows;
    }

    return { x: col, y: row };
  }

  /**
   * Destroy Terminal
   */
  destroy(): void {
    // if (this.physicalScroll) {
      const domRoot = getDOMRoot(this.element);
      const style = domRoot.getElementById('term-padding-style' + this._termId);
      style.parentNode.removeChild(style);
    // }
    this._events = {};
    
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  setCursorBlink(blink: boolean): void {
    this.emulator.setCursorBlink(blink);
  }

  private _handleBellEvent(instance: Emulator): void {
    this._domBell();
  }
 
  private _handleRenderLine(instance: Emulator, event: RenderEvent): void {
    while (this.children.length > event.rows) {
      const el = this.children.pop();
      el.parentNode.removeChild(el);
    }
    
    // Fill up the scroll back "TODO" (=to be rendered) buffer.
    if (event.scrollbackLines !== null && event.scrollbackLines.length !== 0) {
      event.scrollbackLines.forEach( (line) => {
        this._scrollbackBuffer.push(line);
      });
      this._emit(Terminal.EVENT_SCROLLBACK_AVAILABLE, this);
    }

    for (let row=event.refreshStartRow; row < event.refreshEndRow; row++) {
      const line = this.emulator.lineAtRow(row);
      this._getChildDiv(row).innerHTML = Terminal.lineToHTML(line);
    }
  }

  /**
   * Render a line to a HTML string.
   * 
   * @param {Array} line Array describing a line of characters and attributes.
   * @returns {string} A HTML rendering of the line as a HTML string.
   */
  static lineToHTML(line: Line): string {
    let attr = Emulator.defAttr;
    const width = line.chars.length;
    let out = '';
    
    for (let i = 0; i < width; i++) {
      const data: number = <number> line.attrs[i];
      const ch: string = <string> String.fromCodePoint(line.chars[i]);

      if (data !== attr) {
        if (attr !== Emulator.defAttr) {
          out += '</span>';
        }
        if (data !== Emulator.defAttr) {
          if (data === -1) {
            out += '<span class="reverse-video terminal-cursor">';
          } else {
            out += '<span ';

            let bg = backgroundFromCharAttr(data);
            let fg = foregroundFromCharAttr(data);
            const flags = flagsFromCharAttr(data);
            
            let clazz: string = "";
            
            // bold
            if (flags & BOLD_ATTR_FLAG) {
              clazz += ' terminal-bold';

              // See: XTerm*boldColors
              if (fg < 8) {
                fg += 8;  // Use the bright version of the color.
              }
            }

            // italic
            if (flags & ITALIC_ATTR_FLAG) {
              clazz += ' terminal-italic';
            }
            
            // underline
            if (flags & UNDERLINE_ATTR_FLAG) {
              clazz += ' terminal-underline';
            }

            // strike through
            if (flags & STRIKE_THROUGH_ATTR_FLAG) { 
              clazz += ' terminal-strikethrough';
            }
            
            // inverse
            if (flags & INVERSE_ATTR_FLAG) {
              let tmp = fg;
              fg = bg;
              bg = tmp;
              
              // Should inverse just be before the
              // above boldColors effect instead?
              if ((flags & BOLD_ATTR_FLAG) && fg < 8) {
                fg += 8;  // Use the bright version of the color.
              }
            }

            // invisible
            if (flags & INVISIBLE_ATTR_FLAG) {
              clazz += ' terminal-invisible';
            }

            if (bg !== 256) {
              clazz += ' terminal-background-' + bg;
            }

            if (flags & FAINT_ATTR_FLAG) {
              clazz += ' terminal-faint-' + fg;
            } else {
              if (fg !== 257) {
                clazz += ' terminal-foreground-' + fg;
              }
            }
            
            if (flags & BLINK_ATTR_FLAG) {
              clazz += " terminal-blink";
            }
            
            if (clazz !== "") {
              out += " class='" + clazz + "'";
            }
            
            out += '>';
          }
        }
      }

      switch (ch) {
        case '&':
          out += '&amp;';
          break;
        case '<':
          out += '&lt;';
          break;
        case '>':
          out += '&gt;';
          break;
        default:
          if (ch <= ' ') {
            out += '&nbsp;';
          } else {
            if (isWide(ch)) i++;
            out += ch;
          }
          break;
      }

      attr = data;
    }

    if (attr !== Emulator.defAttr) {
      out += '</span>';
    }
    return out;
  }

  // Physical scroll to the bottom.
  scrollToBottom() {
    var newScrollPosition = this.element.scrollHeight - this.element.clientHeight;
    this.element.scrollTop = newScrollPosition;
    this._emit(Terminal.EVENT_MANUAL_SCROLL, { position: newScrollPosition, isBottom: true });
  }

  isScrollAtBottom() {
    return this.element.scrollTop === this.element.scrollHeight - this.element.clientHeight;
  }
  
  _domBell(): void {
    if (!this.visualBell) return;
    var self = this;
    this.element.style.borderColor = 'white';
    setTimeout(function() {
      self.element.style.borderColor = '';
    }, 10);
    if (this.popOnBell) this.focus();
  }
  
  effectiveFontFamily(): string {
    const lineEl = this.children[0];    
    const cs = window.getComputedStyle(lineEl,null);
    return cs.getPropertyValue("font-family");
  }

  /**
   * Resize the terminal to fill its containing element.
   * 
   * @returns Object with the new colums (cols field) and rows (rows field) information.
   */
  resizeToContainer(): {cols: number; rows: number; vpad: number; } {
    const {columns: cols, rows: rows} = this.emulator.size();
    
    if (DEBUG_RESIZE) {
      this.log("resizeToContainer() this.effectiveFontFamily(): " + this.effectiveFontFamily());
    }
    
    if (this.effectiveFontFamily().indexOf(Terminal.NO_STYLE_HACK) !== -1) {
      // Styles have not been applied yet.
      if (DEBUG_RESIZE) {
        this.log("resizeToContainer() styles have not been applied yet.");
      }
      return {cols: cols, rows: rows, vpad: this.vpad };
    }
    
    const lineEl = this.children[0];
    const range = this.document.createRange();
    range.setStart(lineEl, 0);
    range.setEnd(lineEl, lineEl.childNodes.length);
    
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // The containing element has an invalid size.
      return {cols: cols, rows: rows, vpad: this.vpad};
    }
    
    const charWidth = rect.width / cols;    
    const charHeight = rect.height;
    this.charHeight = charHeight;
    
    const computedStyle = window.getComputedStyle(lineEl);
    const width = this.element.clientWidth - px(computedStyle.marginLeft) - px(computedStyle.marginRight);
    const newCols = Math.floor(width / charWidth);
    const newRows = Math.max(2, Math.floor(this.element.clientHeight / charHeight));
    
    if (newCols !== cols || newRows !== rows) {
      this.emulator.resize( { rows: newRows, columns: newCols } );
    }
    
    const newVpad =  Math.floor(this.element.clientHeight % charHeight);
    if (newVpad !== this.vpad) {
      this.vpad = newVpad;
      this._setLastLinePadding(this.vpad);
    }
    
    if (DEBUG_RESIZE) {
      this.log("resizeToContainer() char line rect width: ",rect.width);
      this.log("resizeToContainer() char line rect height: ",rect.height);
      this.log("resizeToContainer() char line rect height: ",rect.height);
      this.log("resizeToContainer() old cols: ",cols);
      this.log("resizeToContainer() calculated charWidth: ",charWidth);    
      this.log("resizeToContainer() calculated charHeight: ",charHeight);
      this.log("resizeToContainer() element width: ",width);
      this.log("resizeToContainer() element height: ",this.element.clientHeight);
      this.log("resizeToContainer() new cols: ",newCols);
      this.log("resizeToContainer() new rows: ",newRows);
    }
    return {cols: newCols, rows: newRows, vpad: this.vpad};
  }
  
  /**
   * Return true if there are lines waiting in the scrollback buffer.
   *
   * @return true if there are lines waiting to be rendered in the scrollback buffer.
   */
  isScrollbackAvailable(): boolean {
    return this._scrollbackBuffer.length !== 0;
  }
  
  /**
   * Fetch all of the bending scrollback lines from the buffer.
   * 
   * @return all of the scrollback lines which need to rendered.
   */
  fetchScrollbackLines(): Line[] {
    const lines = this._scrollbackBuffer;
    this._scrollbackBuffer = [];
    return lines;
  }

  private _emit(type, ...args: any[]): void {
    if (!this._events[type]) return;

    var obj = this._events[type];
    var l = obj.length;
    var i = 0;

    for (; i < l; i++) {
      obj[i].apply(this, args);
    }
  }
  
  private log(...args: any[]): void {
    if (!this.debug) {
      return;
    }
    if (!this.context.console || !this.context.console.log) {
      return;
    }
    
    this.context.console.log.apply(this.context.console, ["[TERM=",this._termId,"] ", ...args]);
    this.context.console.log.apply(this.context.console, ["[TERM="+this._termId+"] "+ args]);
  }

}

// ------------------------------------------------------------------------
//
// #######                                                 
// #       #    # #    # #        ##   #####  ####  #####  
// #       ##  ## #    # #       #  #    #   #    # #    # 
// #####   # ## # #    # #      #    #   #   #    # #    # 
// #       #    # #    # #      ######   #   #    # #####  
// #       #    # #    # #      #    #   #   #    # #   #  
// ####### #    #  ####  ###### #    #   #    ####  #    # 
//                                                         
// ------------------------------------------------------------------------

// Character rendering attributes packed inside a CharAttr.
export const BOLD_ATTR_FLAG = 1;
export const UNDERLINE_ATTR_FLAG = 2;
export const BLINK_ATTR_FLAG = 4;
export const INVERSE_ATTR_FLAG = 8;
export const INVISIBLE_ATTR_FLAG = 16;
export const ITALIC_ATTR_FLAG = 32;
export const STRIKE_THROUGH_ATTR_FLAG = 64;
export const FAINT_ATTR_FLAG = 128;

const MAX_WRITE_BUFFER_SIZE = 1024 * 100;  // 100 KB

export function flagsFromCharAttr(attr: CharAttr): number {
  return attr >> 18;
}

export function foregroundFromCharAttr(attr: CharAttr): number {
  return (attr >> 9) & 0x1ff;
}

export function backgroundFromCharAttr(attr: CharAttr): number {
  return attr & 0x1ff;
}

function packCharAttr(flags: number, fg: number, bg: number): CharAttr {
  return (flags << 18) | (fg << 9) | bg;
}

function isCharAttrCursor(attr: CharAttr): boolean {
  return attr === -1;
}

export class Emulator implements EmulatorAPI {
  private cols = 80;
  private rows = 24
  private lastReportedPhysicalHeight = 0;
  
  private state = 0; // Escape code parsing state.
  private refreshStart = REFRESH_START_NULL;
  private refreshEnd = REFRESH_END_NULL;

  private ybase = 0;  // Index of row 1 in our (logn) list of lines+scroll back.
  private ydisp = 0;  // Index of the row 1 which is displayed on the screen at the moment.
                      // (only applies when physical scrolling is not used)

  private mouseEvents = false;

  private x = 0;      // Cursor x position
  private y = 0;      // Cursor y position
  private savedX = 0;
  private savedY = 0;
  
  private oldy = 0;

  private cursorState = false;       // Cursor blink state.
  
  private cursorHidden = false;
  private _hasFocus = false;

  private queue = '';
  private scrollTop = 0;
  private scrollBottom = 23;

  // modes
  private applicationKeypad = false;
  private applicationCursor = false;
  private originMode = false;
  private insertMode = false;
  private wraparoundMode = false;
  private normal: SavedState = null;

  private entry = '';
  private entryPrefix = 'Search: ';

  // charset
  private charset: CharSet = null;
  private savedCharset: CharSet = null;
  private gcharset: number = null;
  private glevel = 0;
  private charsets: CharSet[] = [null];

  public static defAttr = packCharAttr(0, 257, 256); // Default character style
  private curAttr = 0;  // Current character style.
  private savedCurAttr = packCharAttr(0, 257, 256); // Default character style;
  
  private params = [];
  private currentParam: string | number = 0;
  private prefix = '';
  private postfix = '';
  
  private _blink = null;
    
  private lines: Line[] = [];
  
  private convertEol: boolean;
  private termName: string;
  private geometry: [number, number];
  private cursorBlink: boolean;
  private scrollback: number;
  public debug: boolean;
  private useStyle: boolean;
  private applicationModeCookie: string;
  private isMac = false;
  
  private _writeBuffers: string[] = [];  // Buffer for incoming data waiting to be processed.
  private _processWriteChunkTimer = -1;  // Timer ID for our write chunk timer.  
  private _refreshTimer = -1;  // Timer ID for triggering an on scren refresh.

  private _scrollbackLineQueue: Line[] = [];  // Queue of scrollback lines which need to sent via an event.
  private _refreshStart = -1;
  private _refreshEnd = -1;

  private tabs: { [key: number]: boolean };
  private sendFocus = false;

  private _mouseButtonDown = false;
  private utfMouse = false;
  private decLocator = false;
  private urxvtMouse = false;
  private sgrMouse = false;
  private vt300Mouse = false;
  private vt200Mouse = false;
  private normalMouse = false;
  private x10Mouse = false;
  private _pressed = 32;
  private _lastMovePos: TerminalCoord = null;
  
  private _events: { [type: string]: EventListener[]; } = {};
  private _blinker: Function = null;
  private savedCols: number;
  private title: string = "";
  
  constructor(options: Options) {
    var self = this;

    const defaults = {
      convertEol: false,
      termName: 'xterm',
      geometry: [80, 24],
      cursorBlink: false,
      visualBell: false,
      popOnBell: false,
      scrollback: 1000,
      debug: false,
      useStyle: false,
      physicalScroll: false,
      applicationModeCookie: null
    };
    
    this.convertEol = options.convertEol === undefined ? false : options.convertEol;
    this.termName = options.termName === undefined ? 'xterm' : options.termName;
    this.geometry = options.geometry === undefined ? [80, 24] : options.geometry;
    this.cursorBlink = options.cursorBlink === undefined ? false : options.cursorBlink;
    this.scrollback = options.scrollback === undefined ? 1000 : options.scrollback;
    this.debug = options.debug === undefined ? false : options.debug;
    this.useStyle = options.useStyle === undefined ? false : options.useStyle;
    this.applicationModeCookie = options.applicationModeCookie === undefined ? null : options.applicationModeCookie;


    if (window.navigator && window.navigator.userAgent) {
      this.isMac = !!~window.navigator.userAgent.indexOf('Mac');
    }

    // this.options = options;

    this.state = 0; // Escape code parsing state.
    this.refreshStart = REFRESH_START_NULL;
    this.refreshEnd = REFRESH_END_NULL;

    this._resetVariables();
    this._hasFocus = false;

    this._writeBuffers = [];  // Buffer for incoming data waiting to be processed.
    this._processWriteChunkTimer = -1;  // Timer ID for our write chunk timer.
    
    this._refreshTimer = -1;  // Timer ID for triggering an on scren refresh.
  }
  
  destroy(): void {
    if (this._processWriteChunkTimer !== -1) {
      window.clearTimeout(this._processWriteChunkTimer);
      this._processWriteChunkTimer = -1;
    }
    
    if (this._refreshTimer !== -1) {
      window.clearTimeout(this._refreshTimer);
    }
    
    this._events = {};
    this.handler = function() {};
    this.write = () => ( { bufferSize: 0 } );
  }

  private _resetVariables(): void {
    this.ybase = 0;
    this.ydisp = 0;
    this.x = 0;
    this._setCursorY(0);
    this.oldy = 0;

    this.cursorState = true;       // Cursor blink state.
    
    this.cursorHidden = false;
    this._hasFocus = false;
    
  //  this.convertEol;
    
    this.queue = '';
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;

    // modes
    this.applicationKeypad = false;
    this.applicationCursor = false;
    this.originMode = false;
    this.insertMode = false;
    this.wraparoundMode = false;
    this.normal = null;

    this.entry = '';
    this.entryPrefix = 'Search: ';

    // charset
    this.charset = null;
    this.gcharset = null;
    this.glevel = 0;
    this.charsets = [null];

    // mouse properties
  //  this.decLocator;
  //  this.x10Mouse;
  //  this.vt200Mouse;
  //  this.vt300Mouse;
  //  this.normalMouse;
  //  this.mouseEvents;
  //  this.sendFocus;
  //  this.utfMouse;
  //  this.sgrMouse;
  //  this.urxvtMouse;

    // misc
  //  this.element;
  //  this.children;
  //  this.savedX;
  //  this.savedY;
  //  this.savedCols;

    this.curAttr = Emulator.defAttr;  // Current character style.

    this.params = [];
    this.currentParam = 0;
    this.prefix = '';
    this.postfix = '';
    
    this._blink = null;

    this.lines = [];
  //  this.tabs;
    this.setupStops();
  }

  // back_color_erase feature for xterm.
  eraseAttr(): number {
    // if (this.is('screen')) return this.defAttr;
    return (Emulator.defAttr & ~0x1ff) | (this.curAttr & 0x1ff);
  }

  /**
   * Colors
   *
   * This palette is only used when matching 24bit colours to the user's CSS based colours.
   * (We assume that this default palette is close enough to the actual one being used.)
   */

  // Colors 0-15
  static xtermColors = [
    // dark:
    '#000000', // black
    '#cd0000', // red3
    '#00cd00', // green3
    '#cdcd00', // yellow3
    '#0000ee', // blue2
    '#cd00cd', // magenta3
    '#00cdcd', // cyan3
    '#e5e5e5', // gray90
    // bright:
    '#7f7f7f', // gray50
    '#ff0000', // red
    '#00ff00', // green
    '#ffff00', // yellow
    '#5c5cff', // rgb:5c/5c/ff
    '#ff00ff', // magenta
    '#00ffff', // cyan
    '#ffffff'  // white
  ];

  // Colors 0-15 + 16-255
  // Much thanks to TooTallNate for writing this.
  static colors = (function() {
    var colors = Emulator.xtermColors.slice();
    var r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
    var i;

    // 16-231
    i = 0;
    for (; i < 216; i++) {
      out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
    }

    // 232-255 (grey)
    i = 0;
    for (; i < 24; i++) {
      const v = 8 + i * 10;
      out(v, v, v);
    }

    function out(r, g, b) {
      colors.push('#' + hex(r) + hex(g) + hex(b));
    }

    function hex(c) {
      c = c.toString(16);
      return c.length < 2 ? '0' + c : c;
    }

    // Default BG/FG
    colors[256] = '#000000';
    colors[257] = '#f0f0f0';
    return colors;
  })();

  static vcolors = (function() {
    var out = [];
    var colors = Emulator.colors;
    var i = 0;
    var color;

    for (; i < 256; i++) {
      color = parseInt(colors[i].substring(1), 16);
      out.push([
        (color >> 16) & 0xff,
        (color >> 8) & 0xff,
        color & 0xff
      ]);
    }

    return out;
  })();
  
  focus(): void {
    if (this.sendFocus) {
      this.send('\x1b[I');
    }
    this._hasFocus = true;    
    this.showCursor();
    this._dispatchEvents();
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    return this._hasFocus;
  }
  
  blur(): void {
    if (!this._hasFocus) {
      return;
    }

    this.refresh(this.y, this.y);
    if (this.sendFocus) {
      this.send('\x1b[O');
    }
    this._hasFocus = false;
    this._dispatchEvents();
  }

  // XTerm mouse events
  // http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
  // To better understand these
  // the xterm code is very helpful:
  // Relevant files:
  //   button.c, charproc.c, misc.c
  // Relevant functions in xterm/button.c:
  //   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
  
  mouseDown(ev: MouseEventOptions): boolean {
    if ( ! this.mouseEvents) {
      return false;
    }

    let button = this.mouseEventOptionsToButtons(ev);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    this.sendMouseButtonSequence( {x: ev.column, y: ev.row}, button);
    
    if (this.vt200Mouse) {
      this.sendMouseButtonSequence({x: ev.column, y: ev.row}, 3); // release button
      return true;
    }
    // bind events
    if (this.normalMouse) {
      this._lastMovePos = null;
      this._mouseButtonDown = true;
    }  
    return true;
  }
  
  mouseMove(ev: MouseEventOptions): boolean {
    if ( ! this.mouseEvents) {
      return false;
    }

    if ( ! this._mouseButtonDown) {
      return false;
    }
    if (this._lastMovePos !== null && this._lastMovePos.x === ev.column && this._lastMovePos.y === ev.row) {
      return true;
    }
    
    const pos = {x: ev.column, y: ev.row};
    let button = this.mouseEventOptionsToButtons(ev);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    // buttons marked as motions
    // are incremented by 32
    button |= 32;

    this.sendMouseSequence(button, pos);
    
    this._lastMovePos = pos;
    return true;
  }

  mouseUp(ev: MouseEventOptions): boolean {
    if ( ! this.mouseEvents) {
      return false;
    }

    if ( ! this._mouseButtonDown) {
      return false;
    }
    
    if (this.x10Mouse) {
      this._mouseButtonDown = false;
      return false; // No mouse ups for x10.
    }
    
    if (ev === null) {
      this._mouseButtonDown = false;
      return true;
    }

    let button = this.mouseEventOptionsToButtons(ev, true);
    
    // no mods
    if (this.vt200Mouse) {
      button = button & ~0xc;   // ctrl only
    } else if ( ! this.normalMouse) {
      button = button & ~0x1c;  // no mods
    }
    
    this.sendMouseButtonSequence( {x: ev.column, y: ev.row}, button);
    this._mouseButtonDown = false;
    return true;
  }

  private mouseEventOptionsToButtons(ev, release=false): number {
    // two low bits:
    // 0 = left
    // 1 = middle
    // 2 = right
    // 3 = release
    // wheel up/down:
    // 1, and 2 - with 64 added
    
    let button = 0;
    if (release) {
      button = 3;
    } else if (ev.leftButton) {
      button = 0;
    } else if (ev.middleButton) {
      button = 1;
    } else if (ev.rightButton) {
      button = 2;
    }
    
    const shift = ev.shiftKey ? 4 : 0;
    const meta = ev.metaKey ? 8 : 0;
    const ctrl = ev.ctrlKey ? 16 : 0;
    const mod = shift | meta | ctrl;
    
    return (mod << 2) | button;
  }
  
  refreshScreen(): void {
    this.refresh(0, this.lines.length);
    this._dispatchEvents();
  }

  /**
   * Moves all of the rendered rows above the cursor to the physical scrollback area.
   * 
   * The rows on the terminal screen are moved into the scrollback area but
   * the new terminal rows are not rendered. Visually this does nothing as 
   * the result looks the same. If the last row contains the cursor and is
   * empty, then it is not moved.
   * 
   * Future terminal rows will appear below the old last row in the window
   * once something is printed there.
   */
  moveRowsAboveCursorToScrollback(): void {
    let lines = this.lines;
    let newLines = [];
  
    if (this.x === 0 && this.lines.length > this.y && this.getLineText(this.y).trim() === '') {
      lines = this.lines.slice(0, this.y);
      newLines = this.lines.slice(this.y);
    }

    lines.forEach( (line) => this._scrollbackLineQueue.push(line) );

    this.lines = newLines;

    this.refreshStart = REFRESH_START_NULL;
    this.refreshEnd = REFRESH_END_NULL;
    this.x = 0;
    this._setCursorY(0);
    this.oldy = 0;
    
    this._dispatchEvents();
  }

  private _getRow(row: number): Line {
    while (row >= this.lines.length) {
      this.lines.push(this.blankLine());
    }
    return this.lines[row];
  }

  // Fetch the LineCell at row 'row' if it exists, else return null.
  private _tryGetRow(row: number): Line {
    return row >= this.lines.length ? null : this.lines[row];
  }

  getDimensions(): { rows: number; cols: number; materializedRows: number; cursorX: number; cursorY: number; } {
    return {
      rows: this.rows,
      cols: this.cols,
      materializedRows: this.lines.length,
      cursorX: this.x,
      cursorY: this.y
      };  
  }

  getLineText(y: number): string {
    if (y <0 || y >= this.lines.length) {
      return null;
    }
    const row = this.lines[y];
    return String.fromCodePoint(...row.chars);
  }

  // encode button and
  // position to characters
  private encodeMouseData(buffer: number[], ch: number): void {
    if ( ! this.utfMouse) {
      if (ch === 255) {
        buffer.push(0);
        return;
      }
      if (ch > 127) {
        ch = 127;
      }
      buffer.push(ch);
    } else {
      if (ch === 2047) {
        buffer.push(0);
      }
      if (ch < 127) {
        buffer.push(ch);
      } else {
        if (ch > 2047) {
          ch = 2047;
        }
        buffer.push(0xC0 | (ch >> 6));
        buffer.push(0x80 | (ch & 0x3F));
      }
    }
  }

  // send a mouse event:
  // regular/utf8: ^[[M Cb Cx Cy
  // urxvt: ^[[ Cb ; Cx ; Cy M
  // sgr: ^[[ Cb ; Cx ; Cy M/m
  // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
  // locator: CSI P e ; P b ; P r ; P c ; P p & w
  private sendMouseSequence(button: number, pos0based: TerminalCoord): void {
    let data: string;
    const pos: TerminalCoord = { x: pos0based.x + 1, y: pos0based.y + 1 };
    
    if (this.vt300Mouse) {
      this.log("sendEvent(): vt300Mouse");
      // NOTE: Unstable.
      // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
      button &= 3;
      const x = pos.x;
      const y = pos.y;
      let data = '\x1b[24';
      if (button === 0) {
        data += '1';
      } else if (button === 1) {
        data += '3';
      } else if (button === 2) {
        data += '5';
      } else if (button === 3) {
        return;
      } else {
        data += '0';
      }
      data += '~[' + x + ',' + y + ']\r';
      this.send(data);
      return;
    }

    if (this.decLocator) {
      // NOTE: Unstable.
      this.log("sendEvent with decLocator is not implemented!");
      
      // const x = pos.x;
      // const y = pos.y;
      // const translatedButton = {0:2, 1:4, 2:6, 3:3}[button & 3];
      // self.send('\x1b[' + translatedButton + ';' + (translatedButton === 3 ? 4 : 0) + ';' + y + ';' + x + ';' +
      //   (pos.page || 0) + '&w');
      return;
    }

    if (this.urxvtMouse) {
      this.log("sendEvent(): urxvtMouse");
      const x = pos.x + 1;
      const y = pos.y + 1;
      this.send('\x1b[' + (button+32) + ';' + x + ';' + y + 'M');
      return;
    }

    if (this.sgrMouse) {
      this.log("sendEvent(): sgrMouse");
      const x = pos.x;
      const y = pos.y;
      this.send('\x1b[<' + ((button & 3) === 3 ? button & ~3 : button) + ';' + x +
        ';' + y + ((button & 3) === 3 ? 'm' : 'M'));
      return;
    }
    this.log("sendEvent(): default");

    const encodedData = [];
    this.encodeMouseData(encodedData, button+32);
    
    // xterm sends raw bytes and
    // starts at 32 (SP) for each.    
    this.encodeMouseData(encodedData, pos.x + 32);
    this.encodeMouseData(encodedData, pos.y + 32);

    this.send('\x1b[M' + String.fromCharCode.apply(String, encodedData));
  }

  
  // mouseup, mousedown, mousewheel
  // left click: ^[[M 3<^[[M#3<
  // mousewheel up: ^[[M`3>
  private sendMouseButtonSequence(pos: TerminalCoord, button: number): void {
    this.sendMouseSequence(button, pos);
    this._pressed = (button === 3) ? 32 : button;  
  }


  /**
   * Rendering Engine
   */

  /**
   * Schedule a screen refresh and update.
   * 
   * @param {boolean} immediate True if the refresh should occur as soon as possible. False if a slight delay is permitted.
   */
  private _scheduleRefresh(immediate: boolean): void {
    if (this._refreshTimer === -1) {
      this._refreshTimer = window.setTimeout(() => {
        this._refreshTimer = -1;
        this._refreshFrame();
      }, immediate ? 0 : REFRESH_DELAY);
    }
  }

  /**
   * Refresh and update the screen.
   * 
   * Usually call via a timer.
   */
  private _refreshFrame(): void {
    this.refresh(this.refreshStart, this.refreshEnd);
    this._dispatchEvents();
    this.refreshStart = REFRESH_START_NULL;
    this.refreshEnd = REFRESH_END_NULL;
  }

  // In the screen buffer, each character
  // is stored as a an array with a character
  // and a 32-bit integer.
  // First value: a utf-16 character.
  // Second value:
  // Next 9 bits: background color (0-511).
  // Next 9 bits: foreground color (0-511).
  // Next 14 bits: a mask for misc. flags:
  //   1=bold, 2=underline, 4=blink, 8=inverse, 16=invisible

  /**
   * Marks a range of rows to be refreshed on the screen.
   * 
   * @param {number} start start row to refresh
   * @param {number} end   end row (INCLUSIVE!) to refresh
   */
  private refresh(start: number, end: number): void {
    this._refreshStart = this._refreshStart < 0 ? start : Math.min(start, this._refreshStart);
    this._refreshEnd = this._refreshEnd < 0 ? end+1 : Math.max(end+1, this._refreshEnd);
  }
  
  lineAtRow(row: number): Line {
    if (row < 0 || row >= this.rows) {
      return null;
    }
    
    let line = this._getRow(row + this.ydisp);

    // Place the cursor in the row.
    if (row === this.y &&
        this.cursorState &&
        (this.ydisp === this.ybase) &&
        !this.cursorHidden &&
        this.x < this.cols) {

      const x = this.x;

      const newLine = {chars: new Uint32Array(line.chars), attrs: new Uint32Array(line.attrs)};
      newLine.attrs[x] = 0xffffffff;
      return newLine;
    }
    return line;
  }
  
  /**
   * Get a shallow copy of the lines currently being shown on the terminal screen.
   * 
   * @return {Line[]} the lines information. Do not change this data!
   */
  getScreenLines(renderCursor:boolean=false): Line[] {
    const linesCopy = [...this.lines];
    
    if (renderCursor) {
      if (this.cursorState &&
          (this.ydisp === this.ybase) &&
          !this.cursorHidden &&
          this.x < this.cols &&
          this.y < linesCopy.length) {

        const cursorLine = {chars: new Uint32Array(linesCopy[this.y].chars), attrs: new Uint32Array(linesCopy[this.y].attrs)};
        cursorLine.attrs[this.x] = -1;
        linesCopy[this.y] = cursorLine;
      }
    }
    return linesCopy;
  }
  
  private _cursorBlink(): void {
    if ( ! this._hasFocus) {
      return;
    }
    this.cursorState = !this.cursorState;
    this.refresh(this.y, this.y);
  }

  showCursor(): void {
    if (!this.cursorState) {
      this.cursorState = true;
      this._getRow(this.y);
      this.refresh(this.y, this.y);
    } else {
      // Temporarily disabled:
      this.refreshBlink();
    }
  }

  /**
   * Set cursor blinking on or off.
   * 
   * @param {boolean} blink True if the cursor should blink.
   */
  setCursorBlink(blink: boolean): void {
    if (this._blink !== null) {
      clearInterval(this._blink);
      this._blink = null;
    }
    this.cursorBlink = blink;
    
    this.showCursor();
    this.startBlink();
  }

  startBlink(): void {
    if (!this.cursorBlink) return;
    var self = this;
    this._blinker = function() {
      self._cursorBlink();
    };
    this._blink = setInterval(this._blinker, 500);
  }

  private refreshBlink(): void {
    if (!this.cursorBlink) return;
    clearInterval(this._blink);
    this._blink = setInterval(this._blinker, 500);
  }

  private scroll(): void {
    // Drop the oldest line into the scrollback buffer.
    if (this.scrollTop === 0) {
      this._scrollbackLineQueue.push(this.lines[0]);        
    }

    this.ydisp = this.ybase;

    // last line
    const lastline = this.ybase + this.rows - 1;

    // subtract the bottom scroll region
    const insertRow = lastline - this.rows + 1 + this.scrollBottom;

    if (this.scrollTop !== 0) {
      if (this.ybase !== 0) {
        this.ybase--;
        this.ydisp = this.ybase;
      }
    }
    this.lines.splice(this.ybase + this.scrollTop, 1);
    
    // add our new line
    this.lines.splice(insertRow, 0, this.blankLine());

    this.updateRange(this.scrollTop);
    this.updateRange(this.scrollBottom);
  }

  private scrollDisp(disp) {
    this.ydisp += disp;

    if (this.ydisp > this.ybase) {
      this.ydisp = this.ybase;
    } else if (this.ydisp < 0) {
      this.ydisp = 0;
    }

    this.refresh(0, this.rows - 1);
  }

  write(data: string): WriteBufferStatus {
    this._writeBuffers.push(data);
    this._scheduleProcessWriteChunk();
    return this._writeBufferStatus();
  }

  private _writeBufferStatus(): WriteBufferStatus {
    const size = this._writeBuffers.map( (buf) => buf.length ).reduce( (accu, x) => accu + x, 0);
    return { bufferSize: MAX_WRITE_BUFFER_SIZE - size };
  }

  private _emitWriteBufferSizeEvent(): void {
    this._emit(WRITEBUFFERSIZE_EVENT, this, this._writeBufferStatus());
  }

  /**
   * Schedule the write chunk process to run the next time the event loop is entered.
   */
  private _scheduleProcessWriteChunk(): void {
    if (this._processWriteChunkTimer === -1) {
      this._processWriteChunkTimer = window.setTimeout(() => {
        this._processWriteChunkTimer = -1;
        this._processWriteChunkRealTime();
      }, 0);
    }
  }

  /**
   * Process the next chunk of data to written into a the line array.
   */
  private _processWriteChunkRealTime(): void {
    const starttime = window.performance.now();
  //console.log("++++++++ _processWriteChunk() start time: " + starttime);
    
    // Schedule a call back just in case. setTimeout(.., 0) still carries a ~4ms delay. 
    this._scheduleProcessWriteChunk();

    while (true) {
      if (this._processOneWriteChunk() === false) {
        window.clearTimeout(this._processWriteChunkTimer);
        this._processWriteChunkTimer = -1;
        
        this._scheduleRefresh(true);
        this._emitWriteBufferSizeEvent();
        break;
      }
      
      const nowtime = window.performance.now();
      if ((nowtime - starttime) > MAX_BATCH_TIME) {
        this._scheduleRefresh(false);
        this._emitWriteBufferSizeEvent();
        break;
      }
    }
  //  console.log("---------- _processWriteChunk() end time: " + window.performance.now());
  }

  /**
   * Process one chunk of written data.
   * 
   * @returns {boolean} True if there are extra chunks available which need processing.
   */
  private _processOneWriteChunk(): boolean {
    if (this._writeBuffers.length === 0) {
      return false; // Nothing to do.
    }
    
    let chunk = this._writeBuffers[0];
    if (chunk.length <= MAX_PROCESS_WRITE_SIZE) {
      this._writeBuffers.splice(0, 1);
    } else {
      this._writeBuffers[0] = chunk.slice(MAX_PROCESS_WRITE_SIZE);
      chunk = chunk.slice(0, MAX_PROCESS_WRITE_SIZE);
    }

    this._processWriteData(chunk);
    return this._writeBuffers.length !== 0;
  }

  private _flushWriteBuffer(): void {
    while(this._processOneWriteChunk()) {
      // Keep on going until it is all done.
    }
    this._emitWriteBufferSizeEvent();
  }

  /**
   * Process a block of characters and control sequences and render them to the screen.
   *
   * @param data the string of characters and control sequences to process.
   */
  private _processWriteData(data: string): void {
  //console.log("write() data.length: " + data.length);
  //var starttime = window.performance.now();
  //var endtime;
  //console.log("write() start time: " + starttime);

    if (this.ybase !== this.ydisp) {
      this.ydisp = this.ybase;
      this.maxRange();
    }
    
    this.oldy = this.y;
    
    const len = data.length;
    for (let i=0; i < len; i++) {
      let ch = data[i];

      let codePoint = 0;

      // Unicode UTF-16 surrogate handling.
      if ((ch.charCodeAt(0) & 0xFC00) === 0xD800) { // High surrogate.
        const highSurrogate = ch.charCodeAt(0);
        i++;
        if (i < len) {
          const lowSurrogate = data[i].charCodeAt(0);
          codePoint = ((highSurrogate & 0x03FF) << 10) | (lowSurrogate & 0x03FF) + 0x10000;
        }
        ch = ' '; // fake it just enough to hit the right code below.
      } else {
        codePoint = ch.codePointAt(0);
      }

      switch (this.state) {
        case STATE_NORMAL:
          switch (ch) {
            // '\0'
            // case '\0':
            // case '\200':l
            //   break;

            // '\a'
            case '\x07':
              this.bell();
              break;

            // '\n', '\v', '\f'
            case '\n':
            case '\x0b':
            case '\x0c':
              if (this.convertEol) {
                this.x = 0;
              }
              // TODO: Implement eat_newline_glitch.
              // if (this.realX >= this.cols) break;
              // this.realX = 0;
              if (this.y+1 > this.scrollBottom) {
                this.scroll();
              } else {
                this._setCursorY(this.y+1);
              }
              break;

            // '\r'
            case '\r':
              this.x = 0;
              break;

            // '\b'
            case '\x08':
              if (this.x > 0) {
                this.x--;
              }
              break;

            // '\t'
            case '\t':
              this.x = this.nextStop();
              break;

            // shift out
            case '\x0e':
              this.setgLevel(1);
              break;

            // shift in
            case '\x0f':
              this.setgLevel(0);
              break;

            // '\e'
            case '\x1b':
              this.state = STATE_ESCAPE;
              break;

            default:
              // ' '
              if (ch >= ' ') {
                if (this.charset && this.charset[ch]) {
                  ch = this.charset[ch];
                  codePoint = ch.codePointAt(0);
                }

                if (this.x >= this.cols) {
                  this.x = 0;
                  this.updateRange(this.y);                  
                  if (this.y+1 > this.scrollBottom) {
                    this.scroll();
                  } else {
                    this._setCursorY(this.y+1);
                  }
                }

                const {chars, attrs} = this._getRow(this.y + this.ybase);
                if (this.insertMode) {
                  // Push the characters out of the way to make space.

                  chars.copyWithin(this.x+1, this.x);
                  chars[this.x] = ' '.codePointAt(0);

                  attrs.copyWithin(this.x+1, this.x);
                  attrs[this.x] = this.curAttr;
                  

                  if (isWide(ch)) {
                    chars.copyWithin(this.x+1, this.x);
                    chars[this.x] = ' '.codePointAt(0);

                    attrs.copyWithin(this.x+1, this.x);
                    attrs[this.x] = this.curAttr;
                  }
                }

                chars[this.x] = codePoint;
                attrs[this.x] = this.curAttr;

                this.x++;
                this.updateRange(this.y);

                if (isWide(ch)) {
                  const j = this.y + this.ybase;
                  const line = this._getRow(j);
                  if (this.cols < 2 || this.x >= this.cols) {
                    line.chars[this.x - 1] = ' '.codePointAt(0);
                    line.attrs[this.x - 1] = this.curAttr;
                    break;
                  }
                  line.chars[this.x] =  ' '.codePointAt(0);
                  line.attrs[this.x] = this.curAttr;
                  this.x++;
                }
              }
              break;
          }
          break;

        case STATE_ESCAPE:
          i = this._processDataEscape(ch, i);
          break;

        case STATE_CHARSET:
          i = this._processDataCharset(ch, i);
          break;

        case STATE_OSC:
          i = this._processDataOSC(ch, i);
          break;

        case STATE_CSI:
          i = this._processDataCSI(ch, i);
          break;

        case STATE_DCS:
          i = this._processDataDCS(ch, i);
          break;

        case STATE_IGNORE:
          i = this._processDataIgnore(ch, i);
          break;
          
        case STATE_APPLICATION_START:
          this._processDataApplicationStart(ch);
          break;

        case STATE_APPLICATION_END:
          i = this._processDataApplicationEnd(ch, data, i);          
          break;
          
        case STATE_DEC_HASH:
          this._processDataDecHash(ch);
          break;
      }
      
      if (this.y !== this.oldy) {
        this.updateRange(this.oldy);
        this.updateRange(this.y);
        this.oldy = this.y;
      }
    }
    this.updateRange(this.y);
      
  //  endtime = window.performance.now();
  //console.log("write() end time: " + endtime);
  //  console.log("duration: " + (endtime - starttime) + "ms");
  }
        
  private _processDataCSI(ch: string, i: number): number {
    // '?', '>', '!'
    if (ch === '?' || ch === '>' || ch === '!') {
      this.prefix = ch;
      return i;
    }

    // 0 - 9
    if (ch >= '0' && ch <= '9') {
      this.currentParam = (<number> this.currentParam) * 10 + ch.charCodeAt(0) - 48;
      return i;
    }

    // '$', '"', ' ', '\''
    if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
      this.postfix = ch;
      return i;
    }

    this.params.push(this.currentParam);
    this.currentParam = 0;

    // ';'
    if (ch === ';') {
      return i;
    }

    this.state = STATE_NORMAL;

    switch (ch) {
      // CSI Ps A
      // Cursor Up Ps Times (default = 1) (CUU).
      case 'A':
        this.cursorUp(this.params);
        break;

      // CSI Ps B
      // Cursor Down Ps Times (default = 1) (CUD).
      case 'B':
        this.cursorDown(this.params);
        break;

      // CSI Ps C
      // Cursor Forward Ps Times (default = 1) (CUF).
      case 'C':
        this.cursorForward(this.params);
        break;

      // CSI Ps D
      // Cursor Backward Ps Times (default = 1) (CUB).
      case 'D':
        this.cursorBackward(this.params);
        break;

      // CSI Ps ; Ps H
      // Cursor Position [row;column] (default = [1,1]) (CUP).
      case 'H':
        this.cursorPos(this.params);
        break;

      // CSI Ps J  Erase in Display (ED).
      case 'J':
        this.eraseInDisplay(this.params);
        break;

      // CSI Ps K  Erase in Line (EL).
      case 'K':
        this.eraseInLine(this.params);
        break;

      // CSI Pm m  Character Attributes (SGR).
      case 'm':
        if (!this.prefix) {
          this.charAttributes(this.params);
        }
        break;

      // CSI Ps n  Device Status Report (DSR).
      case 'n':
        if (!this.prefix) {
          this.deviceStatus(this.params);
        }
        break;

      /**
       * Additions
       */

      // CSI Ps @
      // Insert Ps (Blank) Character(s) (default = 1) (ICH).
      case '@':
        this.insertChars(this.params);
        break;

      // CSI Ps E
      // Cursor Next Line Ps Times (default = 1) (CNL).
      case 'E':
        this.cursorNextLine(this.params);
        break;

      // CSI Ps F
      // Cursor Preceding Line Ps Times (default = 1) (CNL).
      case 'F':
        this.cursorPrecedingLine(this.params);
        break;

      // CSI Ps G
      // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
      case 'G':
        this.cursorCharAbsolute(this.params);
        break;

      // CSI Ps L
      // Insert Ps Line(s) (default = 1) (IL).
      case 'L':
        this.insertLines(this.params);
        break;

      // CSI Ps M
      // Delete Ps Line(s) (default = 1) (DL).
      case 'M':
        this.deleteLines(this.params);
        break;

      // CSI Ps P
      // Delete Ps Character(s) (default = 1) (DCH).
      case 'P':
        this.deleteChars(this.params);
        break;

      // CSI Ps X
      // Erase Ps Character(s) (default = 1) (ECH).
      case 'X':
        this.eraseChars(this.params);
        break;

      // CSI Pm `  Character Position Absolute
      //   [column] (default = [row,1]) (HPA).
      case '`':
        this.charPosAbsolute(this.params);
        break;

      // 141 61 a * HPR -
      // Horizontal Position Relative
      case 'a':
        this.HPositionRelative(this.params);
        break;

      // CSI P s c
      // Send Device Attributes (Primary DA).
      // CSI > P s c
      // Send Device Attributes (Secondary DA)
      case 'c':
        this.sendDeviceAttributes(this.params);
        break;

      // CSI Pm d
      // Line Position Absolute  [row] (default = [1,column]) (VPA).
      case 'd':
        this.linePosAbsolute(this.params);
        break;

      // 145 65 e * VPR - Vertical Position Relative
      case 'e':
        this.VPositionRelative(this.params);
        break;

      // CSI Ps ; Ps f
      //   Horizontal and Vertical Position [row;column] (default =
      //   [1,1]) (HVP).
      case 'f':
        this.HVPosition(this.params);
        break;

      // CSI Pm h  Set Mode (SM).
      // CSI ? Pm h - mouse escape codes, cursor escape codes
      case 'h':
        this.setMode(this.params);
        break;

      // CSI Pm l  Reset Mode (RM).
      // CSI ? Pm l
      case 'l':
        this.resetMode(this.params);
        break;

      // CSI Ps ; Ps r
      //   Set Scrolling Region [top;bottom] (default = full size of win-
      //   dow) (DECSTBM).
      // CSI ? Pm r
      case 'r':
        this.setScrollRegion(this.params);
        break;

      // CSI s     Save cursor (ANSI.SYS).
      // CSI ? Pm s
      case 's':
        if (this.prefix === '?') {
          this.savePrivateValues(this.params);
        } else if (this.prefix === '') {
          this.saveCursor();
        }
        break;

      // CSI u
      //   Restore cursor (ANSI.SYS).
      case 'u':
        if (this.prefix === '') {
          this.restoreCursor();
        }
        break;

      /**
       * Lesser Used
       */

      // CSI Ps I
      // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
      case 'I':
        this.cursorForwardTab(this.params);
        break;

      // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
      case 'S':
        this.scrollUp(this.params);
        break;

      // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
      // CSI Ps ; Ps ; Ps ; Ps ; Ps T
      // CSI > Ps; Ps T
      case 'T':
        // if (this.prefix === '>') {
        //   this.resetTitleModes(this.params);
        //   break;
        // }
        // if (this.params.length > 2) {
        //   this.initMouseTracking(this.params);
        //   break;
        // }
        if (this.params.length < 2 && !this.prefix) {
          this.scrollDown(this.params);
        }
        break;

      // CSI Ps Z
      // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
      case 'Z':
        this.cursorBackwardTab(this.params);
        break;

      // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
      case 'b':
        this.repeatPrecedingCharacter(this.params);
        break;

      // CSI Ps g  Tab Clear (TBC).
      case 'g':
        this.tabClear(this.params);
        break;

      // CSI Pm i  Media Copy (MC).
      // CSI ? Pm i
      // case 'i':
      //   this.mediaCopy(this.params);
      //   break;

      // CSI Pm m  Character Attributes (SGR).
      // CSI > Ps; Ps m
      // case 'm': // duplicate
      //   if (this.prefix === '>') {
      //     this.setResources(this.params);
      //   } else {
      //     this.charAttributes(this.params);
      //   }
      //   break;

      // CSI Ps n  Device Status Report (DSR).
      // CSI > Ps n
      // case 'n': // duplicate
      //   if (this.prefix === '>') {
      //     this.disableModifiers(this.params);
      //   } else {
      //     this.deviceStatus(this.params);
      //   }
      //   break;

      // CSI > Ps p  Set pointer mode.
      // CSI ! p   Soft terminal reset (DECSTR).
      // CSI Ps$ p
      //   Request ANSI mode (DECRQM).
      // CSI ? Ps$ p
      //   Request DEC private mode (DECRQM).
      // CSI Ps ; Ps " p
      case 'p':
        switch (this.prefix) {
          // case '>':
          //   this.setPointerMode(this.params);
          //   break;
          case '!':
            this.softReset(this.params);
            break;
          // case '?':
          //   if (this.postfix === '$') {
          //     this.requestPrivateMode(this.params);
          //   }
          //   break;
          // default:
          //   if (this.postfix === '"') {
          //     this.setConformanceLevel(this.params);
          //   } else if (this.postfix === '$') {
          //     this.requestAnsiMode(this.params);
          //   }
          //   break;
        }
        break;

      // CSI Ps q  Load LEDs (DECLL).
      // CSI Ps SP q
      // CSI Ps " q
      // case 'q':
      //   if (this.postfix === ' ') {
      //     this.setCursorStyle(this.params);
      //     break;
      //   }
      //   if (this.postfix === '"') {
      //     this.setCharProtectionAttr(this.params);
      //     break;
      //   }
      //   this.loadLEDs(this.params);
      //   break;

      // CSI Ps ; Ps r
      //   Set Scrolling Region [top;bottom] (default = full size of win-
      //   dow) (DECSTBM).
      // CSI ? Pm r
      // CSI Pt; Pl; Pb; Pr; Ps$ r
      // case 'r': // duplicate
      //   if (this.prefix === '?') {
      //     this.restorePrivateValues(this.params);
      //   } else if (this.postfix === '$') {
      //     this.setAttrInRectangle(this.params);
      //   } else {
      //     this.setScrollRegion(this.params);
      //   }
      //   break;

      // CSI Ps ; Ps ; Ps t
      // CSI Pt; Pl; Pb; Pr; Ps$ t
      // CSI > Ps; Ps t
      // CSI Ps SP t
      // case 't':
      //   if (this.postfix === '$') {
      //     this.reverseAttrInRectangle(this.params);
      //   } else if (this.postfix === ' ') {
      //     this.setWarningBellVolume(this.params);
      //   } else {
      //     if (this.prefix === '>') {
      //       this.setTitleModeFeature(this.params);
      //     } else {
      //       this.manipulateWindow(this.params);
      //     }
      //   }
      //   break;

      // CSI u     Restore cursor (ANSI.SYS).
      // CSI Ps SP u
      // case 'u': // duplicate
      //   if (this.postfix === ' ') {
      //     this.setMarginBellVolume(this.params);
      //   } else {
      //     this.restoreCursor(this.params);
      //   }
      //   break;

      // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
      // case 'v':
      //   if (this.postfix === '$') {
      //     this.copyRectagle(this.params);
      //   }
      //   break;

      // CSI Pt ; Pl ; Pb ; Pr ' w
      // case 'w':
      //   if (this.postfix === '\'') {
      //     this.enableFilterRectangle(this.params);
      //   }
      //   break;

      // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
      // CSI Ps x  Select Attribute Change Extent (DECSACE).
      // CSI Pc; Pt; Pl; Pb; Pr$ x
      // case 'x':
      //   if (this.postfix === '$') {
      //     this.fillRectangle(this.params);
      //   } else {
      //     this.requestParameters(this.params);
      //     //this.__(this.params);
      //   }
      //   break;

      // CSI Ps ; Pu ' z
      // CSI Pt; Pl; Pb; Pr$ z
      // case 'z':
      //   if (this.postfix === '\'') {
      //     this.enableLocatorReporting(this.params);
      //   } else if (this.postfix === '$') {
      //     this.eraseRectangle(this.params);
      //   }
      //   break;

      // CSI Pm ' {
      // CSI Pt; Pl; Pb; Pr$ {
      // case '{':
      //   if (this.postfix === '\'') {
      //     this.setLocatorEvents(this.params);
      //   } else if (this.postfix === '$') {
      //     this.selectiveEraseRectangle(this.params);
      //   }
      //   break;

      // CSI Ps ' |
      // case '|':
      //   if (this.postfix === '\'') {
      //     this.requestLocatorPosition(this.params);
      //   }
      //   break;

      // CSI P m SP }
      // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
      // case '}':
      //   if (this.postfix === ' ') {
      //     this.insertColumns(this.params);
      //   }
      //   break;

      // CSI P m SP ~
      // Delete P s Column(s) (default = 1) (DECDC), VT420 and up
      // case '~':
      //   if (this.postfix === ' ') {
      //     this.deleteColumns(this.params);
      //   }
      //   break;

      default:
        this.error('Unknown CSI code: %s (%i).', ch, "" + ch.charCodeAt(0));
        break;
    }

    this.prefix = '';
    this.postfix = '';
    return i;
  }
  
  private _processDataEscape(ch: string, i: number): number {
    switch (ch) {
      // ESC [ Control Sequence Introducer ( CSI is 0x9b).
      case '[':
        this.params = [];
        this.currentParam = 0;
        this.state = STATE_CSI;
        break;

      // ESC ] Operating System Command ( OSC is 0x9d).
      case ']':
        this.params = [];
        this.currentParam = 0;
        this.state = STATE_OSC;
        break;
        
      // ESC & Application mode
      case '&':
        this.params = [];
        this.currentParam = "";
        this.state = STATE_APPLICATION_START;
        break;
        
      // ESC P Device Control String ( DCS is 0x90).
      case 'P':
        this.params = [];
        this.currentParam = 0;
        this.state = STATE_DCS;
        break;

      // ESC _ Application Program Command ( APC is 0x9f).
      case '_':
        this.state = STATE_IGNORE;
        break;

      // ESC ^ Privacy Message ( PM is 0x9e).
      case '^':
        this.state = STATE_IGNORE;
        break;

      // ESC c Full Reset (RIS).
      case 'c':
        this._fullReset();
        break;

      // ESC E Next Line ( NEL is 0x85).
      case 'E':
        this.x = 0;
        this.index();
        break;

      // ESC D Index ( IND is 0x84).
      case 'D':
        this.index();
        break;

      // ESC M Reverse Index ( RI is 0x8d).
      case 'M':
        this.reverseIndex();
        break;

      // ESC % Select default/utf-8 character set.
      // @ = default, G = utf-8
      case '%':
        //this.charset = null;
        this.setgLevel(0);
        this.setgCharset(0, Emulator.charsets.US);
        this.state = STATE_NORMAL;
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
            this.gcharset = 0;
            break;
          case ')':
            this.gcharset = 1;
            break;
          case '*':
            this.gcharset = 2;
            break;
          case '+':
            this.gcharset = 3;
            break;
          case '-':
            this.gcharset = 1;
            break;
          case '.':
            this.gcharset = 2;
            break;
        }
        this.state = STATE_CHARSET;
        break;

      // Designate G3 Character Set (VT300).
      // A = ISO Latin-1 Supplemental.
      // Not implemented.
      case '/':
        this.gcharset = 3;
        this.state = STATE_CHARSET;
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
        this.setgLevel(2);
        break;
      // ESC o
      // Invoke the G3 Character Set as GL (LS3).
      case 'o':
        this.setgLevel(3);
        break;
      // ESC |
      // Invoke the G3 Character Set as GR (LS3R).
      case '|':
        this.setgLevel(3);
        break;
      // ESC }
      // Invoke the G2 Character Set as GR (LS2R).
      case '}':
        this.setgLevel(2);
        break;
      // ESC ~
      // Invoke the G1 Character Set as GR (LS1R).
      case '~':
        this.setgLevel(1);
        break;

      // ESC 7 Save Cursor (DECSC).
      case '7':
        this.saveCursor();
        this.state = STATE_NORMAL;
        break;

      // ESC 8 Restore Cursor (DECRC).
      case '8':
        this.restoreCursor();
        this.state = STATE_NORMAL;
        break;

      // ESC # 3 DEC line height/width
      case '#':
        this.state = STATE_DEC_HASH;
        break;

      // ESC H Tab Set (HTS is 0x88).
      case 'H':
        this.tabSet();
        break;

      // ESC = Application Keypad (DECPAM).
      case '=':
        this.log('Serial port requested application keypad.');
        this.applicationKeypad = true;
        this.state = STATE_NORMAL;
        break;

      // ESC > Normal Keypad (DECPNM).
      case '>':
        this.log('Switching back to normal keypad.');
        this.applicationKeypad = false;
        this.state = STATE_NORMAL;
        break;
        
      default:
        this.state = STATE_NORMAL;
        this.error('Unknown ESC control: %s.', ch);
        break;
    }
    return i;
  }  

  private _processDataCharset(ch: string, i: number): number {
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
    this.setgCharset(this.gcharset, cs);
    this.gcharset = null;
    this.state = STATE_NORMAL;
    return i;
  }
  
  private _processDataOSC(ch: string, i: number): number {
    // OSC Ps ; Pt ST
    // OSC Ps ; Pt BEL
    //   Set Text Parameters.
    if (ch === '\x1b' || ch === '\x07') {
      if (ch === '\x1b') {
        i++;
      }

      this.params.push(this.currentParam);

      switch (this.params[0]) {
        case 0:
        case 1:
        case 2:
          if (this.params[1]) {
            this.title = this.params[1];
            this.handleTitle(this.title);
          }
          break;
        case 3:
          // set X property
          break;
        case 4:
        case 5:
          // change dynamic colors
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
        case 19:
          // change dynamic ui colors
          break;
        case 46:
          // change log file
          break;
        case 50:
          // dynamic font
          break;
        case 51:
          // emacs shell
          break;
        case 52:
          // manipulate selection data
          break;
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
        case 118:
          // reset colors
          break;
      }

      this.params = [];
      this.currentParam = 0;
      this.state = STATE_NORMAL;
    } else {
      if (!this.params.length) {
        if (ch >= '0' && ch <= '9') {
          this.currentParam =
            (<number> this.currentParam) * 10 + ch.charCodeAt(0) - 48;
        } else if (ch === ';') {
          this.params.push(this.currentParam);
          this.currentParam = '';
        }
      } else {
        this.currentParam += ch;
      }
    }
    return i;
  }
  
  private _processDataDCS(ch: string, i: number): number {
    if (ch === '\x1b' || ch === '\x07') {
      if (ch === '\x1b') i++;

      switch (this.prefix) {
        // User-Defined Keys (DECUDK).
        case '':
          break;

        // Request Status String (DECRQSS).
        // test: echo -e '\eP$q"p\e\\'
        case '$q':
          var pt = this.currentParam;
          var valid = false;
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
              replyPt = '' +
                (this.scrollTop + 1) +
                ';' +
                (this.scrollBottom + 1) +
                'r';
              break;

            // SGR
            case 'm':
              replyPt = '0m';
              break;

            default:
              this.error('Unknown DCS Pt: %s.', "" + pt);
              replyPt = '';
              break;
          }

          this.send('\x1bP' + (valid ? 1 : 0) + '$r' + replyPt + '\x1b\\');
          break;

        // Set Termcap/Terminfo Data (xterm, experimental).
        case '+p':
          break;

        // Request Termcap/Terminfo String (xterm, experimental)
        // Regular xterm does not even respond to this sequence.
        // This can cause a small glitch in vim.
        // test: echo -ne '\eP+q6b64\e\\'
        case '+q':
          pt = this.currentParam;
          valid = false;

          this.send('\x1bP' + (valid ? 1 : 0) + '+r' + pt + '\x1b\\');
          break;

        default:
          this.error('Unknown DCS prefix: %s.', this.prefix);
          break;
      }

      this.currentParam = 0;
      this.prefix = '';
      this.state = STATE_NORMAL;
    } else if (!this.currentParam) {
      if (!this.prefix && ch !== '$' && ch !== '+') {
        this.currentParam = ch;
      } else if (this.prefix.length === 2) {
        this.currentParam = ch;
      } else {
        this.prefix += ch;
      }
    } else {
      this.currentParam += ch;
    }
    return i;
  }
  
  private _processDataIgnore(ch: string, i: number): number {
    // For PM and APC.
    if (ch === '\x1b' || ch === '\x07') {
      if (ch === '\x1b') {
        i++;
      }
      this.state = STATE_NORMAL;
    }
    return i;
  }

  private _processDataApplicationStart(ch: string): void {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '-'
        || ch === '/') {

      // Add to the current parameter.
      this.currentParam += ch;  // FIXME don't absorb infinite data here.
      
    } else if (ch === ';') {
      // Parameter separator.
      this.params.push(this.currentParam);
      this.currentParam = '';
      
    } else if (ch === '\x07') {
      // End of parameters.
      this.params.push(this.currentParam);
      if (this.params[0] === this.applicationModeCookie) {
        this.state = STATE_APPLICATION_END;
        this._dispatchEvents();
        this._emit(APPLICATIONMODESTART_EVENT, this, this.params);
      } else {
        this.log("Invalid application mode cookie.");
        this.state = STATE_NORMAL;
      }
    } else {
      // Invalid application start.
      this.state = STATE_NORMAL;
      this.log("Invalid application mode start command.");
    }
  }
  
  private _processDataApplicationEnd(ch: string, data: string, i: number): number {
    // Efficiently look for an end-mode character.
    const nextzero = data.indexOf('\x00', i);
    if (nextzero === -1) {
      // Send all of the data on right now.
      this._emit(APPLICATIONMODEDATA_EVENT, data.slice(i));
      i = data.length - 1;
      
    } else if (nextzero === i) {
      // We are already at the end-mode character.
      this._dispatchEvents();
      this._emit(APPLICATIONMODEEND_EVENT, this);
      this.state = STATE_NORMAL;
      
    } else {
      // Incoming end-mode character. Send the last piece of data.
      this._dispatchEvents();      
      this._emit(APPLICATIONMODEDATA_EVENT, data.slice(i, nextzero));
      i = nextzero - 1;
    }
    return i;
  }
  
  // ESC # variations
  private _processDataDecHash(ch: string): void {
    switch(ch) {
      // ESC # 8
      // Screen Alignment Display (DECALN)
      case '8':
        this.fillScreen('E');
        break;

      default:
        break;
    }
    
    this.state = STATE_NORMAL;
  }
  
  writeln(data: string): void {
    this.write(data + '\r\n');
  };
  
  keyDown(ev: KeyboardEvent): boolean {
    let key: string = null;
    
    // Modifiers keys are often encoded using this scheme.
    const mod = (ev.shiftKey ? 1 : 0) + (ev.altKey ? 2 : 0) + (ev.ctrlKey ? 4: 0) + 1;
    const modStr = mod === 1 ? "" : ";" + mod;
    
    switch (ev.key) {
      // backspace
      case 'Backspace':
        if ((!this.isMac && ev.altKey) || (this.isMac && ev.metaKey)) {  // Alt modifier handling.
          key = '\x1b\x7f'; // ^[^?
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
        if (this.applicationCursor) {
          key = '\x1bOD'; // SS3 as ^[O for 7-bit
          //key = '\x8fD'; // SS3 as 0x8f for 8-bit
          break;
        }
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "D";
        } else {
          key = '\x1b[D';
        }
        break;

      // right-arrow
      case 'ArrowRight':
        if (this.applicationCursor) {
          key = '\x1bOC';
          break;
        }
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "C";
        } else {
          key = '\x1b[C';
        }
        break;

      // up-arrow
      case 'ArrowUp':
        if (this.applicationCursor) {
          key = '\x1bOA';
          break;
        }
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "A";
        } else {
          key = '\x1b[A';
        }
        break;

      // down-arrow
      case 'ArrowDown':
        if (this.applicationCursor) {
          key = '\x1bOB';
          break;
        }
        if (mod !== 1) {
          key = "\x1b[1" + modStr + "B";
        } else {
          key = '\x1b[B';
        }
        break;
        
      // home
      case 'Home':
        if (this.applicationKeypad) {
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
        if (this.applicationKeypad) {
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
          if (ev.ctrlKey) {
            if (ev.key >= '@' && ev.key <= '_') {
              key = String.fromCodePoint(ev.key.codePointAt(0)-'@'.codePointAt(0));
            } else if (ev.key >= 'a' && ev.key <= 'z') {
              key = String.fromCodePoint(ev.key.codePointAt(0)-'a'.codePointAt(0)+1);
            } else if (ev.key === ' ') {
              // Ctrl space
              key = '\x00';
            }

          } else if ((!this.isMac && ev.altKey) || (this.isMac && ev.metaKey)) {  // Alt modifier handling.
            if (ev.key.length === 1) {
              key = '\x1b' + ev.key;
            }
          }
        }
        break;
    }

    if (key === null) {
      return false;
    }
    
    this.showCursor();
    this.handler(key);

    cancelEvent(ev);
    return true;
  }

  private setgLevel(g: number): void {
    this.glevel = g;
    this.charset = this.charsets[g];
  }

  private setgCharset(g: number, charset): void {
    this.charsets[g] = charset;
    if (this.glevel === g) {
      this.charset = charset;
    }
  }

  keyPress(ev: KeyboardEvent): boolean {
    const key = ev.key;
    if (!key || key.length !== 1 || ev.ctrlKey || ev.altKey || ev.metaKey) {
      return false;
    }

    this.showCursor();
    this.handler(key);
    
    cancelEvent(ev);
    return true;
  }

  private send(data: string): void {
    if (!this.queue) {
      setTimeout(() => {
        this.handler(this.queue);
        this.queue = '';
      }, 1);
    }

    this.queue += data;
  }
  
  private bell(): void {
    this._emit(BELL_EVENT, this);
  }


  log(...args: any[]): void {
    if (!this.debug) {
      return;
    }
    
    console.log.apply(console, ["[TERM] ", ...args]);
    console.log.apply(console, ["[TERM] "+ args]);
  }

  private error(...args: string[]): void {
    if (!this.debug) return;
    console.error.apply(console, args);
    console.trace();
  }

  size(): TerminalSize {
    return { rows: this.rows, columns: this.cols };
  }

  resize(newSize: TerminalSize): void {
    const newcols = Math.max(newSize.columns, 1);
    const newrows = Math.max(newSize.rows, 1);

    // resize cols
    if (this.cols < newcols) {
      // Add chars to the lines to match the new (bigger) cols value.
      const chCodePoint = ' '.codePointAt(0);

      for (let i = this.lines.length-1; i >= 0; i--) {
        const {chars, attrs} = this.lines[i];

        const biggerChars = new Uint32Array(newcols);
        biggerChars.set(chars);

        const biggerAttrs = new Uint32Array(newcols);
        biggerAttrs.set(attrs);

        for(let j=chars.length; j<newcols; j++) {
          biggerChars[j] = chCodePoint;
          biggerAttrs[j] = Emulator.defAttr;
        }

        this.lines[i] = {chars: biggerChars, attrs: biggerAttrs};
      }
    } else if (this.cols > newcols) {
      // Remove chars from the lines to match the new (smaller) cols value.
      for (let i = this.lines.length-1; i >= 0; i--) {
        const line = this.lines[i];
        this.lines[i] = {chars: line.chars.slice(0, newcols), attrs: line.attrs.slice(0, newcols)};
      }
    }
    this.setupStops(newcols);
    this.cols = newcols;

    // resize rows
    if (this.rows < newrows) {
      
    } else if (this.rows > newrows) {
      
      // Remove rows to match the new smaller rows value.
      while (this.lines.length > newrows + this.ybase) {
        this._scrollbackLineQueue.push(this.lines.shift());
      }      
    }
    this.rows = newrows;

    // make sure the cursor stays on screen
    if (this.y >= newrows) {
      this._setCursorY(newrows - 1);
    }
    if (this.x >= newcols) {
      this.x = newcols - 1;
    }

    this.scrollTop = 0;
    this.scrollBottom = newrows - 1;
    
    // it's a real nightmare trying
    // to resize the original
    // screen buffer. just set it
    // to null for now.
    this.normal = null;
    
    this.lastReportedPhysicalHeight = this.lines.length;
    this.refresh(0, this.lines.length-1);
    
    this._dispatchEvents();
  }
  
  private _dispatchEvents(): void {
    let checkedRefreshEnd = Math.min(this._refreshEnd, this.lines.length);
    let checkedRefreshStart = this._refreshStart;
    
    if (checkedRefreshEnd === checkedRefreshStart) {
      // Don't signal to refresh anything. This can happen when there are no realized rows yet.
      checkedRefreshEnd = -1;
      checkedRefreshStart = -1;
    }
    
    const event: RenderEvent = {
      rows: this.rows,
      columns: this.cols,
      realizedRows: this.lines.length,
      
      refreshStartRow: checkedRefreshStart,
      refreshEndRow: checkedRefreshEnd,
      scrollbackLines: this._scrollbackLineQueue
    };
    
    this._refreshStart = -1;
    this._refreshEnd = -1;
    this._scrollbackLineQueue = [];
    
    this._emit(RENDER_EVENT, this, event);    
  }
  
  private updateRange(y: number): void {
    if (y < this.refreshStart) this.refreshStart = y;
    if (y > this.refreshEnd) this.refreshEnd = y;
  }
  
  private _setCursorY(newY: number): void {
    this._getRow(newY);
    this.y = newY;
    this.refresh(newY, newY);
  }
  
  private maxRange(): void {
    this.refreshStart = 0;
    this.refreshEnd = this.rows - 1;
  }

  private setupStops(maxCols?: number): void {
    const cols = maxCols === undefined ? this.cols : maxCols;
    this.tabs = {};
    for (let i = 0; i < cols; i += 8) {
      this.tabs[i] = true;
    }
  }

  private prevStop(x?: number): number {
    if (x === undefined) x = this.x;
    while (!this.tabs[--x] && x > 0);
    return x >= this.cols ? this.cols - 1 : (x < 0 ? 0 : x);
  }

  private nextStop(x?: number): number {
    if (x === undefined) x = this.x;
    while (!this.tabs[++x] && x < this.cols);
    return x >= this.cols ? this.cols - 1 : (x < 0 ? 0 : x);
  }

  private eraseRight(x: number, y: number): void {
    this.fillRight(x, y);
  }

  private fillRight(x: number, y: number, ch: string = ' '): void {
    const line = this._tryGetRow(this.ybase + y);
    if (line === null) {
      return;
    }
    const {chars, attrs} = line;
    const attr = this.eraseAttr();
    const chCodePoint = ch.codePointAt(0);

    for (; x < this.cols; x++) {
      chars[x] = chCodePoint;
      attrs[x] = attr;
    }

    this.updateRange(y);
  }

  private fillScreen(fillChar: string = ' '): void {
    let j = this.rows;
    while (j--) {
      this.fillRight(0, j, fillChar);
    }
  }
  
  private eraseLeft(x: number, y: number): void {
    const line = this._getRow(this.ybase + y);
    const {chars, attrs} = line;
    const attr = this.eraseAttr();
    const space = ' '.codePointAt(0);

    x++;
    while (x !== 0) {
      x--;
      chars[x] = space;
      attrs[x] = attr;
    }

    this.updateRange(y);
  }

  private eraseLine(y: number): void {
    this.eraseRight(0, y);
  }

  private blankLine(cur?: boolean): Line {
    const chars = new Uint32Array(this.cols);
    const attrs = new Uint32Array(this.cols);
    const line = { chars, attrs };

    chars.fill(' '.codePointAt(0));
    attrs.fill(cur ? this.eraseAttr() : Emulator.defAttr);

    return line;
  }

  private is(term: string): boolean {
    const name = this.termName;
    return (name + '').indexOf(term) === 0;
  }

  private handler(data) {
    this._emit(DATA_EVENT, this, data);
  }

  private handleTitle(title: string): void {
    this._emit(TITLE_EVENT, this, title);
  }

  /**
   * ESC
   */

  // ESC D Index (IND is 0x84).
  private index(): void {
    if (this.y+1 > this.scrollBottom) {
      this.scroll();
    } else {
      this._setCursorY(this.y+1);
    }
    this.state = STATE_NORMAL;
  }

  // ESC M Reverse Index (RI is 0x8d).
  private reverseIndex(): void {
    if (this.y-1 < this.scrollTop) {
      // possibly move the code below to term.reverseScroll();
      // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
      // blankLine(true) is xterm/linux behavior
      this.lines.splice(this.y + this.ybase, 0, this.blankLine(true));
      const j = this.rows - 1 - this.scrollBottom;
      this.lines.splice(this.rows - 1 + this.ybase - j + 1, 1);

      this.updateRange(this.scrollTop);
      this.updateRange(this.scrollBottom);
    } else {
      this._setCursorY(this.y-1);
    }
    this.state = STATE_NORMAL;
  }

  reset(): void {
    this._fullReset();
    this.x = 0;
    this._setCursorY(0);
    this._dispatchEvents()
  }

  // ESC c Full Reset (RIS).
  _fullReset(): void {
    this._resetVariables();
  }

  // ESC H Tab Set (HTS is 0x88).
  private tabSet(): void {
    this.tabs[this.x] = true;
    this.state = STATE_NORMAL;
  }

  /**
   * CSI
   */

  // CSI Ps A
  // Cursor Up Ps Times (default = 1) (CUU).
  private cursorUp(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    
    if (this.y-param < this.scrollTop) {
      this._setCursorY(this.scrollTop);
    } else {
      this._setCursorY(this.y - param);
    }
  }

  // CSI Ps B
  // Cursor Down Ps Times (default = 1) (CUD).
  private cursorDown(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    
    const bottom = this.scrollBottom !== 0  ? this.scrollBottom : this.rows -1;
    if (this.y+param > bottom) {
      this._setCursorY(bottom);
    } else {
      this._setCursorY(this.y + param);
    }
  }

  // CSI Ps C
  // Cursor Forward Ps Times (default = 1) (CUF).
  private cursorForward(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this.x += param;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
    }
  }

  // CSI Ps D
  // Cursor Backward Ps Times (default = 1) (CUB).
  private cursorBackward(params) {
    var param = params[0];
    if (param < 1) param = 1;
    this.x -= param;
    if (this.x < 0) this.x = 0;
  };

  // CSI Ps ; Ps H
  // Cursor Position [row;column] (default = [1,1]) (CUP).
  private cursorPos(params: number[]): void {
    let y = params[0] - 1 + (this.originMode ? this.scrollTop : 0);
    let x = (params.length >= 2) ? params[1] - 1 : 0;
    
    if (y < 0) {
      y = 0;
    } else if (y >= this.rows) {
      y = this.rows - 1;
    }

    if (x < 0) {
      x = 0;
    } else if (x >= this.cols) {
      x = this.cols - 1;
    }

    this.x = x;
    this._setCursorY(y);
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
  private eraseInDisplay(params: number[]): void {
    let j: number;
    switch (params[0]) {
      case 0:
        this.eraseRight(this.x, this.y);
        j = this.y + 1;
        for (; j < this.rows; j++) {
          this.eraseLine(j);
        }
        break;
      case 1:
        this.eraseLeft(this.x, this.y);
        j = this.y;
        while (j--) {
          this.eraseLine(j);
        }
        break;
      case 2:
        j = this.rows;
        while (j--) {
          this.eraseLine(j);
        }
        break;
      case 3:
        // no saved lines
        break;
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
  private eraseInLine(params: number[]): void {
    switch (params[0]) {
      case 0:
        this.eraseRight(this.x, this.y);
        break;
      case 1:
        this.eraseLeft(this.x, this.y);
        break;
      case 2:
        this.eraseLine(this.y);
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
  private charAttributes(params: number[]): void {
    // Optimize a single SGR0.
    if (params.length === 1 && params[0] === 0) {
      this.curAttr = Emulator.defAttr;
      return;
    }

    const len = params.length;
    let flags = flagsFromCharAttr(this.curAttr);
    let fg = foregroundFromCharAttr(this.curAttr);
    let bg = backgroundFromCharAttr(this.curAttr);

    for (let i = 0; i < len; i++) {
      let p = params[i];
      if (p >= 30 && p <= 37) {
        // fg color 8
        fg = p - 30;
      } else if (p >= 40 && p <= 47) {
        // bg color 8
        bg = p - 40;
      } else if (p >= 90 && p <= 97) {
        // fg color 16
        p += 8;
        fg = p - 90;
      } else if (p >= 100 && p <= 107) {
        // bg color 16
        p += 8;
        bg = p - 100;
      } else if (p === 0) {
        // default
        flags = flagsFromCharAttr(Emulator.defAttr);
        fg = foregroundFromCharAttr(Emulator.defAttr);
        bg = backgroundFromCharAttr(Emulator.defAttr);
        // flags = 0;
        // fg = 0x1ff;
        // bg = 0x1ff;

      } else if (p === 1) {
        // bold text
        flags |= BOLD_ATTR_FLAG;

      } else if (p === 2) {
        // Faint, decreased intensity (ISO 6429).
        flags |= FAINT_ATTR_FLAG;

      } else if (p === 3) {
        // Italic
        flags |= ITALIC_ATTR_FLAG;

      } else if (p === 4) {
        // underlined text
        flags |= UNDERLINE_ATTR_FLAG;

      } else if (p === 5) {
        // blink
        flags |= BLINK_ATTR_FLAG;

      } else if (p === 7) {
        // inverse and positive
        // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
        flags |= INVERSE_ATTR_FLAG;

      } else if (p === 8) {
        // invisible
        flags |= INVISIBLE_ATTR_FLAG;

      } else if (p === 9) {
        // Crossed-out characters (ISO 6429).
        flags |= STRIKE_THROUGH_ATTR_FLAG;
        
      } else if (p >= 10 && p <= 20) {
        // Font setting. Ignore
        
      } else if (p === 22) {
        // not bold and not faint.
        flags &= ~BOLD_ATTR_FLAG;
        flags &= ~FAINT_ATTR_FLAG;
        
      } else if (p === 23) {
        // not italic
        flags &= ~ITALIC_ATTR_FLAG;
  
      } else if (p === 24) {
        // not underlined
        flags &= ~UNDERLINE_ATTR_FLAG;

      } else if (p === 25) {
        // not blink
        flags &= ~BLINK_ATTR_FLAG;

      } else if (p === 27) {
        // not inverse
        flags &= ~INVERSE_ATTR_FLAG;

      } else if (p === 28) {
        // not invisible
        flags &= ~INVISIBLE_ATTR_FLAG;
        
      } else if (p === 29) {
        // not strike through
        flags &= ~STRIKE_THROUGH_ATTR_FLAG;
        
      } else if (p === 39) {
        // reset fg
        fg = foregroundFromCharAttr(Emulator.defAttr);

      } else if (p === 49) {
        // reset bg
        bg = backgroundFromCharAttr(Emulator.defAttr);

      } else if (p === 38) {
        // fg color 256
        if (params[i + 1] === 2) {
          i += 2;
          fg = matchColor(params[i] & 0xff, params[i + 1] & 0xff, params[i + 2] & 0xff);
          if (fg === -1) {
            fg = 0x1ff;
          }
          i += 2;
        } else if (params[i + 1] === 5) {
          i += 2;
          p = params[i] & 0xff;
          fg = p;
        }

      } else if (p === 48) {
        // bg color 256
        if (params[i + 1] === 2) {
          i += 2;
          bg = matchColor(params[i] & 0xff, params[i + 1] & 0xff, params[i + 2] & 0xff);
          if (bg === -1) {
            bg = 0x1ff;
          }
          i += 2;
        } else if (params[i + 1] === 5) {
          i += 2;
          p = params[i] & 0xff;
          bg = p;
        }

      } else if (p === 100) {
        // reset fg/bg
        fg = foregroundFromCharAttr(Emulator.defAttr);
        bg = backgroundFromCharAttr(Emulator.defAttr);

      } else {
        this.error('Unknown SGR attribute: %s.', "" + p);
      }
    }

    this.curAttr = packCharAttr(flags, fg, bg);
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
  private deviceStatus(params: number[]): void {
    if ( ! this.prefix) {
      switch (params[0]) {
        case 5:
          // status report
          this.send('\x1b[0n');
          break;
        case 6:
          // cursor position
          this.send('\x1b[' + (this.y + 1) + ';' + (this.x + 1) + 'R');
          break;
      }
    } else if (this.prefix === '?') {
      // modern xterm doesnt seem to
      // respond to any of these except ?6, 6, and 5
      switch (params[0]) {
        case 6:
          // cursor position
          this.send('\x1b[?' + (this.y + 1) + ';' + (this.x + 1) + 'R');
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
  private insertChars(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;}

    const row = this.y + this.ybase;
    let j = this.x;

    const attr = this.eraseAttr();
    const chCodePoint = ' '.codePointAt(0);

    const {chars, attrs} = this._getRow(row);
    while (param-- && j < this.cols) {
      chars.copyWithin(j+1, j);
      chars[j] = chCodePoint;

      attrs.copyWithin(j+1, j);
      attrs[j] = attr;

      j++;
    }
  }

  // CSI Ps E
  // Cursor Next Line Ps Times (default = 1) (CNL).
  // same as CSI Ps B ?
  private cursorNextLine(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    if (this.y+param >= this.rows) {
      this._setCursorY(this.rows - 1);
    } else {
      this._setCursorY(this.y + param);
    }
    this.x = 0;
  }

  // CSI Ps F
  // Cursor Preceding Line Ps Times (default = 1) (CNL).
  // reuse CSI Ps A ?
  private cursorPrecedingLine(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    if (this.y-param < 0) {
      this._setCursorY(0);
    } else {
      this._setCursorY(this.y - param);
    }
    this.x = 0;
  }

  // CSI Ps G
  // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
  private cursorCharAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this.x = param - 1;
  }

  // CSI Ps L
  // Insert Ps Line(s) (default = 1) (IL).
  private insertLines(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    const row = this.y + this.ybase;
    const j = this.ybase + this.scrollBottom + 1;
    while (param--) {
      // test: echo -e '\e[44m\e[1L\e[0m'
      // blankLine(true) - xterm/linux behavior
      this._getRow(row);
      this.lines.splice(row, 0, this.blankLine(true));
      this.lines.splice(j, 1);
    }

    // this.maxRange();
    this.updateRange(this.y);
    this.updateRange(this.scrollBottom);
  }

  // CSI Ps M
  // Delete Ps Line(s) (default = 1) (DL).
  private deleteLines(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    const row = this.y + this.ybase;
    const j = this.ybase + this.scrollBottom;

    while (param--) {
      // test: echo -e '\e[44m\e[1M\e[0m'
      // blankLine(true) - xterm/linux behavior
      this._getRow(j + 1);
      this.lines.splice(j + 1, 0, this.blankLine(true));
      this.lines.splice(row, 1);
    }

    // this.maxRange();
    this.updateRange(this.y);
    this.updateRange(this.scrollBottom);
  }

  // CSI Ps P
  // Delete Ps Character(s) (default = 1) (DCH).
  private deleteChars(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }

    const row = this.y + this.ybase;
    const attr = this.eraseAttr();
    const chCodePoint = ' '.codePointAt(0);

    const {chars, attrs} = this.lines[row];
    while (param--) {
      chars.copyWithin(this.x, this.x+1);
      chars[chars.length-1] = chCodePoint;

      attrs.copyWithin(this.x, this.x+1);
      attrs[attrs.length-1] = attr;
    }
  }

  // CSI Ps X
  // Erase Ps Character(s) (default = 1) (ECH).
  private eraseChars(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }

    const row = this.y + this.ybase;
    let j = this.x;
    const attr = this.eraseAttr();
    const spaceCodePoint = ' '.codePointAt(0);
    const {chars, attrs} = this._getRow(row);

    while (param-- && j < this.cols) {
      chars[j] = spaceCodePoint;
      attrs[j] = attr;
      j++;
    }
  }

  // CSI Pm `  Character Position Absolute
  //   [column] (default = [row,1]) (HPA).
  private charPosAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this.x = param - 1;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
    }
  }
  
  // 141 61 a * HPR -
  // Horizontal Position Relative
  // reuse CSI Ps C ?
  private HPositionRelative(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this.x += param;
    if (this.x >= this.cols) {
      this.x = this.cols - 1;
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
  private sendDeviceAttributes(params: number[]): void {
    if (params[0] > 0) {
      return;
    }

    if ( ! this.prefix) {
      if (this.is('xterm') || this.is('rxvt-unicode') || this.is('screen')) {
        this.send('\x1b[?1;2c');
      } else if (this.is('linux')) {
        this.send('\x1b[?6c');
      }
    } else if (this.prefix === '>') {
      // xterm and urxvt
      // seem to spit this
      // out around ~370 times (?).
      if (this.is('xterm')) {
        this.send('\x1b[>0;276;0c');
      } else if (this.is('rxvt-unicode')) {
        this.send('\x1b[>85;95;0c');
      } else if (this.is('linux')) {
        // not supported by linux console.
        // linux console echoes parameters.
        this.send(params[0] + 'c');
      } else if (this.is('screen')) {
        this.send('\x1b[>83;40003;0c');
      }
    }
  }

  // CSI Pm d
  // Line Position Absolute  [row] (default = [1,column]) (VPA).
  private linePosAbsolute(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    let y = param - 1 + (this.originMode ? this.scrollTop : 0);
    if (y >= this.rows) {
      y = this.rows - 1;
    }
    this._setCursorY(y);
  }

  // 145 65 e * VPR - Vertical Position Relative
  // reuse CSI Ps B ?
  private VPositionRelative(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    if (this.y+param >= this.rows) {
      this._setCursorY(this.rows - 1);
    } else {
      this._setCursorY(this.y + param);
    }
  }

  // CSI Ps ; Ps f
  //   Horizontal and Vertical Position [row;column] (default =
  //   [1,1]) (HVP).
  private HVPosition(params: number[]): void {
    this.cursorPos(params);
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
  private setMode(params: number|number[]): void {
    if (typeof params === 'object') {
      const l = params.length;
      let i = 0;

      for (; i < l; i++) {
        this.setMode(params[i]);
      }

      return;
    }

    if (this.prefix === '') {
      switch (params) {
        case 4:
          this.insertMode = true;
          break;
        case 20:
          //this.convertEol = true;
          break;
      }
    } else if (this.prefix === '?') {
      switch (params) {
        case 1:
          this.applicationCursor = true;
          break;
        case 2:
          this.setgCharset(0, Emulator.charsets.US);
          this.setgCharset(1, Emulator.charsets.US);
          this.setgCharset(2, Emulator.charsets.US);
          this.setgCharset(3, Emulator.charsets.US);
          // set VT100 mode here
          break;
        case 3: // 132 col mode
          this.savedCols = this.cols;
          this.resize( { rows:this.rows, columns: 132 } );
          break;
        case 6:
          this.originMode = true;
          this.x = 0;
          this._setCursorY(this.scrollTop);
          break;
        case 7:
          this.wraparoundMode = true;
          break;
        case 12:
          // this.cursorBlink = true;
          break;
        case 66:
          this.log('Serial port requested application keypad.');
          this.applicationKeypad = true;
          break;
        case 9: // X10 Mouse
          // no release, no motion, no wheel, no modifiers.
        case 1000: // vt200 mouse
          // no motion.
          // no modifiers, except control on the wheel.
        case 1002: // button event mouse
        case 1003: // any event mouse
          // any event - sends motion events,
          // even if there is no button held down.
          this.x10Mouse = params === 9;
          this.vt200Mouse = params === 1000;
          this.normalMouse = params > 1000;
          this.mouseEvents = true;
          break;
        case 1004: // send focusin/focusout events
          // focusin: ^[[I
          // focusout: ^[[O
          this.sendFocus = true;
          break;
        case 1005: // utf8 ext mode mouse
          this.utfMouse = true;
          // for wide terminals
          // simply encodes large values as utf8 characters
          break;
        case 1006: // sgr ext mode mouse
          this.sgrMouse = true;
          // for wide terminals
          // does not add 32 to fields
          // press: ^[[<b;x;yM
          // release: ^[[<b;x;ym
          break;
        case 1015: // urxvt ext mode mouse
          this.urxvtMouse = true;
          // for wide terminals
          // numbers for fields
          // press: ^[[b;x;yM
          // motion: ^[[b;x;yT
          break;
        case 25: // show cursor
          this.cursorHidden = false;
          break;
        case 1049: // alt screen buffer cursor
          //this.saveCursor();
          // FALL-THROUGH
        case 47: // alt screen buffer
        case 1047: // alt screen buffer
          if ( ! this.normal) {
            const normal: SavedState = {
              cols: this.cols,
              rows: this.rows,
              lines: this.lines,
              ybase: this.ybase,
              ydisp: this.ydisp,
              x: this.x,
              y: this.y,
              scrollTop: this.scrollTop,
              scrollBottom: this.scrollBottom,
              tabs: this.tabs,
            };
            
            // Preserve these variables during the reset().
            const previousCharset = this.charset;
            const previousGlevel = this.glevel;
            const previousCharsets = this.charsets;
            
            this._fullReset();
            
            this.charset = previousCharset;
            this.glevel = previousGlevel;
            this.charsets = previousCharsets;
            
            // Materialize the same number of rows as the normal lines array to ensure that
            // the new screen buffer is rendered over all of the previous screen.
            while (this.lines.length < normal.lines.length) {
              this._getRow(this.lines.length);
            }
            
            this.normal = normal;
            this.showCursor();
          }
          break;
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
  private resetMode(params: number|number[]) {
    if (typeof params === 'object') {
      const l = params.length;
      for (let i=0; i < l; i++) {
        this.resetMode(params[i]);
      }

      return;
    }

    if (!this.prefix) {
      switch (params) {
        case 4:
          this.insertMode = false;
          break;
        case 20:
          //this.convertEol = false;
          break;
      }
    } else if (this.prefix === '?') {
      switch (params) {
        case 1:
          this.applicationCursor = false;
          break;
          
        // 80 Column Mode (DECCOLM).
        case 3:
          this.fillScreen();
          this.x = 0;
          this._setCursorY(0);
        
          if (this.cols === 132 && this.savedCols) {
            this.resize( { rows: this.rows, columns: this.savedCols } );
          }
          break;
        case 6:
          this.originMode = false;
          this.x = 0;
          this._setCursorY(0);
          break;
        case 7:
          this.wraparoundMode = false;
          break;
        case 12:
          // this.cursorBlink = false;
          break;
        case 66:
          this.log('Switching back to normal keypad.');
          this.applicationKeypad = false;
          break;
        case 9: // X10 Mouse
        case 1000: // vt200 mouse
        case 1002: // button event mouse
        case 1003: // any event mouse
          this.x10Mouse = false;
          this.vt200Mouse = false;
          this.normalMouse = false;
          this.mouseEvents = false;
          break;
        case 1004: // send focusin/focusout events
          this.sendFocus = false;
          break;
        case 1005: // utf8 ext mode mouse
          this.utfMouse = false;
          break;
        case 1006: // sgr ext mode mouse
          this.sgrMouse = false;
          break;
        case 1015: // urxvt ext mode mouse
          this.urxvtMouse = false;
          break;
        case 25: // hide cursor
          this.cursorHidden = true;
          break;
        case 1049: // alt screen buffer cursor
          // FALL-THROUGH
        case 47: // normal screen buffer
        case 1047: // normal screen buffer - clearing it first
          if (this.normal) {
            const currentcols = this.cols;
            const currentrows = this.rows;
            
            this.lines = this.normal.lines;
            this.cols = this.normal.cols;
            this.rows = this.normal.rows;
            this.ybase = this.normal.ybase;
            this.ydisp = this.normal.ydisp;
            this.x = this.normal.x;
            this._setCursorY(this.normal.y);
            this.scrollTop = this.normal.scrollTop;
            this.scrollBottom = this.normal.scrollBottom;
            this.tabs = this.normal.tabs;
            
            this.normal = null;
            // if (params === 1049) {
            //   this.x = this.savedX;
            //   this._setCursorY(this.savedY);
            // }
            this.resize( { rows: currentrows, columns: currentcols } );
            this.refresh(0, this.rows - 1);
            this.showCursor();
          }
          break;
      }
    }
  }

  // CSI Ps ; Ps r
  //   Set Scrolling Region [top;bottom] (default = full size of win-
  //   dow) (DECSTBM).
  // CSI ? Pm r
  private setScrollRegion(params: number[]): void {
    if (this.prefix === '') {
      const top = (params[0] || 1) - 1;
      const bottom = (params[1] || this.rows) - 1;
      if ( ! (top >= 0 && bottom < this.rows && top < bottom)) {
        return;
      }
      this.scrollTop = top;
      this.scrollBottom = bottom;
      this.x = 0;
      this._setCursorY(this.originMode ? this.scrollTop : 0);
    }
  }

  // CSI s
  //   Save cursor (ANSI.SYS).
  private saveCursor(): void {
    this.savedX = this.x;
    this.savedY = this.y;
    this.savedCharset = this.charset;
    this.savedCurAttr = this.curAttr;
  }

  // CSI u
  //   Restore cursor (ANSI.SYS).
  private restoreCursor(): void {
    this.x = this.savedX;
    this._setCursorY(this.savedY);
    this.charset = this.savedCharset;
    this.curAttr = this.savedCurAttr;
  }

  /**
   * Lesser Used
   */

  // CSI Ps I
  //   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
  private cursorForwardTab(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this.x = this.nextStop();
    }
  }

  // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
  private scrollUp(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this.lines.splice(this.ybase + this.scrollTop, 1);
      this.lines.splice(this.ybase + this.scrollBottom, 0, this.blankLine());
    }
    // this.maxRange();
    this.updateRange(this.scrollTop);
    this.updateRange(this.scrollBottom);
  }

  // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
  private scrollDown(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this.lines.splice(this.ybase + this.scrollBottom, 1);
      this.lines.splice(this.ybase + this.scrollTop, 0, this.blankLine());
    }
    // this.maxRange();
    this.updateRange(this.scrollTop);
    this.updateRange(this.scrollBottom);
  }

  // CSI Ps ; Ps ; Ps ; Ps ; Ps T
  //   Initiate highlight mouse tracking.  Parameters are
  //   [func;startx;starty;firstrow;lastrow].  See the section Mouse
  //   Tracking.
  private initMouseTracking(params: number[]): void {
    // Relevant: DECSET 1001
  }

  // CSI > Ps; Ps T
  //   Reset one or more features of the title modes to the default
  //   value.  Normally, "reset" disables the feature.  It is possi-
  //   ble to disable the ability to reset features by compiling a
  //   different default for the title modes into xterm.
  //     Ps = 0  -> Do not set window/icon labels using hexadecimal.
  //     Ps = 1  -> Do not query window/icon labels using hexadeci-
  //     mal.
  //     Ps = 2  -> Do not set window/icon labels using UTF-8.
  //     Ps = 3  -> Do not query window/icon labels using UTF-8.
  //   (See discussion of "Title Modes").
  private esetTitleModes(params: number[]): void {
  }

  // CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
  private cursorBackwardTab(params: number[]): void {
    let param = params[0] || 1;
    while (param--) {
      this.x = this.prevStop();
    }
  }

  // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
  private repeatPrecedingCharacter(params: number[]): void {
    let param = params[0] || 1;
    const {chars, attrs} = this._getRow(this.ybase + this.y);

    const attr = this.x == 0 ? Emulator.defAttr : attrs[this.x-1];
    const chCodePoint = this.x === 0 ? ' '.codePointAt(0) : chars[this.x-1];

    while (param--) {
      chars[this.x] = chCodePoint;
      attrs[this.x] = attr;
      this.x++;
    }
  }

  // CSI Ps g  Tab Clear (TBC).
  //     Ps = 0  -> Clear Current Column (default).
  //     Ps = 3  -> Clear All.
  // Potentially:
  //   Ps = 2  -> Clear Stops on Line.
  //   http://vt100.net/annarbor/aaa-ug/section6.html
  private tabClear(params: number[]): void {
    let param = params[0];
    if (param <= 0) {
      delete this.tabs[this.x];
    } else if (param === 3) {
      this.tabs = {};
    }
  }

  // CSI Pm i  Media Copy (MC).
  //     Ps = 0  -> Print screen (default).
  //     Ps = 4  -> Turn off printer controller mode.
  //     Ps = 5  -> Turn on printer controller mode.
  // CSI ? Pm i
  //   Media Copy (MC, DEC-specific).
  //     Ps = 1  -> Print line containing cursor.
  //     Ps = 4  -> Turn off autoprint mode.
  //     Ps = 5  -> Turn on autoprint mode.
  //     Ps = 1  0  -> Print composed display, ignores DECPEX.
  //     Ps = 1  1  -> Print all pages.
  private mediaCopy(params: number[]): void {
  }

  // CSI > Ps; Ps m
  //   Set or reset resource-values used by xterm to decide whether
  //   to construct escape sequences holding information about the
  //   modifiers pressed with a given key.  The first parameter iden-
  //   tifies the resource to set/reset.  The second parameter is the
  //   value to assign to the resource.  If the second parameter is
  //   omitted, the resource is reset to its initial value.
  //     Ps = 1  -> modifyCursorKeys.
  //     Ps = 2  -> modifyFunctionKeys.
  //     Ps = 4  -> modifyOtherKeys.
  //   If no parameters are given, all resources are reset to their
  //   initial values.
  private setResources(params: number[]): void {
  }

  // CSI > Ps n
  //   Disable modifiers which may be enabled via the CSI > Ps; Ps m
  //   sequence.  This corresponds to a resource value of "-1", which
  //   cannot be set with the other sequence.  The parameter identi-
  //   fies the resource to be disabled:
  //     Ps = 1  -> modifyCursorKeys.
  //     Ps = 2  -> modifyFunctionKeys.
  //     Ps = 4  -> modifyOtherKeys.
  //   If the parameter is omitted, modifyFunctionKeys is disabled.
  //   When modifyFunctionKeys is disabled, xterm uses the modifier
  //   keys to make an extended sequence of functions rather than
  //   adding a parameter to each function key to denote the modi-
  //   fiers.
  private disableModifiers(params: number[]): void {
  }

  // CSI > Ps p
  //   Set resource value pointerMode.  This is used by xterm to
  //   decide whether to hide the pointer cursor as the user types.
  //   Valid values for the parameter:
  //     Ps = 0  -> never hide the pointer.
  //     Ps = 1  -> hide if the mouse tracking mode is not enabled.
  //     Ps = 2  -> always hide the pointer.  If no parameter is
  //     given, xterm uses the default, which is 1 .
  private setPointerMode(params: number[]): void {
  }

  // CSI ! p   Soft terminal reset (DECSTR).
  // http://vt100.net/docs/vt220-rm/table4-10.html
  private softReset(params: number[]): void {
    this.cursorHidden = false;
    this.insertMode = false;
    this.originMode = false;
    this.wraparoundMode = false; // autowrap
    this.applicationKeypad = false; // ?
    this.applicationCursor = false;
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
    this.curAttr = Emulator.defAttr;
    this.x = 0;
    this._setCursorY(0);
    this.charset = null;
    this.glevel = 0; // ??
    this.charsets = [null]; // ??
  }

  // CSI Ps$ p
  //   Request ANSI mode (DECRQM).  For VT300 and up, reply is
  //     CSI Ps; Pm$ y
  //   where Ps is the mode number as in RM, and Pm is the mode
  //   value:
  //     0 - not recognized
  //     1 - set
  //     2 - reset
  //     3 - permanently set
  //     4 - permanently reset
  private requestAnsiMode(params: number[]): void {
  }

  // CSI ? Ps$ p
  //   Request DEC private mode (DECRQM).  For VT300 and up, reply is
  //     CSI ? Ps; Pm$ p
  //   where Ps is the mode number as in DECSET, Pm is the mode value
  //   as in the ANSI DECRQM.
  private requestPrivateMode(params: number[]): void {
  }

  // CSI Ps ; Ps " p
  //   Set conformance level (DECSCL).  Valid values for the first
  //   parameter:
  //     Ps = 6 1  -> VT100.
  //     Ps = 6 2  -> VT200.
  //     Ps = 6 3  -> VT300.
  //   Valid values for the second parameter:
  //     Ps = 0  -> 8-bit controls.
  //     Ps = 1  -> 7-bit controls (always set for VT100).
  //     Ps = 2  -> 8-bit controls.
  private setConformanceLevel(params: number[]): void {
  }

  // CSI Ps q  Load LEDs (DECLL).
  //     Ps = 0  -> Clear all LEDS (default).
  //     Ps = 1  -> Light Num Lock.
  //     Ps = 2  -> Light Caps Lock.
  //     Ps = 3  -> Light Scroll Lock.
  //     Ps = 2  1  -> Extinguish Num Lock.
  //     Ps = 2  2  -> Extinguish Caps Lock.
  //     Ps = 2  3  -> Extinguish Scroll Lock.
  private loadLEDs(params: number[]): void {
  }

  // CSI Ps SP q
  //   Set cursor style (DECSCUSR, VT520).
  //     Ps = 0  -> blinking block.
  //     Ps = 1  -> blinking block (default).
  //     Ps = 2  -> steady block.
  //     Ps = 3  -> blinking underline.
  //     Ps = 4  -> steady underline.
  private setCursorStyle(params: number[]): void {
  }

  // CSI Ps " q
  //   Select character protection attribute (DECSCA).  Valid values
  //   for the parameter:
  //     Ps = 0  -> DECSED and DECSEL can erase (default).
  //     Ps = 1  -> DECSED and DECSEL cannot erase.
  //     Ps = 2  -> DECSED and DECSEL can erase.
  private setCharProtectionAttr(params: number[]): void {
  }

  // CSI ? Pm r
  //   Restore DEC Private Mode Values.  The value of Ps previously
  //   saved is restored.  Ps values are the same as for DECSET.
  private restorePrivateValues(params: number[]): void {
  }

  // CSI Pt; Pl; Pb; Pr; Ps$ r
  //   Change Attributes in Rectangular Area (DECCARA), VT400 and up.
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  //     Ps denotes the SGR attributes to change: 0, 1, 4, 5, 7.
  // NOTE: xterm doesn't enable this code by default.
  private setAttrInRectangle(params: number[]): void {
    let t = params[0];
    const l = params[1];
    const b = params[2];
    const r = params[3];
    const attr = params[4];

    for (; t < b + 1; t++) {
      const line = this._getRow(this.ybase + t);
      const attrs = line.attrs;
      for (let i = l; i < r; i++) {
        attrs[i] = attr;
      }
    }

    // this.maxRange();
    this.updateRange(params[0]);
    this.updateRange(params[2]);
  }

  // CSI ? Pm s
  //   Save DEC Private Mode Values.  Ps values are the same as for
  //   DECSET.
  private savePrivateValues(params: number[]): void {
  }

  // CSI Ps ; Ps ; Ps t
  //   Window manipulation (from dtterm, as well as extensions).
  //   These controls may be disabled using the allowWindowOps
  //   resource.  Valid values for the first (and any additional
  //   parameters) are:
  //     Ps = 1  -> De-iconify window.
  //     Ps = 2  -> Iconify window.
  //     Ps = 3  ;  x ;  y -> Move window to [x, y].
  //     Ps = 4  ;  height ;  width -> Resize the xterm window to
  //     height and width in pixels.
  //     Ps = 5  -> Raise the xterm window to the front of the stack-
  //     ing order.
  //     Ps = 6  -> Lower the xterm window to the bottom of the
  //     stacking order.
  //     Ps = 7  -> Refresh the xterm window.
  //     Ps = 8  ;  height ;  width -> Resize the text area to
  //     [height;width] in characters.
  //     Ps = 9  ;  0  -> Restore maximized window.
  //     Ps = 9  ;  1  -> Maximize window (i.e., resize to screen
  //     size).
  //     Ps = 1 0  ;  0  -> Undo full-screen mode.
  //     Ps = 1 0  ;  1  -> Change to full-screen.
  //     Ps = 1 1  -> Report xterm window state.  If the xterm window
  //     is open (non-iconified), it returns CSI 1 t .  If the xterm
  //     window is iconified, it returns CSI 2 t .
  //     Ps = 1 3  -> Report xterm window position.  Result is CSI 3
  //     ; x ; y t
  //     Ps = 1 4  -> Report xterm window in pixels.  Result is CSI
  //     4  ;  height ;  width t
  //     Ps = 1 8  -> Report the size of the text area in characters.
  //     Result is CSI  8  ;  height ;  width t
  //     Ps = 1 9  -> Report the size of the screen in characters.
  //     Result is CSI  9  ;  height ;  width t
  //     Ps = 2 0  -> Report xterm window's icon label.  Result is
  //     OSC  L  label ST
  //     Ps = 2 1  -> Report xterm window's title.  Result is OSC  l
  //     label ST
  //     Ps = 2 2  ;  0  -> Save xterm icon and window title on
  //     stack.
  //     Ps = 2 2  ;  1  -> Save xterm icon title on stack.
  //     Ps = 2 2  ;  2  -> Save xterm window title on stack.
  //     Ps = 2 3  ;  0  -> Restore xterm icon and window title from
  //     stack.
  //     Ps = 2 3  ;  1  -> Restore xterm icon title from stack.
  //     Ps = 2 3  ;  2  -> Restore xterm window title from stack.
  //     Ps >= 2 4  -> Resize to Ps lines (DECSLPP).
  private manipulateWindow(params: number[]): void {
  }

  // CSI Pt; Pl; Pb; Pr; Ps$ t
  //   Reverse Attributes in Rectangular Area (DECRARA), VT400 and
  //   up.
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  //     Ps denotes the attributes to reverse, i.e.,  1, 4, 5, 7.
  // NOTE: xterm doesn't enable this code by default.
  private reverseAttrInRectangle(params: number[]): void {
  }

  // CSI > Ps; Ps t
  //   Set one or more features of the title modes.  Each parameter
  //   enables a single feature.
  //     Ps = 0  -> Set window/icon labels using hexadecimal.
  //     Ps = 1  -> Query window/icon labels using hexadecimal.
  //     Ps = 2  -> Set window/icon labels using UTF-8.
  //     Ps = 3  -> Query window/icon labels using UTF-8.  (See dis-
  //     cussion of "Title Modes")
  private setTitleModeFeature(params: number[]): void {
  }

  // CSI Ps SP t
  //   Set warning-bell volume (DECSWBV, VT520).
  //     Ps = 0  or 1  -> off.
  //     Ps = 2 , 3  or 4  -> low.
  //     Ps = 5 , 6 , 7 , or 8  -> high.
  private setWarningBellVolume(params: number[]): void {
  }

  // CSI Ps SP u
  //   Set margin-bell volume (DECSMBV, VT520).
  //     Ps = 1  -> off.
  //     Ps = 2 , 3  or 4  -> low.
  //     Ps = 0 , 5 , 6 , 7 , or 8  -> high.
  private setMarginBellVolume(params: number[]): void {
  }

  // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
  //   Copy Rectangular Area (DECCRA, VT400 and up).
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  //     Pp denotes the source page.
  //     Pt; Pl denotes the target location.
  //     Pp denotes the target page.
  // NOTE: xterm doesn't enable this code by default.
  private copyRectangle(params: number[]): void {
  }

  // CSI Pt ; Pl ; Pb ; Pr ' w
  //   Enable Filter Rectangle (DECEFR), VT420 and up.
  //   Parameters are [top;left;bottom;right].
  //   Defines the coordinates of a filter rectangle and activates
  //   it.  Anytime the locator is detected outside of the filter
  //   rectangle, an outside rectangle event is generated and the
  //   rectangle is disabled.  Filter rectangles are always treated
  //   as "one-shot" events.  Any parameters that are omitted default
  //   to the current locator position.  If all parameters are omit-
  //   ted, any locator motion will be reported.  DECELR always can-
  //   cels any prevous rectangle definition.
  private enableFilterRectangle(params: number[]): void {
  }

  // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
  //   if Ps is a "0" (default) or "1", and xterm is emulating VT100,
  //   the control sequence elicits a response of the same form whose
  //   parameters describe the terminal:
  //     Ps -> the given Ps incremented by 2.
  //     Pn = 1  <- no parity.
  //     Pn = 1  <- eight bits.
  //     Pn = 1  <- 2  8  transmit 38.4k baud.
  //     Pn = 1  <- 2  8  receive 38.4k baud.
  //     Pn = 1  <- clock multiplier.
  //     Pn = 0  <- STP flags.
  private requestParameters(params: number[]): void {
  }

  // CSI Ps x  Select Attribute Change Extent (DECSACE).
  //     Ps = 0  -> from start to end position, wrapped.
  //     Ps = 1  -> from start to end position, wrapped.
  //     Ps = 2  -> rectangle (exact).
  private selectChangeExtent(params: number[]): void {
  }

  // CSI Pc; Pt; Pl; Pb; Pr$ x
  //   Fill Rectangular Area (DECFRA), VT420 and up.
  //     Pc is the character to use.
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  // NOTE: xterm doesn't enable this code by default.
  private fillRectangle(params: number[]): void {
    const ch = params[0];
    let t = params[1];
    const l = params[2];
    const b = params[3];
    const r = params[4];

    for (; t < b + 1; t++) {
      const chars = this._getRow(this.ybase + t).chars;

      for (let i = l; i < r; i++) {
        chars[i] = ch;
      }
    }

    // this.maxRange();
    this.updateRange(params[1]);
    this.updateRange(params[3]);
  }

  // CSI Ps ; Pu ' z
  //   Enable Locator Reporting (DECELR).
  //   Valid values for the first parameter:
  //     Ps = 0  -> Locator disabled (default).
  //     Ps = 1  -> Locator enabled.
  //     Ps = 2  -> Locator enabled for one report, then disabled.
  //   The second parameter specifies the coordinate unit for locator
  //   reports.
  //   Valid values for the second parameter:
  //     Pu = 0  <- or omitted -> default to character cells.
  //     Pu = 1  <- device physical pixels.
  //     Pu = 2  <- character cells.
  private enableLocatorReporting(params: number[]): void {
  //  var val = params[0] > 0;
    //this.mouseEvents = val;
    //this.decLocator = val;
  }

  // CSI Pt; Pl; Pb; Pr$ z
  //   Erase Rectangular Area (DECERA), VT400 and up.
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  // NOTE: xterm doesn't enable this code by default.
  private eraseRectangle(params: number[]): void {
    let t = params[0];
    const l = params[1];
    const b = params[2];
    const r = params[3];

    const attr = this.eraseAttr();
    const chCodePoint = ' '.codePointAt(0);

    for (; t < b + 1; t++) {
      const {chars, attrs} = this._getRow(this.ybase + t);
      for (let i = l; i < r; i++) {
        chars[i] = chCodePoint;
        attrs[i] = attr;
      }
    }

    // this.maxRange();
    this.updateRange(params[0]);
    this.updateRange(params[2]);
  }

  // CSI Pm ' {
  //   Select Locator Events (DECSLE).
  //   Valid values for the first (and any additional parameters)
  //   are:
  //     Ps = 0  -> only respond to explicit host requests (DECRQLP).
  //                (This is default).  It also cancels any filter
  //   rectangle.
  //     Ps = 1  -> report button down transitions.
  //     Ps = 2  -> do not report button down transitions.
  //     Ps = 3  -> report button up transitions.
  //     Ps = 4  -> do not report button up transitions.
  private setLocatorEvents(params: number[]): void {
  }

  // CSI Pt; Pl; Pb; Pr$ {
  //   Selective Erase Rectangular Area (DECSERA), VT400 and up.
  //     Pt; Pl; Pb; Pr denotes the rectangle.
  private selectiveEraseRectangle(params: number[]): void {
  }

  // CSI Ps ' |
  //   Request Locator Position (DECRQLP).
  //   Valid values for the parameter are:
  //     Ps = 0 , 1 or omitted -> transmit a single DECLRP locator
  //     report.

  //   If Locator Reporting has been enabled by a DECELR, xterm will
  //   respond with a DECLRP Locator Report.  This report is also
  //   generated on button up and down events if they have been
  //   enabled with a DECSLE, or when the locator is detected outside
  //   of a filter rectangle, if filter rectangles have been enabled
  //   with a DECEFR.

  //     -> CSI Pe ; Pb ; Pr ; Pc ; Pp &  w

  //   Parameters are [event;button;row;column;page].
  //   Valid values for the event:
  //     Pe = 0  -> locator unavailable - no other parameters sent.
  //     Pe = 1  -> request - xterm received a DECRQLP.
  //     Pe = 2  -> left button down.
  //     Pe = 3  -> left button up.
  //     Pe = 4  -> middle button down.
  //     Pe = 5  -> middle button up.
  //     Pe = 6  -> right button down.
  //     Pe = 7  -> right button up.
  //     Pe = 8  -> M4 button down.
  //     Pe = 9  -> M4 button up.
  //     Pe = 1 0  -> locator outside filter rectangle.
  //   ``button'' parameter is a bitmask indicating which buttons are
  //     pressed:
  //     Pb = 0  <- no buttons down.
  //     Pb & 1  <- right button down.
  //     Pb & 2  <- middle button down.
  //     Pb & 4  <- left button down.
  //     Pb & 8  <- M4 button down.
  //   ``row'' and ``column'' parameters are the coordinates of the
  //     locator position in the xterm window, encoded as ASCII deci-
  //     mal.
  //   The ``page'' parameter is not used by xterm, and will be omit-
  //   ted.
  private requestLocatorPosition(params: number[]): void {
  }

  // CSI P m SP }
  // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
  // NOTE: xterm doesn't enable this code by default.
  private insertColumns(params: number[]): void {
    let param = params[0];
    const l = this.ybase + this.rows;

    const chCodePoint = ' '.codePointAt(0);
    const attr = this.eraseAttr();

    while (param--) {
      for (let i = this.ybase; i < l; i++) {
        const {chars, attrs} = this._getRow(i);
        chars.copyWithin(this.x+2, this.x+1);
        chars[this.x+1] = chCodePoint;

        attrs.copyWithin(this.x+2, this.x+1);
        attrs[this.x+1] = attr;
      }
    }

    this.maxRange();
  }

  // CSI P m SP ~
  // Delete P s Column(s) (default = 1) (DECDC), VT420 and up
  // NOTE: xterm doesn't enable this code by default.
  private deleteColumns(params: number[]): void {
    let param = params[0];
    const l = this.ybase + this.rows;
    
    const chCodePoint = ' '.codePointAt(0);
    const attr = this.eraseAttr();

    while (param--) {
      for (let i = this.ybase; i < l; i++) {
        const {chars, attrs} = this._getRow(i);

        chars.copyWithin(this.x, this.x+1);
        chars[chars.length-1] = chCodePoint;

        attrs.copyWithin(this.x, this.x+1);
        attrs[attrs.length-1] = attr;
      }
    }

    this.maxRange();
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
  
  /*************************************************************************/
  /**
   * EventEmitter
   */
  // Events
  addRenderEventListener(eventHandler: RenderEventHandler): void {
    this.addListener(RENDER_EVENT, eventHandler);
  }
  
  removeRenderEventListener(eventHandler: RenderEventHandler): void {
    this.removeListener(RENDER_EVENT, eventHandler);
  }

  addBellEventListener(eventHandler: BellEventListener): void {
    this.addListener(BELL_EVENT, eventHandler);
  }

  addDataEventListener(eventHandler: DataEventListener): void {
    this.addListener(DATA_EVENT, eventHandler);
  }

  addTitleChangeEventListener(eventHandler: TitleChangeEventListener): void {
    this.addListener(TITLE_EVENT, eventHandler);
  }

  addApplicationModeStartEventListener(eventHandler: ApplicationModeEventListener): void {
    this.addListener(APPLICATIONMODESTART_EVENT, eventHandler);
  }

  addApplicationModeDataEventListener(eventHandler: ApplicationModeDataEventListener): void {
    this.addListener(APPLICATIONMODEDATA_EVENT, eventHandler);
  }

  addApplicationModeEndEventListener(eventHandler: ApplicationModeEventListener): void {
    this.addListener(APPLICATIONMODEEND_EVENT, eventHandler);
  }

  addWriteBufferSizeEventListener(eventHandler: WriteBufferSizeEventListener): void {
    this.addListener(WRITEBUFFERSIZE_EVENT, eventHandler);
  }

  private addListener(type: string, listener: any): void {
    this._events[type] = this._events[type] || [];
    this._events[type].push(listener);
  }

  private on(type: string, listener: EventListener): void {
    this.addListener(type, listener);
  }

  private removeListener(type: string, listener): void {
    if (!this._events[type]) return;

    var obj = this._events[type];
    var i = obj.length;

    while (i--) {
      if (obj[i] === listener /*  || obj[i].listener === listener */ )  {
        obj.splice(i, 1);
        return;
      }
    }
  }

  // private removeAllListeners(type): void {
  //   if (this._events[type]) {
  //     delete this._events[type];
  //   }
  // }

  private _emit(type, ...args: any[]): void {
    if (!this._events[type]) return;

    var obj = this._events[type];
    var l = obj.length;
    var i = 0;

    for (; i < l; i++) {
      obj[i].apply(this, args);
    }
  }

  // listeners(type) {
  //   return this._events[type] !== undefined ? this._events[type] : [];
  // }
  
  dumpLines(): void {
    for (let y=0; y<this.lines.length; y++) {
      this.log(""+y+": "+this.getLineText(y));
    }
  }
  /*************************************************************************/
}

/**
 * Helpers
 */

function on(el: EventTarget, type: string, handler: EventListener, capture = false): void {
  el.addEventListener(type, handler, capture);
}

function off(el: EventTarget, type: string, handler: EventListener, capture = false): void {
  el.removeEventListener(type, handler, capture || false);
}

function cancelEvent(ev) {
  if (ev.preventDefault) ev.preventDefault();
  ev.returnValue = false;
  if (ev.stopPropagation) ev.stopPropagation();
  ev.cancelBubble = true;
  return false;
}

function indexOf(obj, el) {
  var i = obj.length;
  while (i--) {
    if (obj[i] === el) return i;
  }
  return -1;
}

function isWide(ch: string): boolean {
  if (ch <= '\uff00') return false;
  return (ch >= '\uff01' && ch <= '\uffbe') ||
      (ch >= '\uffc2' && ch <= '\uffc7') ||
      (ch >= '\uffca' && ch <= '\uffcf') ||
      (ch >= '\uffd2' && ch <= '\uffd7') ||
      (ch >= '\uffda' && ch <= '\uffdc') ||
      (ch >= '\uffe0' && ch <= '\uffe6') ||
      (ch >= '\uffe8' && ch <= '\uffee');
}

const matchColorCache = {};

function matchColor(r1, g1, b1) {
  var hash = (r1 << 16) | (g1 << 8) | b1;

  if (matchColorCache[hash] !== undefined) {
    return matchColorCache[hash];
  }

  var ldiff = Infinity;
  var li = -1;
  var i = 0;
  var c;
  var r2;
  var g2;
  var b2;
  var diff;

  for (; i < Emulator.vcolors.length; i++) {
    c = Emulator.vcolors[i];
    r2 = c[0];
    g2 = c[1];
    b2 = c[2];

    diff = matchColorDistance(r1, g1, b1, r2, g2, b2);

    if (diff === 0) {
      li = i;
      break;
    }

    if (diff < ldiff) {
      ldiff = diff;
      li = i;
    }
  }

  matchColorCache[hash] = li;
  return li;
}

// http://stackoverflow.com/questions/1633828
function matchColorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.pow(30 * (r1 - r2), 2) +
    Math.pow(59 * (g1 - g2), 2) +
    Math.pow(11 * (b1 - b2), 2);
}

export interface ScrollDetail {
  position: number;
  isBottom: boolean;
}

/**
 * Get the root of the DOM tree or Shadow DOM holding a node.
 * 
 * @param  startElement the element to search from.
 * @return The root of the DOM tree containing the node.
 */
function getDOMRoot(startElement: Node): Document | ShadowRoot {
  let el: Node = startElement;
  do {
    if (el.nodeName === "#document-fragment" || el.nodeName === "#document") {
      return <Document | ShadowRoot> el;
    }
    el = el.parentNode;
  } while (el !== null);
  return null;
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  
