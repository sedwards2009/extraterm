/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import _  = require('lodash');
import fs  = require('fs');
import crypto = require('crypto');
import ViewerElement = require("./viewerelement");
import EtEmbeddedViewer = require('./embeddedviewer');
import EtCommandPlaceHolder = require('./commandplaceholder');
import EtCodeMirrorViewer = require('./viewers/codemirrorviewer');
import EtCodeMirrorViewerTypes = require('./viewers/codemirrorviewertypes');
import EtMarkdownViewer = require('./viewers/markdownviewer');

import domutils = require('./domutils');
import termjs = require('./term');
import CbScrollbar = require('./gui/scrollbar');
import util = require('./gui/util');
import clipboard = require('clipboard');
import webipc = require('./webipc');
import globalcss = require('./gui/globalcss');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type CursorMoveDetail = EtCodeMirrorViewerTypes.CursorMoveDetail;

const debug = true;
let startTime: number = window.performance.now();
let registered = false;

function log(...msgs: any[]): void {
  if (debug) {
    const offset = window.performance.now() - startTime;
    const msg: string = msgs.reduce( (accu: string, value: string) => accu + value, "");
    console.timeStamp(msg);
    console.log(""+offset + ": " + msg);
  }
}

const ID = "EtTerminalTemplate";
const EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
const SEMANTIC_TYPE = "data-extraterm-type";
const SEMANTIC_VALUE = "data-extraterm-value";
const ID_TERM_CONTAINER = "term_container";
const ID_SCROLLER = "scroller";
const ID_SCROLLBACK = "scrollback_container";
const ID_SCROLLBAR = "scrollbar";
const ID_CONTAINER = "terminal_container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";
const ID_VPAD = "vpad";

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
      // EtTerminalViewer.init();
      EtCodeMirrorViewer.init();
      EtMarkdownViewer.init();
      window.document.registerElement(EtTerminal.TAG_NAME, {prototype: EtTerminal.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _scrollSyncLaterHandle: util.LaterHandle;
  private _autoscroll: boolean;
  
  private _scrollbackCodeMirror: EtCodeMirrorViewer;
  private _terminalSize: ClientRect;
  private _scrollYOffset: number; // The Y scroll offset into the virtual height.
  private _virtualHeight: number; // The virtual height of the terminal contents in px.
  private _vpad: number;
  private _lastViewPortTop: WeakMap<EtCodeMirrorViewer, number>;
  
  private _term: termjs.Terminal;
  private _htmlData: string;
  
  private _mimeType: string;
  private _mimeData: string;
  
  private _applicationMode: ApplicationMode;
  private _bracketStyle: string;
  private _lastBashBracket: string;
  
  private _selectionModeFlag: boolean;
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
  private _scheduledScrollbackImport: boolean;
  private _scheduledResize: boolean;

  private _initProperties(): void {
    this._elementAttached = false;
    this._scrollSyncLaterHandle = null;
    this._autoscroll = true;
    this._term = null;
    this._scrollbackCodeMirror = null;
    this._htmlData = null;
    this._mimeType = null;
    this._mimeData = null;
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
    this._bracketStyle = null;
    this._lastBashBracket = null;
    
    this._selectionModeFlag = false;
    
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
    this._lastViewPortTop = new WeakMap();

    this._scheduleLaterHandle = null;
    this._scheduledCursorUpdates = [];
    this._scheduledResize = false;
    this._scheduledScrollbackImport = false;
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                
  // #     # #    # #####  #      #  ####  
  // #     # #    # #    # #      # #    # 
  // ######  #    # #####  #      # #      
  // #       #    # #    # #      # #      
  // #       #    # #    # #      # #    # 
  // #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------

  createdCallback(): void {
    this._initProperties();
    const shadow = util.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);

    util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
      this._mainStyleLoaded = true;
      this._handleStyleLoad();
    });

    util.getShadowId(this, ID_THEME_STYLE).addEventListener('load', () => {
      this._themeStyleLoaded = true;
      this._handleStyleLoad();
      });

    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    const termContainer = <HTMLDivElement> util.getShadowId(this, ID_TERM_CONTAINER);
    const scroller = util.getShadowId(this, ID_SCROLLER);
    const scrollback = util.getShadowId(this, ID_SCROLLBACK);
    
    const cookie = crypto.randomBytes(10).toString('hex');
    
    process.env[EXTRATERM_COOKIE_ENV] = cookie;

    this._term = new termjs.Terminal({
      scrollback: 1000,
      cursorBlink: this._blinkingCursor,
      physicalScroll: true,
      applicationModeCookie: cookie,
      debug: true
    });

    this._term.debug = true;
    this._term.on('title', this._handleTitle.bind(this));
    this._term.on('data', this._handleTermData.bind(this));
    
    this._getWindow().addEventListener('resize', this._scheduleResize.bind(this));
    
    termContainer.addEventListener('keydown', this._handleKeyDown.bind(this));
    scroller.addEventListener('wheel', this._handleTermWheel.bind(this));
    scroller.addEventListener('keydown', this._handleScrollerKeyDown.bind(this));
    scroller.addEventListener(EtCodeMirrorViewer.EVENT_CURSOR_MOVE, this._handleCursorMove.bind(this));
    
    this._term.on(termjs.Terminal.EVENT_MANUAL_SCROLL, this._handleManualScroll.bind(this));
    this._term.on(termjs.Terminal.EVENT_SCROLLBACK_AVAILABLE, this._handleScrollbackReady.bind(this));
    
    // Application mode handlers    
    this._term.on('application-mode-start', this._handleApplicationModeStart.bind(this));
    this._term.on('application-mode-data', this._handleApplicationModeData.bind(this));
    this._term.on('application-mode-end', this._handleApplicationModeEnd.bind(this));
  }
  
  attachedCallback(): void {
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    const termContainer = <HTMLDivElement> util.getShadowId(this, ID_TERM_CONTAINER);
    this._term.open(termContainer);
    this._term.element.addEventListener('keypress', this._handleKeyPressTerminal.bind(this));
    this._term.element.addEventListener('keydown', this._handleKeyDownTerminal.bind(this));
    this._term.on(termjs.Terminal.EVENT_WHEEL, this._handleTermWheel.bind(this));
    
    termContainer.addEventListener('mousedown', this._handleMouseDownTermOnCapture.bind(this), true);
    termContainer.addEventListener('mousedown', this._handleMouseDownTerm.bind(this));
    
    this._term.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');
    
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._autoscroll = ev.detail.isBottom;
      this._scrollTo(scrollbar.position);
    });
  
    this._syncScrolling();

    this._scheduleResize();
  }
  
  /**
   * Blinking cursor
   * 
   * True means the cursor should blink, otherwise it doesn't.
   */
  set blinkingCursor(blink: boolean) {
    this._blinkingCursor = blink;
    if (this._term !== null) {
      this._term.setCursorBlink(blink);
    }
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

    if (this._term !== null) {
      this._getWindow().removeEventListener('resize', this._scheduleResize.bind(this));
      this._term.destroy();
    }
    this._term = null;
  }

  /**
   * Focus on this terminal.
   */
  focus(): void {
    if (this._term !== null) {
      this._term.focus();
    }
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    return this._term === null ? false : this._term.hasFocus();
  }
  
  /**
   * Write data to the terminal screen.
   * 
   * @param text the stream of data to write.
   */
  write(text: string): void {
    if (this._term !== null) {
      this._term.write(text);
      this._syncScrolling();
    }
  }
  
  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  send(text: string): void {
    if (this._term !== null) {
      this._sendDataToPtyEvent(text);
    }
  }
    
  resizeToContainer(): void {
    this._scheduleResize.bind(this);
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                      
  // #     # #####  # #    #   ##   ##### ###### 
  // #     # #    # # #    #  #  #    #   #      
  // ######  #    # # #    # #    #   #   #####  
  // #       #####  # #    # ######   #   #      
  // #       #   #  #  #  #  #    #   #   #      
  // #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  
  private _createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      const success_color = "#00ff00";
      const fail_color = "#ff0000";
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
        }
        
        .terminal_container {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
        }

        .terminal-scrollback {
          width: 100%;
        }
        
        .terminal_scrollbar {
            flex: 0;
            min-width: 15px;
            height: 100%;
        }
        
        DIV.term_container > .terminal {
            width: 100%;
            height: 100%;
        }
        
        .terminal {
            white-space: nowrap;
            font-family: sans-serif, ${termjs.Terminal.NO_STYLE_HACK};
            overflow: hidden;
        }
        
        .term_container         {
          height: 100%;
          width: 100%;
        }
        
        .scroller {
          flex: 1;
          height: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
        }
      
        ${EtCodeMirrorViewer.TAG_NAME},
        .terminal > DIV.terminal-active,
        .terminal > DIV.terminal-scrollback {
            margin-left: 2px;
            margin-right: 2px;
        }
        
        #${ID_SCROLLER}.${CLASS_SELECTION_MODE} > #${ID_SCROLLBACK} {
          
        }
        
        #${ID_SCROLLER}.${CLASS_SELECTION_MODE} > #${ID_TERM_CONTAINER} {
          display: none;
        }

        #${ID_VPAD} {
          width: 100%;
          height: 0px;
          display: none;
        }
        
        #${ID_SCROLLER}.${CLASS_SELECTION_MODE} > #${ID_VPAD} {
          display: block;
        }

        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id='${ID_CONTAINER}' class='terminal_container'>
          <div id='${ID_SCROLLER}' class='scroller'>
            <div id='${ID_SCROLLBACK}' class='terminal-scrollback terminal'></div>
            <div id='${ID_TERM_CONTAINER}' class='term_container'></div>
            <div id='${ID_VPAD}' class='terminal'></div>
          </div>
          <cb-scrollbar id='${ID_SCROLLBAR}' class='terminal_scrollbar'></cb-scrollbar>
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
  
  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  private _handleTitle(title: string): void {
    this._title = title;
    this._sendTitleEvent(title);
  }
  
  // ----------------------------------------------------------------------
  //
  //  #####                                                          ##        #####                           
  // #     #  ####  #####   ####  #      #      # #    #  ####      #  #      #     # # ###### # #    #  ####  
  // #       #    # #    # #    # #      #      # ##   # #    #      ##       #       #     #  # ##   # #    # 
  //  #####  #      #    # #    # #      #      # # #  # #          ###        #####  #    #   # # #  # #      
  //       # #      #####  #    # #      #      # #  # # #  ###    #   # #          # #   #    # #  # # #  ### 
  // #     # #    # #   #  #    # #      #      # #   ## #    #    #    #     #     # #  #     # #   ## #    # 
  //  #####   ####  #    #  ####  ###### ###### # #    #  ####      ###  #     #####  # ###### # #    #  ####  
  //
  // ----------------------------------------------------------------------
  
  private _handleTermWheel(ev: WheelEvent): void {
    const delta = ev.deltaY * SCROLL_STEP;
    this._scrollTo(this._scrollYOffset + delta);
  }
  
  /**
   * Handle manual-scroll events from the term.
   * 
   * These happen when the user does something in the terminal which
   * intentionally scrolls the contents.
   */
  private _handleManualScroll(scrollDetail: termjs.ScrollDetail): void {
    this._autoscroll = scrollDetail.isBottom;
    if (scrollDetail.isBottom) {
      this._scrollTo(Number.MAX_SAFE_INTEGER);
    }
  }
  
  /**
   * [_refreshScroll description]
   */
  private _refreshScroll(): void {
    this._scrollTo(this._scrollYOffset);
  }
  
  /**
   * Scroll the contents of the terminal to the given position.
   * 
   * @param {number} requestedY new position visible at the top of the viewport.
   */
  private _scrollTo(requestedY: number): void {
    if (this._terminalSize === null) {
      return;
    }
log("*************************************** _scrollTo( ", requestedY);
    const viewPortHeight = this._terminalSize.height;

    // Compute the virtual height of the terminal contents.
    
    const heights = this._getVirtualHeights();
// log("heights:",heights);

    // Add up the virtual heights.
    const virtualHeight = this._totalVirtualHeight(heights);
    this._virtualHeight = virtualHeight;
// log(`virtualHeight=${virtualHeight}`);
    // Clamp the requested position.
    const pos = Math.min(Math.max(0, requestedY), Math.max(0, virtualHeight-viewPortHeight));
    this._scrollYOffset = pos;
// log(`pos=${pos}`);

    // We pretend that the scrollback is one very tall continous column of text etc. But this is fake.
    // Each code mirror viewer is only as tall as the terminal viewport. We scroll the contents of the
    // code mirrors to make it look like the user is scrolling through a big long list.
    //
    // The terminal contents can best be thought of as a stack of rectangles which contain a sliding 'view' box.
    // +-------+
    // |       | <- First code mirror viewer.
    // |       |
    // |       |
    // |       |
    // |+-----+|
    // ||     || <- This little box is the part which shown inside the code mirror view port.
    // |+-----+|    This is is 'pulled' to bottom in the direction of the scroll Y point
    // +-------+
    // +-------+
    // |       | <- second code mirror viewer.
    // |       |
    // |       |
    // |+-----+| --- virtual scroll Y point
    // ||     ||     The viewport is positioned aligned with the scroll Y point.
    // |+-----+|     The scroller viewport is positioned at the top of the second code mirrro viewer.
    // |       |
    // +-------+
    //
    // The view ports are 'attracted' to the virtual Y position that we want to show.

    let realYBase = 0;
    let virtualYBase = 0;
    const el = util.getShadowId(this, ID_SCROLLER);
    for (let i=0; i<heights.length; i++) {
      const heightInfo = heights[i];

      const currentVirtualHeight = heightInfo.virtualHeight;
      const currentScrollHeight = currentVirtualHeight - heightInfo.realHeight;

      if (pos <= currentScrollHeight + virtualYBase) {
        const scrollOffset = Math.max(0, pos - virtualYBase);
log(`1. heightInfo ${i}, element scrollTo=${scrollOffset}, el.scrollTop=${realYBase}`);
        if (heightInfo.element !== null) {
          heightInfo.element.scrollTo(0, scrollOffset);
        }
        
        if (pos >= virtualYBase) {
          el.scrollTop = realYBase;
        }
        
      } else if (pos < virtualHeight + virtualYBase) {
        if (heightInfo.element !== null) {
          heightInfo.element.scrollTo(0, currentScrollHeight);
        }
log(`2. heightInfo ${i}, element scrollTo=${currentScrollHeight}, el.scrollTop=${realYBase + pos - virtualYBase - currentScrollHeight}`);
        if (pos >= virtualYBase) {
          el.scrollTop = realYBase + pos - virtualYBase - currentScrollHeight;
        }
      } else {
        if (heightInfo.element !== null) {
log(`3. heightInfo ${i}, element scrollTo=${currentScrollHeight}`);
          heightInfo.element.scrollTo(0, currentScrollHeight);
        }
      }

      realYBase += heightInfo.realHeight;
      virtualYBase += currentVirtualHeight;
    }

    // Update the scrollbar
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    scrollbar.size = this._virtualHeight;
    scrollbar.position = pos;
  }
  
  /**
   * [_getVirtualHeights description]
   * @return {VirtualHeight[]} [description]
   */
  private _getVirtualHeights(): VirtualHeight[] {
    // Assemble the interesting boxes.
    const heights: VirtualHeight[] = [];
    if (this._scrollbackCodeMirror !== null) {
      heights.push( { realHeight: this._scrollbackCodeMirror.getHeight(),
        virtualHeight: this._scrollbackCodeMirror.getVirtualHeight(),
        element: this._scrollbackCodeMirror } );
    }
    
    // Include the term part only if we are not in selection mode.
    if ( ! this._selectionModeFlag) {
      const termRect = this._term.element.getBoundingClientRect();
      heights.push( { realHeight: termRect.height, virtualHeight: termRect.height, element: null } );
    } else {
      heights.push( { realHeight: this._vpad, virtualHeight: this._vpad, element: null } );
    }
    return heights;
  }
  
  /**
   * [_totalVirtualHeight description]
   * @param  {VirtualHeight[]} heights [description]
   * @return {number}                  [description]
   */
  private _totalVirtualHeight(heights: VirtualHeight[]): number {
    return heights.reduce<number>( (accu, info) => accu + info.virtualHeight, 0);
  }
  
  private _virtualYOffset(heights: VirtualHeight[], element: HTMLElement, relativeYOffset: number): number {
    let ycounter = 0;
    for (let i=0; i<heights.length; i++) {
      if (heights[i].element === element) {
        return ycounter + relativeYOffset;
      }
      ycounter += heights[i].virtualHeight;
    }
    return -1;
  }
  
  private _syncScrolling(): void {
    if (this._scrollSyncLaterHandle === null) {
      this._scrollSyncLaterHandle = util.doLaterFrame( this._syncScrollingExec.bind(this) );
    }
  }

  /**
   * Synchronize the scrollbar with the term.
   */
  private _syncScrollingExec(): void {
log("_syncScrollingExec");
log("this._virtualHeight:", this._virtualHeight);
    this._scrollSyncLaterHandle = null;
    
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    scrollbar.size = this._virtualHeight;
    
    if (this._autoscroll) {
      // Scroll to the bottom.
      scrollbar.position = Number.MAX_SAFE_INTEGER;
      this._scrollTo(Number.MAX_SAFE_INTEGER);
    // } else {
    //   this._scrollTo(this._scrollbar.position);
    }
  }

  /**
   * Handle a resize event from the window.
   */
  private _processResize(): void {
    if (this._term !== null) {
      if (this._mainStyleLoaded && this._themeStyleLoaded) {
        const size = this._term.resizeToContainer();
        const vpadElement = util.getShadowId(this, ID_VPAD);
        this._vpad = size.vpad;
        vpadElement.style.height = "" + size.vpad + "px";
        this._sendResizeEvent(size.cols, size.rows);
      }
    }
    
    // Get the new size of the terminal.
    const newTerminalSize = this.getBoundingClientRect();
    if (this._terminalSize !== null &&
        newTerminalSize.width === this._terminalSize.width &&
        newTerminalSize.height === this._terminalSize.height) {
      return;
    }
log("this.clientHeight=",this.clientHeight);
log("bound height=",newTerminalSize.height);

    // Propagate the new terminal height to the different components in inside the terminal scrollback DIV.
    this._terminalSize = newTerminalSize;
    const scrollback = util.getShadowId(this, ID_SCROLLBACK);
    const height = this._terminalSize.height;
    util.nodeListToArray(scrollback.childNodes).forEach( (node: Node): void => {
      if (EtCodeMirrorViewer.is(node)) {
        node.setMaxHeight(height);
      }
    });
    
    this._syncScrolling();
  }
  
  private _resizePoll(): void {
    if (this._term !== null && this._mainStyleLoaded && this._themeStyleLoaded) {
      if (this._term.effectiveFontFamily().indexOf(termjs.Terminal.NO_STYLE_HACK) !== -1) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
        this._scheduleResize.bind(this);
      }
    }
  }

  private _handleCursorMove(ev: CustomEvent): void {
    this._scheduleCursorMoveUpdate(<EtCodeMirrorViewer> ev.target);
  }
  
  private _updateCursorAction(cmv: EtCodeMirrorViewer): void {
    console.log("_handleCursorMove (start)");
    if ( ! this._selectionModeFlag) {
      console.log("_handleCursorMove not in selection mode (exit)");
      return;
    }
    
    const detail: CursorMoveDetail = cmv.getCursorInfo();
    
    console.log("_handleCursorMove detail.top: ", detail.top);
    console.log("_handleCursorMove detail.bottom: ", detail.bottom);
    console.log("_handleCursorMove detail.viewPortTop: ", detail.viewPortTop);

    const heightsList = this._getVirtualHeights();
    const totalHeight = this._totalVirtualHeight(heightsList);
    
console.log("_handleCursorMove this._scrollYOffset:",  this._scrollYOffset);
    
    const topYOffset = this._virtualYOffset(heightsList, cmv, detail.top);
console.log("_handleCursorMove topYOffset:", topYOffset);
    if (topYOffset < this._scrollYOffset) {
console.log("_handleCursorMove topYOffset is smaller, scrolling");
      this._scrollTo(topYOffset);
    } else {
      const bottomYOffset = topYOffset + detail.bottom - detail.top;
      const scrollBottomYOffset = this._scrollYOffset + this._terminalSize.height;
      if (bottomYOffset > scrollBottomYOffset) {
console.log("_handleCursorMove bottomYOffset too small, scrolling");
      
console.log("_handleCursorMove topYOffset + bottomYOffset - scrollBottomYOffset:",
  topYOffset + bottomYOffset - scrollBottomYOffset);
        
        this._scrollTo(bottomYOffset - this._terminalSize.height);
      } else {
console.log("_handleCursorMove (do nothing)");
        if (this._lastViewPortTop.has(cmv)) {
          const oldViewPortTop = this._lastViewPortTop.get(cmv);
console.log("_handleCursorMove oldViewPortTop: ",oldViewPortTop);
          
          if (oldViewPortTop !== detail.viewPortTop) {
console.log("_handleCursorMove scroll to new viewPortTop: ",detail.viewPortTop);
            this._scrollTo(detail.viewPortTop);
          }
        }
console.log("_handleCursorMove setting new viewPortTop: ",detail.viewPortTop);
        this._lastViewPortTop.set(cmv, detail.viewPortTop);
      }
    }
console.log("_handleCursorMove (exit)");
  }
  
  private _handleScrollbackReady(): void {
    if ( ! this._selectionModeFlag) {
      this._scheduleScrollbackImport();
    }
  }
  
  private _getScrollBackCodeMirror(): EtCodeMirrorViewer {
    if (this._scrollbackCodeMirror === null) {
      this._scrollbackCodeMirror = <EtCodeMirrorViewer> document.createElement(EtCodeMirrorViewer.TAG_NAME);
      if (this._terminalSize.height !== null) {
        this._scrollbackCodeMirror.setMaxHeight(this._terminalSize.height);
      }
      util.getShadowId(this, ID_SCROLLBACK).appendChild(this._scrollbackCodeMirror);
    }
    return this._scrollbackCodeMirror;
  }
  
  private _importScrollback(): void {
log("_importScrollback");
    this._syncScrolling();
    
    if (this._term === null || this._selectionModeFlag) {
      return;
    }
    const lines = this._term.fetchScrollbackLines();
    if (lines.length === 0) {
      return;
    }

    const {text: allText, decorations: allDecorations} = this._linesToTextStyles(lines);
    const scrollbackCodeMirror = this._getScrollBackCodeMirror();
    scrollbackCodeMirror.appendText(allText, allDecorations);
  }

  private _linesToTextStyles(lines: termjs.Line[]): { text: string; decorations: TextDecoration[]; } {
    const allDecorations: TextDecoration[] = [];
    let allText = "";
    let cr = "";
    for (let i = 0; i < lines.length; i++) {
      const {text, decorations} = this._lineToStyleList(lines[i], i);
      allText += cr;
      allText += text;
      cr = "\n";
      
      allDecorations.push(...decorations);
    }
    return {text: allText, decorations: allDecorations};
  }

  private _lineToStyleList(line: termjs.Line, lineNumber: number): {text: string, decorations: TextDecoration[] } {
    const defAttr = termjs.Terminal.defAttr;
    let attr = defAttr;
    let lineLength = line.length;
    let text = '';
    const decorations: TextDecoration[] = [];
    
    // Trim off any unstyled whitespace to the right of the line.
    while (lineLength !==0 && line[lineLength-1][0] === defAttr && line[lineLength-1][1] === ' ') {
      lineLength--;
    }

    let currentDecoration: TextDecoration  = null;
    
    for (let i = 0; i < lineLength; i++) {
      const data = line[i][0];
      const ch = line[i][1];
      text += ch;
      
      if (data !== attr) {
        if (attr !== defAttr) {
          currentDecoration.toCh = i;
          decorations.push(currentDecoration);
          currentDecoration = null;
        }
        if (data !== defAttr) {
          let bg = termjs.backgroundFromCharAttr(data);
          let fg = termjs.foregroundFromCharAttr(data);
          const flags = termjs.flagsFromCharAttr(data);
          
          const classList: string[] = [];
          
          // bold
          if (flags & termjs.BOLD_ATTR_FLAG) {
            classList.push('terminal-bold');

            // See: XTerm*boldColors
            if (fg < 8) {
              fg += 8;  // Use the bright version of the color.
            }
          }

          // italic
          if (flags & termjs.ITALIC_ATTR_FLAG) {
            classList.push('terminal-italic');
          }
          
          // underline
          if (flags & termjs.UNDERLINE_ATTR_FLAG) {
            classList.push('terminal-underline');
          }

          // strike through
          if (flags & termjs.STRIKE_THROUGH_ATTR_FLAG) { 
            classList.push('terminal-strikethrough');
          }
          
          // inverse
          if (flags & termjs.INVERSE_ATTR_FLAG) {
            let tmp = fg;
            fg = bg;
            bg = tmp;
            
            // Should inverse just be before the
            // above boldColors effect instead?
            if ((flags & termjs.BOLD_ATTR_FLAG) && fg < 8) {
              fg += 8;  // Use the bright version of the color.
            }
          }

          // invisible
          if (flags & termjs.INVISIBLE_ATTR_FLAG) {
            classList.push('terminal-invisible');
          }

          if (bg !== 256) {
            classList.push('terminal-background-' + bg);
          }

          if (flags & termjs.FAINT_ATTR_FLAG) {
            classList.push('terminal-faint-' + fg);
          } else {
            if (fg !== 257) {
              classList.push('terminal-foreground-' + fg);
            }
          }
          
          if (flags & termjs.BLINK_ATTR_FLAG) {
            classList.push("terminal-blink");
          }
          
          if (classList.length !== 0) {
            currentDecoration = { line: lineNumber, fromCh: i, toCh: null, classList: classList };
          }
        }
      }

      attr = data;
    }

    if (attr !== defAttr) {
      currentDecoration.toCh = lineLength;
      decorations.push(currentDecoration);
    }
    
    return {text, decorations};
  }  
  
  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------
  
  private _handleScrollerKeyDown(ev: KeyboardEvent): void {
    log("scroller keydown:", ev);
    
    if (this._selectionModeFlag) {
      if (ev.keyCode === 27) {
log("_exitSelectionMode");        
        this._exitSelectionMode();
      }
    }
  }

  private _handleStyleLoad(): void {
    if (this._mainStyleLoaded && this._themeStyleLoaded) {
      // Start polling the term for application of the font.
      this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
    }
  }

  /**
   * Handle an unknown key down event from the term.
   */
  private _handleKeyDown(ev: KeyboardEvent): void {
    if (ev.keyCode === 67 && ev.ctrlKey && ev.shiftKey) {
      // Ctrl+Shift+C
      this.copyToClipboard();
      
    } else if (ev.keyCode === 86 && ev.ctrlKey && ev.shiftKey) {
      // Ctrl+Shift+V
      this._pasteFromClipboard();
      
    } else if (ev.keyCode === 33 && ev.shiftKey) {
      // page up
      this._scrollTo(this._scrollYOffset - this._terminalSize.height / 2);
      
    } else if (ev.keyCode === 34 && ev.shiftKey) {
      // page down
      this._scrollTo(this._scrollYOffset + this._terminalSize.height / 2);
      
    } else if (ev.keyCode === 32 && ev.ctrlKey) {
      // Ctrl + Space
      this._enterSelectionMode();
      
    } else {
      return;
    }
    ev.stopPropagation();
  }
  
  private _handleKeyPressTerminal(ev: KeyboardEvent): void {
    this._term.keyPress(ev);
  }

  private _handleKeyDownTerminal(ev: KeyboardEvent): void {
    let frames: EtEmbeddedViewer[];
    let index: number;
    
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
if ( ! this._selectionModeFlag) {
    this._term.keyDown(ev);
  }
  }

  private _handleMouseDownTermOnCapture(ev: MouseEvent): void {
    if ( ! this.hasFocus() && ! this._selectionModeFlag) {
      ev.stopPropagation();
      ev.preventDefault();
      this.focus();
    }
  }
  
  private _handleMouseDownTerm(ev: MouseEvent): void {  
    if ( ! this._selectionModeFlag) {
      const pos = this._term.getTerminalCoordsFromEvent(ev);
      if (pos !== null) {
        this._enterSelectionModeMouse(ev);
        ev.stopPropagation();
        ev.preventDefault();
      }
    }
  }
  
  // ********************************************************************
  //
  //  #####                                                            
  // #     #  ####  #    # ###### #####  #    # #      # #    #  ####  
  // #       #    # #    # #      #    # #    # #      # ##   # #    # 
  //  #####  #      ###### #####  #    # #    # #      # # #  # #      
  //       # #      #    # #      #    # #    # #      # #  # # #  ### 
  // #     # #    # #    # #      #    # #    # #      # #   ## #    # 
  //  #####   ####  #    # ###### #####   ####  ###### # #    #  ####  
  //
  // ********************************************************************
  
  /**
   * Schedule a cursor update to done later.
   * 
   * @param {EtCodeMirrorViewer} updateTarget [description]
   */
  private _scheduleCursorMoveUpdate(updateTarget: EtCodeMirrorViewer): void {
    this._scheduleProcessing();
    
    if (this._scheduledCursorUpdates.some( (cmv) => cmv === updateTarget)) {
      return;
    }
    this._scheduledCursorUpdates.push(updateTarget);
  }
  
  private _scheduleResize(): void {
    this._scheduleProcessing();
    this._scheduledResize = true;
  }
  
  private _scheduleScrollbackImport(): void {
    this._scheduleProcessing();
    this._scheduledScrollbackImport = true;
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
    const scheduledScrollbackImport = this._scheduledScrollbackImport;
    this._scheduledScrollbackImport = false;
    
    if (scheduledResize) {
console.log("_processScheduled resize");
      this._processResize();
    }
    
    if (scheduledScrollbackImport) {
      console.log("_processScheduled scrollback import");
      this._importScrollback();
    }

    scheduledCursorUpdates.forEach( (cmv) => {
console.log("_processScheduled update cursor");
      this._updateCursorAction(cmv);
    });
    
  }
  
  // ********************************************************************
  //
  //  #####                                                                                   
  // #     # ###### #      ######  ####  ##### #  ####  #    #    #    #  ####  #####  ###### 
  // #       #      #      #      #    #   #   # #    # ##   #    ##  ## #    # #    # #      
  //  #####  #####  #      #####  #        #   # #    # # #  #    # ## # #    # #    # #####  
  //       # #      #      #      #        #   # #    # #  # #    #    # #    # #    # #      
  // #     # #      #      #      #    #   #   # #    # #   ##    #    # #    # #    # #      
  //  #####  ###### ###### ######  ####    #   #  ####  #    #    #    #  ####  #####  ###### 
  //
  // ********************************************************************
  
  private _enterSelectionMode(): void {
    this._selectionModeFlag = true;
    
    const scroller = util.getShadowId(this, ID_SCROLLER);
    scroller.classList.add(CLASS_SELECTION_MODE);
    
    // Copy the current screen lines into the scrollback code mirror.
    const {text: allText, decorations: allDecorations} = this._linesToTextStyles(this._term.getScreenLines());
    const scrollbackCodeMirror = this._getScrollBackCodeMirror();
    
    this._selectionPreviousLineCount = scrollbackCodeMirror.lineCount();
    
    scrollbackCodeMirror.appendText(allText, allDecorations);
    
    
    const cursorInfo = this._term.getDimensions();
    scrollbackCodeMirror.refresh();
    scrollbackCodeMirror.setCursor(this._selectionPreviousLineCount + cursorInfo.cursorY, cursorInfo.cursorX);
    scrollbackCodeMirror.focus();
    
    util.doLater( () => {
      // This is absoletely needed to fix the annoying problem when one of the DIVs in the codemirror
      // viewer is scrolled down and exposes empty space even though it should never scroll.
      scrollbackCodeMirror.refresh();
    });
    
    this._refreshScroll();
  }
  
  private _enterSelectionModeMouse(ev: MouseEvent): void {
    const pos = this._term.getTerminalCoordsFromEvent(ev);
    if (pos === null) {
      return;
    }
    this._enterSelectionMode();

    const scrollbackCodeMirror = this._getScrollBackCodeMirror();
    scrollbackCodeMirror.fakeMouseDown(ev);
  }
  
  private _exitSelectionMode(): void {
    this._selectionModeFlag = false;
    
    const scrollbackCodeMirror = this._getScrollBackCodeMirror();
    scrollbackCodeMirror.deleteLinesFrom(this._selectionPreviousLineCount);
    
    const scroller = util.getShadowId(this, ID_SCROLLER);
    scroller.classList.remove(CLASS_SELECTION_MODE);
    
    this._term.focus();
    this._refreshScroll();
    this._handleScrollbackReady();
  }

  /* ******************************************************************** */
  
  /**
   * Handle when the embedded term.js enters start of application mode.
   * 
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  private _handleApplicationModeStart(params: string[]): void {
    log("application-mode started! ",params);
    
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
          log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          log("Starting APPLICATION_MODE_REQUEST_FRAME");
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_SHOW_MIME:
          log("Starting APPLICATION_MODE_SHOW_MIME");
          this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_MIME;
          this._mimeData = "";
          this._mimeType = params[2];
          break;
        
        default:
          log("Unrecognized application escape parameters.");
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
    log("html-mode data!", data);    
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
        el = this._getWindow().document.createElement("div");
        el.innerHTML = this._htmlData;
        this._term.appendElement(el);
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

    log("html-mode end!",this._htmlData);
    this._htmlData = null;
  }

  private _handleApplicationModeBracketStart(): void {
    const startdivs = this._term.element.querySelectorAll(
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
      this._term.appendElement(el);
    } else {
            
      // Don't place an embedded viewer, but use an invisible place holder instead.
      const el = this._getWindow().document.createElement(EtCommandPlaceHolder.TAG_NAME);
      el.setAttribute('command-line', cleancommand);
      this._term.appendElement(el);
    }
  }
  
  private deleteEmbeddedViewer(viewer: EtEmbeddedViewer): void {
    viewer.remove();
  }
  
  private _createEmbeddedViewerElement(commandLine: string): EtEmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EtEmbeddedViewer> this._getWindow().document.createElement(EtEmbeddedViewer.TAG_NAME);

    el.addEventListener(EtEmbeddedViewer.EVENT_CLOSE_REQUEST, () => {
      this.deleteEmbeddedViewer(el);
      this.focus();
    });

    el.addEventListener('type', (ev: CustomEvent) => {
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
    
    el.setAttribute('command-line', commandLine);  // FIXME attr name
    el.setAttribute('tag', "" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    this._closeLastEmbeddedViewer(this._htmlData);    
  }
 
  private _closeLastEmbeddedViewer(returnCode: string): void {
    const startElement = this._term.element.querySelectorAll(
                          EtEmbeddedViewer.TAG_NAME + ":not([return-code]), " + EtCommandPlaceHolder.TAG_NAME);

    if (startElement.length !== 0) {
      let embeddedSomethingElement = <HTMLElement>startElement[startElement.length-1];
      let embeddedViewerElement: EtEmbeddedViewer = null;
      if (embeddedSomethingElement instanceof EtCommandPlaceHolder) {
        // There is a place holder and not an embedded viewer.
        if (returnCode === "0") {
          // The command returned successful, just remove the place holder and that is it.
          embeddedSomethingElement.parentNode.removeChild(embeddedSomethingElement);
          return;
        } else {
          // The command went wrong. Replace the place holder with a real viewer
          // element and pretend that we had done this when the command started running.
          const newViewerElement = this._createEmbeddedViewerElement(embeddedSomethingElement.getAttribute("command-line"));
          embeddedSomethingElement.parentNode.replaceChild(newViewerElement, embeddedSomethingElement);
          embeddedViewerElement = newViewerElement;
        }
      } else {
        embeddedViewerElement = <EtEmbeddedViewer> embeddedSomethingElement;
      }
      
      this._term.moveRowsToScrollback();        
      let node = embeddedViewerElement.nextSibling;

      // Collect the DIVs in the scrollback from the EtEmbeddedViewer up to the end of the scrollback.
      const nodelist: Node[] = [];
      while (node !== null) {
        if (node.nodeName !== "DIV" || ! (<HTMLElement> node).classList.contains("terminal-active")) {
          nodelist.push(node);
        }
        node = node.nextSibling;
      }
      
      // Create a terminal viewer and fill it with the row DIVs.
      // const terminalViewerElement = <EtTerminalViewer> this._getWindow().document.createElement(EtTerminalViewer.TAG_NAME);
      const terminalViewerElement = <EtCodeMirrorViewer> this._getWindow().document.createElement(EtCodeMirrorViewer.TAG_NAME);
      terminalViewerElement.themeCssPath = this._themeCssPath;
      terminalViewerElement.returnCode = returnCode;
      terminalViewerElement.commandLine = embeddedViewerElement.getAttribute("command-line");
      
      // Move the row DIVs into their new home.
      nodelist.forEach(function(node) {
        terminalViewerElement.appendChild(node);
      });
      // Hang the terminal viewer under the Embedded viewer.
      embeddedViewerElement.appendChild(terminalViewerElement);
      
      embeddedViewerElement.setAttribute('return-code', returnCode);
      embeddedViewerElement.className = "extraterm_output";
    }
  }

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    const selection = this.shadowRoot.getSelection();
    let text: string = "";
    if (selection.rangeCount !== 0 && ! selection.getRangeAt(0).collapsed) {
      const range = selection.getRangeAt(0);
      text = domutils.extractTextFromRange(range);
      
    } else {
      const candidates = this.shadowRoot.querySelectorAll(EtEmbeddedViewer.TAG_NAME);
      text = _.first<string>(util.nodeListToArray(candidates)
        .map<string>( (node: Node) => (<EtEmbeddedViewer> node).getSelectionText())
        .filter( (text) => text !== null)
      );
      text = text === undefined ? null : text;
    }
    
    if (text !== null) {
      webipc.clipboardWrite(text);
    }
  }
  
  pasteText(text: string): void {
    this.send(text);
    this._term.scrollToBottom();
  }

  /**
   * Paste text from the clipboard.
   *
   * This method is async and returns before the paste is done.
   */
  private _pasteFromClipboard(): void {
    webipc.clipboardReadRequest();
  }

  /**
   * Handle new stdout data from the pty.
   * 
   * @param {string} data New data.
   */
  private _handlePtyStdoutData (data: string): void {
    log("incoming data:",""+data);
    this._term.write("" + data);
    this._syncScrolling();
  }

  /**
   * Handle new stderr data from the pty.
   * 
   * @param {type} data New data.
   */
  private _handlePtyStderrData(data: string): void {
    this._term.write(data);
    this._syncScrolling();
  }

  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  private _handleTermData(data: string): void {
    this._sendDataToPtyEvent(data);
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
      this._term.appendElement(viewerElement);
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
      log("Unknown mime type: " + mimeType);
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
    const matches = this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  }
  
  private _getNextTag(): number {
    this._tagCounter++;
    return this._tagCounter;
  }
}

export = EtTerminal;
