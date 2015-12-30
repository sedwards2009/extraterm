/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import fs  = require('fs');
import crypto = require('crypto');
import ViewerElement = require("./viewerelement");
import ViewerElementTypes = require("./viewerelementtypes");
import EtEmbeddedViewer = require('./embeddedviewer');
import EtCommandPlaceHolder = require('./commandplaceholder');
import EtCodeMirrorViewer = require('./viewers/codemirrorviewer');
import EtCodeMirrorViewerTypes = require('./viewers/codemirrorviewertypes');
import EtMarkdownViewer = require('./viewers/markdownviewer');
import Logger = require('./logger');

import domutils = require('./domutils');
import termjs = require('./term');
import CbScrollbar = require('./gui/scrollbar');
import util = require('./gui/util');
import clipboard = require('clipboard');
import webipc = require('./webipc');
import globalcss = require('./gui/globalcss');
import virtualscrollarea = require('./virtualscrollarea');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type ScrollableElement = VirtualScrollable & HTMLElement;

const debug = true;
let startTime: number = window.performance.now();
let registered = false;

const ID = "EtTerminalTemplate";
const EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
const SEMANTIC_TYPE = "data-extraterm-type";
const SEMANTIC_VALUE = "data-extraterm-value";
const ID_SCROLL_AREA = "scroll_area";
const ID_SCROLLBAR = "scrollbar";
const ID_CONTAINER = "terminal_container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

const CLASS_SELECTION_MODE = "selection-mode";

const SCROLL_STEP = 1;

const enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_HTML = 1,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3,
  APPLICATION_MODE_REQUEST_FRAME = 4,
  APPLICATION_MODE_SHOW_MIME = 5,
}

interface VirtualHeight {
  realHeight: number;
  virtualHeight: number;
  element: EtCodeMirrorViewer;
}

const enum Mode {
  TERMINAL,
  SELECTION
}

/**
 * Create a new terminal.
 * 
 * A terminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 * 
 * See startUp().
 * 
 * @param {type} parentElement The DOM element under which the terminal will
 *     be placed.
 * @returns {Terminal}
 */
class EtTerminal extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static TAG_NAME = "et-terminal";
  
  static EVENT_USER_INPUT = "user-input";
  
  static EVENT_TERMINAL_RESIZE = "terminal-resize";
  
  static EVENT_TITLE = "title";
  
  static EVENT_EMBEDDED_VIEWER_POP_OUT = "viewer-pop-out";
  
  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      CbScrollbar.init();
      EtEmbeddedViewer.init();
      EtCommandPlaceHolder.init();
      EtCodeMirrorViewer.init();
      EtMarkdownViewer.init();
      window.document.registerElement(EtTerminal.TAG_NAME, {prototype: EtTerminal.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;

  private _virtualScrollArea: virtualscrollarea.VirtualScrollArea;
  
  private _scrollSyncLaterHandle: util.LaterHandle;
  private _autoscroll: boolean;
  
  private _codeMirrorTerminal: EtCodeMirrorViewer;
  private _terminalSize: ClientRect;
  private _scrollYOffset: number; // The Y scroll offset into the virtual height.
  private _virtualHeight: number; // The virtual height of the terminal contents in px.
  private _vpad: number;
  
  private _emulator: termjs.Emulator;
  private _htmlData: string;
  
  private _mimeType: string;
  private _mimeData: string;
  
  private _applicationMode: ApplicationMode;
  private _bracketStyle: string;
  private _lastBashBracket: string;
  
  private _mode: Mode;
  private _selectionPreviousLineCount: number;
  
  private _blinkingCursor: boolean;
  private _title: string;
  private _noFrameCommands: RegExp[];
  
  private _tagCounter: number;
  private _themeCssPath: string;
  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: util.LaterHandle;
  private _elementAttached: boolean;
  
  private _scheduleLaterHandle: util.LaterHandle;
  private _scheduledCursorUpdates: EtCodeMirrorViewer[];
  private _scheduledResize: boolean;

  // The current size of the emulator. This is used to detect changes in size.
  private _columns = -1;
  private _rows = -1;

  private _initProperties(): void {
    this._log = new Logger(EtTerminal.TAG_NAME);
    this._virtualScrollArea = null;
    this._elementAttached = false;
    this._scrollSyncLaterHandle = null;
    this._autoscroll = true;
    this._emulator = null;
    this._codeMirrorTerminal = null;
    this._htmlData = null;
    this._mimeType = null;
    this._mimeData = null;
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
    this._bracketStyle = null;
    this._lastBashBracket = null;
    
    this._mode = Mode.TERMINAL;
    
    this._blinkingCursor = false;
    this._noFrameCommands = [];
    this._title = "New Tab";
    this._tagCounter = 0;    
    this._themeCssPath = null;
    this._mainStyleLoaded = false;
    this._themeStyleLoaded = false;
    this._resizePollHandle = null;
    this._terminalSize = null;
    this._scrollYOffset = 0;
    this._virtualHeight = 0;
    this._vpad = 0;

    this._scheduleLaterHandle = null;
    this._scheduledCursorUpdates = [];
    this._scheduledResize = false;
  }
  
  //-----------------------------------------------------------------------
  //
  //   ######                                
  //   #     # #    # #####  #      #  ####  
  //   #     # #    # #    # #      # #    # 
  //   ######  #    # #####  #      # #      
  //   #       #    # #    # #      # #      
  //   #       #    # #    # #      # #    # 
  //   #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------
  
  /**
   * Blinking cursor
   * 
   * True means the cursor should blink, otherwise it doesn't.
   */
  set blinkingCursor(blink: boolean) {
    // this._blinkingCursor = blink;
    // if (this._term !== null) {
    //   this._term.setCursorBlink(blink);
    // }
  }
  
  set themeCssPath(path: string) {
    this._themeCssPath = path;
    const themeCss = fs.readFileSync(path, {encoding: 'utf8'});
    const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    themeTag.innerHTML = globalcss.stripFontFaces(themeCss);
  }
  
  set noFrameCommands(commandList: string[]) {
    if (commandList === null) {
      this._noFrameCommands = [];
      return;
    }
    
    this._noFrameCommands = commandList.map( exp => new RegExp(exp) );
  }
  
  private _isNoFrameCommand(commandLine: string): boolean {
    const cmd = commandLine.trim();
    if (cmd === "") {
      return true;
    }
    return this._noFrameCommands.some( exp => exp.test(cmd) );
  }
  
  /**
   * Get this terminal's title.
   *
   * This is the window title of the terminal, don't confuse it with more
   * general HTML title of the element.
   */
  get terminalTitle(): string {
    return this._title;
  }
  
  /**
   * Destroy the terminal.
   */
  destroy(): void {
    if (this._scrollSyncLaterHandle !== null) {
      this._scrollSyncLaterHandle.cancel();
    }

    if (this._resizePollHandle !== null) {
      this._resizePollHandle.cancel();
      this._resizePollHandle = null;
    }

    this._getWindow().removeEventListener('resize', this._scheduleResize.bind(this));
    if (this._emulator !== null) {
      this._emulator.destroy();
    }
    this._emulator = null;
  }

  /**
   * Focus on this terminal.
   */
  focus(): void {
    if (this._codeMirrorTerminal !== null) {
      this._codeMirrorTerminal.focus();
    }
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    if (this._codeMirrorTerminal !== null) {
      return this._codeMirrorTerminal.hasFocus();
    } else {
      return false;
    }
  }
  
  /**
   * Write data to the terminal screen.
   * 
   * @param text the stream of data to write.
   */
  write(text: string): void {
    this._emulator.write(text);
  }
  
  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  send(text: string): void {
    this._sendDataToPtyEvent(text);
  }
    
  resizeToContainer(): void {
    this._scheduleResize();
  }
  
  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------

  createdCallback(): void {
    this._initProperties();
  }
   
  attachedCallback(): void {
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    const shadow = util.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);
    this._virtualScrollArea = new virtualscrollarea.VirtualScrollArea();

    // util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
    //   this._mainStyleLoaded = true;
    //   this._handleStyleLoad();
    // });
    // 
    // util.getShadowId(this, ID_THEME_STYLE).addEventListener('load', () => {
    //   this._themeStyleLoaded = true;
    //   this._handleStyleLoad();
    //   });

    this.addEventListener('focus', this._handleFocus.bind(this));
    this.addEventListener('blur', this._handleBlur.bind(this));

    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    
    this._virtualScrollArea.setScrollContainer(scrollerArea);
    this._virtualScrollArea.setScrollbar(scrollbar);
    
    // Set up the emulator
    const cookie = crypto.randomBytes(10).toString('hex');
    process.env[EXTRATERM_COOKIE_ENV] = cookie;
    this._initEmulator(cookie);
    this._appendNewCodeMirrorTerminal();

    // FIXME there might be resizes for things other than changs in window size.
    this._getWindow().addEventListener('resize', this._scheduleResize.bind(this));
    
    scrollerArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === scrollerArea) {
        this._codeMirrorTerminal.focus();
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.position);
    });

    scrollerArea.addEventListener('wheel', this._handleMouseWheel.bind(this), true);
    scrollerArea.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDown.bind(this));
    scrollerArea.addEventListener('keypress', this._handleKeyPressCapture.bind(this), true);

    scrollerArea.addEventListener(virtualscrollarea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(EtCodeMirrorViewer.EVENT_KEYBOARD_ACTIVITY, () => {
      this._virtualScrollArea.scrollToBottom();
    });
    scrollerArea.addEventListener(EtCodeMirrorViewer.EVENT_BEFORE_SELECTION_CHANGE,
      this._handleBeforeSelectionChange.bind(this));

    this._emulator.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');
    this._scheduleResize();
  }
  
  //-----------------------------------------------------------------------
  //
  //   ######                                      
  //   #     # #####  # #    #   ##   ##### ###### 
  //   #     # #    # # #    #  #  #    #   #      
  //   ######  #    # # #    # #    #   #   #####  
  //   #       #####  # #    # ######   #   #      
  //   #       #   #  #  #  #  #    #   #   #      
  //   #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  
  private _createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      const background_color = "#000000";

      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
        }
        
        #${ID_CONTAINER} {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
        }

        #${ID_SCROLLBAR} {
            flex: 0;
            min-width: 15px;
            height: 100%;
        }
        
        #${ID_SCROLL_AREA} {
          flex: 1;
          height: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
          background-color: ${background_color};
        }
      
        #${ID_SCROLL_AREA} > ${EtCodeMirrorViewer.TAG_NAME} {
            margin-left: 2px;
            margin-right: 2px;
        }
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_AREA}'></div>
          <cb-scrollbar id='${ID_SCROLLBAR}'></cb-scrollbar>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * Get the window which this terminal is on.
   * 
   * @returns {Window} The window object.
   */
  private _getWindow(): Window {
    return this.ownerDocument.defaultView;  
  }
  
  private _getDocument(): Document {
    return this.ownerDocument;
  }
  
  private _handleFocus(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear focused.
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    util.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.visualState = ViewerElement.VISUAL_STATE_FOCUSED;
      }
    });
  }
  
  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    util.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.visualState = ViewerElement.VISUAL_STATE_UNFOCUSED;
      }
    });
  }
  
  private _handleBeforeSelectionChange(ev: CustomEvent): void {
    const target = ev.target;
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    util.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node) && node !== target) {
        node.clearSelection();
      }
    });
  }
  
  // ----------------------------------------------------------------------
  //
  // #######                                                 
  // #       #    # #    # #        ##   #####  ####  #####  
  // #       ##  ## #    # #       #  #    #   #    # #    # 
  // #####   # ## # #    # #      #    #   #   #    # #    # 
  // #       #    # #    # #      ######   #   #    # #####  
  // #       #    # #    # #      #    #   #   #    # #   #  
  // ####### #    #  ####  ###### #    #   #    ####  #    # 
  //                                                         
  // ----------------------------------------------------------------------

  private _initEmulator(cookie: string): void {
    const emulator = new termjs.Emulator({
      scrollback: 1000,
      cursorBlink: this._blinkingCursor,
      physicalScroll: true,
      applicationModeCookie: cookie,
      debug: true
    });
    
    emulator.debug = true;
    emulator.addTitleChangeEventListener(this._handleTitle.bind(this));
    emulator.addDataEventListener(this._handleTermData.bind(this));
    emulator.addRenderEventListener(this._handleTermSize.bind(this));
    
    // Application mode handlers    
    emulator.addApplicationModeStartEventListener(this._handleApplicationModeStart.bind(this));
    emulator.addApplicationModeDataEventListener(this._handleApplicationModeData.bind(this));
    emulator.addApplicationModeEndEventListener(this._handleApplicationModeEnd.bind(this));
    
    this._emulator = emulator;
  }

  private _appendNewCodeMirrorTerminal(): void {
    // Create the CodeMirrorTerminal
    const codeMirrorTerminal = <EtCodeMirrorViewer> document.createElement(EtCodeMirrorViewer.TAG_NAME);
    
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(codeMirrorTerminal);
    
    codeMirrorTerminal.addEventListener(EtCodeMirrorViewer.EVENT_CURSOR_MOVE, this._handleCodeMirrorCursor.bind(this));
    codeMirrorTerminal.visualState = util.getShadowRoot(this).activeElement !== null
                                      ? ViewerElement.VISUAL_STATE_FOCUSED
                                      : ViewerElement.VISUAL_STATE_UNFOCUSED;
    codeMirrorTerminal.emulator = this._emulator;
    this._virtualScrollArea.appendScrollable(codeMirrorTerminal);

    this._codeMirrorTerminal = codeMirrorTerminal;
    this._emulator.refreshScreen();
  }

  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  private _handleTitle(emulator: termjs.Emulator, title: string): void {
    this._title = title;
    this._sendTitleEvent(title);
  }
  
  private _disconnectActiveCodeMirrorTerminal(): void {
    this._emulator.moveRowsToScrollback();
    if (this._codeMirrorTerminal !== null) {
      this._codeMirrorTerminal.emulator = null;
      this._codeMirrorTerminal.deleteScreen();
      this._codeMirrorTerminal.useVPad = false;
      this._virtualScrollArea.updateScrollableSize(this._codeMirrorTerminal);
      this._codeMirrorTerminal = null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    this._disconnectActiveCodeMirrorTerminal();
    
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }
  
  private _removeScrollableElement(el: ScrollableElement): void {
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.removeChild(el);
    this._virtualScrollArea.removeScrollable(el);
  }

  private _replaceScrollableElement(oldEl: ScrollableElement, newEl: ScrollableElement): void {
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.insertBefore(newEl, oldEl);
    scrollerArea.removeChild(oldEl);
    this._virtualScrollArea.replaceScrollable(oldEl, newEl);
  }

  private _handleMouseDown(ev: MouseEvent): void {
    if (ev.buttons === 4) { // Middle mouse button
      ev.stopPropagation();
      ev.preventDefault();
      this._pasteFromClipboard();
    }
  }
  
  /**
   * Handle new stdout data from the pty.
   * 
   * @param {string} data New data.
   */
  private _handlePtyStdoutData (data: string): void {
// log("incoming data:",""+data);
    this._emulator.write("" + data);
  }

  /**
   * Handle new stderr data from the pty.
   * 
   * @param {type} data New data.
   */
  private _handlePtyStderrData(data: string): void {
    this._emulator.write(data);
  }

  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  private _handleTermData(emulator: termjs.Emulator, data: string): void {
    this._sendDataToPtyEvent(data);
  }
  
  private _handleTermSize(emulator: termjs.Emulator, event: termjs.RenderEvent): void {
    const newColumns = event.columns;
    const newRows = event.rows;
    if (this._columns === newColumns && this._rows === newRows) {
      return;
    }
    this._columns = newColumns;
    this._rows = newRows;
    this._sendResizeEvent(newColumns, newRows);
  }
  
  /**
   * Send data to the pseudoterminal.
   * 
   * @param {string} text
   */
  private _sendDataToPtyEvent(text: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_USER_INPUT, { detail: {data: text } });
    this.dispatchEvent(event);
  }

  /**
   * Send a resize message to the pty.
   * 
   * @param {number} cols The new number of columns in the terminal.
   * @param {number} rows The new number of rows in the terminal.
   */
  private _sendResizeEvent(cols: number, rows: number, callback?: Function): void {
    const event = new CustomEvent(EtTerminal.EVENT_TERMINAL_RESIZE, { detail: {columns: cols, rows: rows } });
    this.dispatchEvent(event);    
  }

  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_TITLE, { detail: {title: title } });
    this.dispatchEvent(event);    
  }
  
  private _enterSelectionMode(): void {
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    util.nodeListToArray(scrollerArea.childNodes).forEach( (node) => {
      if (ViewerElement.isViewerElement(node)) {
        node.mode = ViewerElementTypes.Mode.SELECTION;
      }
    });
    this._mode = Mode.SELECTION;
    if (util.getShadowRoot(this).activeElement !== this._codeMirrorTerminal) {
      this._codeMirrorTerminal.focus();
    }
  }
  
  private _exitSelectionMode(): void {
    const scrollerArea = util.getShadowId(this, ID_SCROLL_AREA);
    util.nodeListToArray(scrollerArea.childNodes).forEach( (node) => {
      if (ViewerElement.isViewerElement(node)) {
        node.mode = ViewerElementTypes.Mode.DEFAULT;
      }
    });
    this._mode = Mode.TERMINAL;
  }
  
  // ----------------------------------------------------------------------
  //
  //    #####                                                          ##        #####                           
  //   #     #  ####  #####   ####  #      #      # #    #  ####      #  #      #     # # ###### # #    #  ####  
  //   #       #    # #    # #    # #      #      # ##   # #    #      ##       #       #     #  # ##   # #    # 
  //    #####  #      #    # #    # #      #      # # #  # #          ###        #####  #    #   # # #  # #      
  //         # #      #####  #    # #      #      # #  # # #  ###    #   # #          # #   #    # #  # # #  ### 
  //   #     # #    # #   #  #    # #      #      # #   ## #    #    #    #     #     # #  #     # #   ## #    # 
  //    #####   ####  #    #  ####  ###### ###### # #    #  ####      ###  #     #####  # ###### # #    #  ####  
  //
  // ----------------------------------------------------------------------
  private _handleMouseWheel(ev: WheelEvent): void {
    const delta = ev.deltaY * SCROLL_STEP;
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset() + delta);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    this._updateVirtualScrollableSize(<any> ev.target); 
      // ^ We know this event only comes from VirtualScrollable elements.
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
  }

  /**
   * Handle a resize event from the window.
   */
  private _processResize(): void {
    if (this._codeMirrorTerminal !== null) {
      this._codeMirrorTerminal.resizeEmulatorToParentContainer();
    }
    this._virtualScrollArea.resize();
    this._updateVirtualScrollableSize(this._codeMirrorTerminal);
  }

  private _handleCodeMirrorCursor(ev: CustomEvent): void {
    const pos = this._codeMirrorTerminal.getCursorPosition();
    this._virtualScrollArea.scrollIntoView(pos.top, pos.bottom);
  }

  // ----------------------------------------------------------------------
  //
  //   #    #                                                 
  //   #   #  ###### #   # #####   ####    ##   #####  #####  
  //   #  #   #       # #  #    # #    #  #  #  #    # #    # 
  //   ###    #####    #   #####  #    # #    # #    # #    # 
  //   #  #   #        #   #    # #    # ###### #####  #    # 
  //   #   #  #        #   #    # #    # #    # #   #  #    # 
  //   #    # ######   #   #####   ####  #    # #    # #####  
  //                                                        
  // ----------------------------------------------------------------------

  private _handleKeyDownCapture(ev: KeyboardEvent): void {
    if (this._codeMirrorTerminal === null) {
      return;
    }
    
    switch (this._mode) {
      case Mode.TERMINAL:
        // Enter selection mode.
        if (ev.keyCode === 32 && ev.ctrlKey) {
          this._enterSelectionMode();
          ev.stopPropagation();
          return;
        }
        break;

      case Mode.SELECTION:
        // Exit Selection mode. Esc or Ctrl+Space toggle.
        if (ev.keyCode === 32 && ev.ctrlKey) {
          this._exitSelectionMode();
          ev.stopPropagation();
          return;
        }      
        break;
    }
    
    if (this._mode !== Mode.SELECTION && ev.target !== this._codeMirrorTerminal) {
      // Route the key down to the current code mirror terminal which has the emulator attached.
      const simulatedKeydown = domutils.newKeyboardEvent('keydown', ev);
      ev.stopPropagation();
      if ( ! this._codeMirrorTerminal.dispatchEvent(simulatedKeydown)) {
        // Cancelled.
        ev.preventDefault();
      }
    }
  }

  private _handleKeyPressCapture(ev: KeyboardEvent): void {
    if (this._codeMirrorTerminal === null) {
      return;
    }

    if (this._mode !== Mode.SELECTION && ev.target !== this._codeMirrorTerminal) {
      // Route the key down to the current code mirror terminal which has the emulator attached.
      const simulatedKeypress = domutils.newKeyboardEvent('keypress', ev);
      ev.preventDefault();
      ev.stopPropagation();
      if ( ! this._codeMirrorTerminal.dispatchEvent(simulatedKeypress)) {
        // Cancelled.
        ev.preventDefault();
      }
    }
  }
  
  /**
   * Handle an unknown key down event coming up from the term.
   */
  private _handleKeyDown(ev: KeyboardEvent): void {
    if (ev.keyCode === 33 && ev.shiftKey) {
      // page up
      this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
        - this._virtualScrollArea.getScrollContainerHeight() / 2);
      
    } else if (ev.keyCode === 34 && ev.shiftKey) {
      // page down
      this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
        + this._virtualScrollArea.getScrollContainerHeight() / 2);

    } else if (ev.keyCode === 67 && ev.ctrlKey){
      // Shift+Ctrl+C
      this.copyToClipboard();
      
    } else if (ev.keyCode === 86 && ev.ctrlKey) {
      // Shift+Ctrl+V
      this._pasteFromClipboard();

    } else {
      // log("keyDown: ", ev);
      
      return;
    }
    ev.stopPropagation();
  }

  // private _handleKeyPressTerminal(ev: KeyboardEvent): void {
    // this._term.keyPress(ev);
  // }

  // private _handleKeyDownTerminal(ev: KeyboardEvent): void {
  //   let frames: EtEmbeddedViewer[];
  //   let index: number;
    
    // Key down on a command frame.
    // if ((<HTMLElement>ev.target).tagName === EtEmbeddedViewer.TAG_NAME) {
    //   if (ev.keyCode === 27) {
    //     // 27 = esc.
    //     this._term.element.focus();
    //     this._term.scrollToBottom();
    //     ev.preventDefault();
    //     return;
    // 
    //   } else if (ev.keyCode === 32 && ev.ctrlKey) {
    //     // 32 = space
    //     (<EtEmbeddedViewer>ev.target).openMenu();
    //     ev.preventDefault();
    //     return;
    // 
    //   } else if (ev.keyCode === 38) {
    //     // 38 = up arrow.
    // 
    //     // Note ugly convert-to-array code. ES6 Array.from() help us!
    //     frames = Array.prototype.slice.call(this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME));
    //     index = frames.indexOf(<EtEmbeddedViewer>ev.target);
    //     if (index > 0) {
    //       frames[index-1].focusLast();
    //     }
    //     ev.preventDefault();
    //     return;
    // 
    //   } else if (ev.keyCode === 40) {
    //     // 40 = down arrow.
    // 
    //     frames = Array.prototype.slice.call(this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME));
    //     index = frames.indexOf(<EtEmbeddedViewer>ev.target);
    //     if (index < frames.length -1) {
    //       frames[index+1].focusFirst();
    //     }
    //     ev.preventDefault();
    //     return;
    //   }
    // 
    // } else if (ev.target === this._term.element) {
    //   // In normal typing mode.
    // 
    //   // Enter cursor mode.
    //   if (ev.keyCode === 38 && ev.shiftKey) {
    //     // Shift + Up arrow.
    //     const lastFrame = <EtEmbeddedViewer>this._term.element.querySelector(EtEmbeddedViewer.TAG_NAME + ":last-of-type");
    //     if (lastFrame !== null) {
    //       lastFrame.focusLast();
    //     }
    //     ev.preventDefault();
    //     return;
    //   }
    // }
    // if (this._mode === Mode.TERM) {
    //   this._term.keyDown(ev);
    // }
  // }


  // ********************************************************************
  //
  //    #####                                                            
  //   #     #  ####  #    # ###### #####  #    # #      # #    #  ####  
  //   #       #    # #    # #      #    # #    # #      # ##   # #    # 
  //    #####  #      ###### #####  #    # #    # #      # # #  # #      
  //         # #      #    # #      #    # #    # #      # #  # # #  ### 
  //   #     # #    # #    # #      #    # #    # #      # #   ## #    # 
  //    #####   ####  #    # ###### #####   ####  ###### # #    #  ####  
  //
  // ********************************************************************
  
  /**
   * Schedule a cursor update to done later.
   * 
   * @param {EtCodeMirrorViewer} updateTarget [description]
   */
  // private _scheduleCursorMoveUpdate(updateTarget: EtCodeMirrorViewer): void {
  //   this._scheduleProcessing();
  //   
  //   if (this._scheduledCursorUpdates.some( (cmv) => cmv === updateTarget)) {
  //     return;
  //   }
  //   this._scheduledCursorUpdates.push(updateTarget);
  // }
  
  private _scheduleResize(): void {
    this._scheduleProcessing();
    this._scheduledResize = true;
  }
  
  private _scheduleProcessing(): void {
    if (this._scheduleLaterHandle === null) {
      this._scheduleLaterHandle = util.doLater(this._processScheduled.bind(this));
    }
  }
  
  private _processScheduled(): void {
    this._scheduleLaterHandle = null;
    
    // Make copies of all of the control variables.
    const scheduledResize = this._scheduledResize;
    this._scheduledResize = false;
    const scheduledCursorUpdates = this._scheduledCursorUpdates;
    this._scheduledCursorUpdates = [];
    
    if (scheduledResize) {
      this._processResize();
    }    
  }

  // ********************************************************************
  //
  //      #                                                                  #     #                      
  //     # #   #####  #####  #      #  ####    ##   ##### #  ####  #    #    ##   ##  ####  #####  ###### 
  //    #   #  #    # #    # #      # #    #  #  #    #   # #    # ##   #    # # # # #    # #    # #      
  //   #     # #    # #    # #      # #      #    #   #   # #    # # #  #    #  #  # #    # #    # #####  
  //   ####### #####  #####  #      # #      ######   #   # #    # #  # #    #     # #    # #    # #      
  //   #     # #      #      #      # #    # #    #   #   # #    # #   ##    #     # #    # #    # #      
  //   #     # #      #      ###### #  ####  #    #   #   #  ####  #    #    #     #  ####  #####  ###### 
  //
  // ********************************************************************

  /**
   * Handle when the embedded term.js enters start of application mode.
   * 
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  private _handleApplicationModeStart(emulator: termjs.Emulator, params: string[]): void {
    this._log.debug("application-mode started! ",params);
    
    // FIXME check cookie!
  
    if (params.length === 1) {
      // Normal HTML mode.
      this._applicationMode = ApplicationMode.APPLICATION_MODE_HTML;
  
    } else if(params.length >= 2) {
      switch ("" + params[1]) {
        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
          this._bracketStyle = params[2];
          break;
  
        case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
          this._log.debug("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          this._log.debug("Starting APPLICATION_MODE_REQUEST_FRAME");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_SHOW_MIME:
          this._log.debug("Starting APPLICATION_MODE_SHOW_MIME");
          this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_MIME;
          this._mimeData = "";
          this._mimeType = params[2];
          break;
        
        default:
          this._log.debug("Unrecognized application escape parameters.");
          break;
      }
    }
    this._htmlData = "";
  }

  /**
   * Handle incoming data while in application mode.
   * 
   * @param {string} data The new data.
   */
  private _handleApplicationModeData(data: string): void {
    this._log.debug("html-mode data!", data);
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this._htmlData = this._htmlData + data;
        break;
        
      case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
        this._mimeData = this._mimeData + data;
        break;
        
      default:
        break;
    }
  }
  
  /**
   * Handle the exit from application mode.
   */
  private _handleApplicationModeEnd(): void {
    let el: HTMLElement;
    let startdivs: NodeList;
    
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_HTML:
        // el = this._getWindow().document.createElement("div");
        // el.innerHTML = this._htmlData;
        // this._appendElementToScrollArea(el);
        break;
  
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
        this._handleApplicationModeBracketStart();
        break;
  
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
        this._handleApplicationModeBracketEnd();
        break;
  
      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this.handleRequestFrame(this._htmlData);
        break;
        
      case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
        this._handleShowMimeType(this._mimeType, this._mimeData);
        this._mimeType = "";
        this._mimeData = "";
        break;
        
      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  
    this._log.debug("html-mode end!",this._htmlData);
    this._htmlData = null;
  }

  private _handleApplicationModeBracketStart(): void {
    const scrollArea = util.getShadowId(this, ID_SCROLL_AREA);
    const startdivs = scrollArea.querySelectorAll(
                        EtEmbeddedViewer.TAG_NAME + ":not([return-code]), "+EtCommandPlaceHolder.TAG_NAME);
  
    if (startdivs.length !== 0) {
      return;  // Don't open a new frame.
    }
    
    // Fetch the command line.
    let cleancommand = this._htmlData;
    if (this._bracketStyle === "bash") {
      // Bash includes the history number. Remove it.
      const trimmed = this._htmlData.trim();
      cleancommand = trimmed.slice(trimmed.indexOf(" ")).trim();
    }
    
    if ( ! this._isNoFrameCommand(cleancommand)) {
      // Create and set up a new command-frame.
      const el = this._createEmbeddedViewerElement(cleancommand);
      this._appendScrollableElement(el);
      this._appendNewCodeMirrorTerminal();
    } else {
            
      // Don't place an embedded viewer, but use an invisible place holder instead.
      const el = <EtCommandPlaceHolder> this._getWindow().document.createElement(EtCommandPlaceHolder.TAG_NAME);
      el.setAttribute(EtCommandPlaceHolder.ATTR_COMMAND_LINE, cleancommand);
      this._appendScrollableElement(el);
      this._appendNewCodeMirrorTerminal();
    }
    this._virtualScrollArea.resize();
  }
  
  private _deleteEmbeddedViewer(viewer: EtEmbeddedViewer): void {
    viewer.remove();
    this._virtualScrollArea.removeScrollable(viewer);
  }
  
  private _createEmbeddedViewerElement(commandLine: string): EtEmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EtEmbeddedViewer> this._getWindow().document.createElement(EtEmbeddedViewer.TAG_NAME);

    el.addEventListener(EtEmbeddedViewer.EVENT_CLOSE_REQUEST, () => {
      this._deleteEmbeddedViewer(el);
      this.focus();
    });

    el.addEventListener(EtEmbeddedViewer.EVENT_TYPE, (ev: CustomEvent) => {
      this._sendDataToPtyEvent(ev.detail);
    });

    el.addEventListener(EtEmbeddedViewer.EVENT_FRAME_POP_OUT, (ev: CustomEvent) => {
      this._embeddedViewerPopOutEvent(<EtEmbeddedViewer>ev.srcElement);
      ev.stopPropagation();
    });

    // el.addEventListener('copy-clipboard-request', (function(ev: CustomEvent) {
    //   var clipboard = gui.Clipboard.get();
    //   clipboard.set(ev.detail, 'text');
    // }).bind(this));
// FIXME
    
    el.visualState = util.getShadowRoot(this).activeElement !== null
                                      ? ViewerElement.VISUAL_STATE_FOCUSED
                                      : ViewerElement.VISUAL_STATE_UNFOCUSED;
    el.setAttribute(EtEmbeddedViewer.ATTR_COMMAND, commandLine);
    el.setAttribute(EtEmbeddedViewer.ATTR_TAG, "" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    this._closeLastEmbeddedViewer(this._htmlData);    
  }
  
  private _closeLastEmbeddedViewer(returnCode: string): void {
    const scrollArea = util.getShadowId(this, ID_SCROLL_AREA);
    const startElement = scrollArea.querySelectorAll(
      `${EtEmbeddedViewer.TAG_NAME}:not([${EtEmbeddedViewer.ATTR_RETURN_CODE}]), ${EtCommandPlaceHolder.TAG_NAME}`);
    
    if (startElement.length !== 0) {
      let embeddedSomethingElement = <HTMLElement>startElement[startElement.length-1];
      let embeddedViewerElement: EtEmbeddedViewer = null;
      if (EtCommandPlaceHolder.is(embeddedSomethingElement)) {
        // There is a place holder and not an embedded viewer.
        if (returnCode === "0") {
          // The command returned successful, just remove the place holder and that is it.
          this._removeScrollableElement(embeddedSomethingElement);
          return;
        } else {
          // The command went wrong. Replace the place holder with a real viewer
          // element and pretend that we had done this when the command started running.
          const newViewerElement = this._createEmbeddedViewerElement(
                                      embeddedSomethingElement.getAttribute(EtCommandPlaceHolder.ATTR_COMMAND_LINE));
          this._replaceScrollableElement(embeddedSomethingElement, newViewerElement);
          embeddedViewerElement = newViewerElement;
        }
      } else {
        embeddedViewerElement = <EtEmbeddedViewer> embeddedSomethingElement;
      }
      
      const activeCodeMirrorTerminal = this._codeMirrorTerminal;
      this._disconnectActiveCodeMirrorTerminal();
      
      activeCodeMirrorTerminal.returnCode = returnCode;
      activeCodeMirrorTerminal.commandLine = embeddedViewerElement.getAttribute(EtEmbeddedViewer.ATTR_COMMAND);
      activeCodeMirrorTerminal.useVPad = false;
      
      // Hang the terminal viewer under the Embedded viewer.
      embeddedViewerElement.setAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE, returnCode);
      embeddedViewerElement.className = "extraterm_output";
      
      // Some focus management to make sure that activeCodeMirrorTerminal still keeps
      // the focus after we remove it from the DOM and place it else where.
      const restoreFocus = util.getShadowRoot(this).activeElement === activeCodeMirrorTerminal;
      const previousActiveTerminal = activeCodeMirrorTerminal;
      
      embeddedViewerElement.viewerElement = activeCodeMirrorTerminal;
      this._virtualScrollArea.removeScrollable(activeCodeMirrorTerminal);
      this._virtualScrollArea.updateScrollableSize(embeddedViewerElement);
      this._appendNewCodeMirrorTerminal();
      
      if (restoreFocus) {
        previousActiveTerminal.focus();
      }
    }
  }

  // ********************************************************************
  //
  //   #     #                 
  //   ##   ## #  ####   ####  
  //   # # # # # #      #    # 
  //   #  #  # #  ####  #      
  //   #     # #      # #      
  //   #     # # #    # #    # 
  //   #     # #  ####   ####  
  //
  // ********************************************************************

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    const text = this._codeMirrorTerminal.getSelectionText();
    if (text !== null) {
      webipc.clipboardWrite(text);
    }
  }
  
  pasteText(text: string): void {
    this.send(text);
  }

  /**
   * Paste text from the clipboard.
   *
   * This method is async and returns before the paste is done.
   */
  private _pasteFromClipboard(): void {
    webipc.clipboardReadRequest();
  }

  
  private _embeddedViewerPopOutEvent(viewerElement: EtEmbeddedViewer): void {
    const event = new CustomEvent(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT,
      { detail: { terminal: this, embeddedViewer: viewerElement} });
    this.dispatchEvent(event);
  }
  
  private handleRequestFrame(frameId: string): void {
    const sourceFrame: EtEmbeddedViewer = this._findFrame(frameId);
    const data = sourceFrame !== null ? sourceFrame.text : "";
    const lines = data.split("\n");
    let encodedData: string = "";
    lines.forEach( (line: string) => {
      encodedData = window.btoa(line +"\n");
      this._sendDataToPtyEvent(encodedData+"\n");
    });
      
    this._sendDataToPtyEvent("\x04");
    
    if (encodedData.length !== 0) {
      this._sendDataToPtyEvent("\x04");
    }
  }

  private _handleShowMimeType(mimeType: string, mimeData: string): void {
    const mimeViewerElement = this._createMimeViewer(mimeType, mimeData);
    if (mimeViewerElement !== null) {
      this._closeLastEmbeddedViewer("0");
      const viewerElement = this._createEmbeddedViewerElement("viewer");
      viewerElement.viewerElement = mimeViewerElement;
      this._appendScrollableElement(viewerElement);
    }
  }

  private _createMimeViewer(mimeType: string, mimeData: string): ViewerElement {
    if (mimeType === "text/markdown") {
      const win = this._getWindow();
      const markdownViewerElement = <EtMarkdownViewer> win.document.createElement(EtMarkdownViewer.TAG_NAME);
      const decodedMimeData = window.atob(mimeData);
      markdownViewerElement.appendChild(win.document.createTextNode(decodedMimeData));
      return markdownViewerElement;
    } else {
      this._log.debug("Unknown mime type: " + mimeType);
      return null;
    }
  }

  /**
   * Find a command frame by ID.
   */
  private _findFrame(frameId: string): EtEmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    
    const scrollArea = util.getShadowId(this, ID_SCROLL_AREA);
    const matches = scrollArea.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  }
  
  private _getNextTag(): number {
    this._tagCounter++;
    return this._tagCounter;
  }
}

export = EtTerminal;
