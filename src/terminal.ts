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
import virtualscrollarea = require('./virtualscrollarea');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type CursorMoveDetail = EtCodeMirrorViewerTypes.CursorMoveDetail;

const debug = true;
let startTime: number = window.performance.now();
let registered = false;

function log(message: any, ...msgOpts: any[]): void {
  if (debug) {
    // const offset = window.performance.now() - startTime;
    // const msg: string = message + msgOpts.reduce( (accu: string, value: string) => accu + value, "");
    console.log(message, ...msgOpts);
    // console.timeStamp(msg);
    // console.log(""+offset + ": " + msg);
  }
}

const ID = "EtTerminalTemplate";
const EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
const SEMANTIC_TYPE = "data-extraterm-type";
const SEMANTIC_VALUE = "data-extraterm-value";
const ID_TERM_CONTAINER = "term_container";
const ID_SCROLLER = "scroller";
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

const enum Mode {
  TERM,
  MOUSE_SELECTION,
  KEYBOARD_SELECTION
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

  private _virtualScrollArea: virtualscrollarea.VirtualScrollArea;
  
  private _scrollSyncLaterHandle: util.LaterHandle;
  private _autoscroll: boolean;
  
  private _codeMirrorTerminal: EtCodeMirrorViewer;
  private _terminalSize: ClientRect;
  private _scrollYOffset: number; // The Y scroll offset into the virtual height.
  private _virtualHeight: number; // The virtual height of the terminal contents in px.
  private _vpad: number;
  private _lastViewPortTop: WeakMap<EtCodeMirrorViewer, number>;
  
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
  private _scheduledScrollbackImport: boolean;
  private _scheduledResize: boolean;

  private _initProperties(): void {
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
    
    this._mode = Mode.TERM;
    
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

    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    const termContainer = <HTMLDivElement> util.getShadowId(this, ID_TERM_CONTAINER);
    const scroller = util.getShadowId(this, ID_SCROLLER);
    
    this._virtualScrollArea.setScrollContainer(this);
    this._virtualScrollArea.setScrollbar(scrollbar);
    
    // Set up the emulator
    const cookie = crypto.randomBytes(10).toString('hex');
    process.env[EXTRATERM_COOKIE_ENV] = cookie;

    this._emulator = new termjs.Emulator({
      scrollback: 1000,
      cursorBlink: this._blinkingCursor,
      physicalScroll: true,
      applicationModeCookie: cookie,
      debug: true
    });

    this._emulator.debug = true;
    this._emulator.addTitleChangeEventListener(this._handleTitle.bind(this));
    this._emulator.addDataEventListener(this._handleTermData.bind(this));
    this._emulator.addSizeEventListener(this._handleTermSize.bind(this));

    // Create the CodeMirrorTerminal
    this._codeMirrorTerminal = <EtCodeMirrorViewer> document.createElement(EtCodeMirrorViewer.TAG_NAME);
    this._codeMirrorTerminal.addEventListener(EtCodeMirrorViewer.EVENT_RESIZE, this._handleCodeMirrorResize.bind(this));
    this._codeMirrorTerminal.addEventListener(EtCodeMirrorViewer.EVENT_KEYBOARD_ACTIVITY, () => {
      this._virtualScrollArea.scrollToBottom();
    });
    util.getShadowId(this, ID_TERM_CONTAINER).appendChild(this._codeMirrorTerminal);
    this._virtualScrollArea.appendScrollable(this._codeMirrorTerminal, this._codeMirrorTerminal.getMinHeight(),
      this._codeMirrorTerminal.getVirtualHeight());

    this._codeMirrorTerminal.emulator = this._emulator;

    // FIXME there might be resizes for things other than changs in window size.
    this._getWindow().addEventListener('resize', this._scheduleResize.bind(this));
    
    // termContainer.addEventListener('keydown', this._handleKeyDown.bind(this));
    // scroller.addEventListener('wheel', this._handleTermWheel.bind(this));
    // scroller.addEventListener('keydown', this._handleScrollerKeyDown.bind(this));
    // scroller.addEventListener(EtCodeMirrorViewer.EVENT_CURSOR_MOVE, this._handleCursorMove.bind(this));
    
    // this._term.on(termjs.Terminal.EVENT_MANUAL_SCROLL, this._handleManualScroll.bind(this));
    // this._term.on(termjs.Terminal.EVENT_SCROLLBACK_AVAILABLE, this._handleScrollbackReady.bind(this));
    
    // Application mode handlers    
    // this._term.addApplicationModeStartEventListener(this._handleApplicationModeStart.bind(this));
    // this._term.addApplicationModeDataEventListener(this._handleApplicationModeData.bind(this));
    // this._term.addApplicationModeEndEventListener(this._handleApplicationModeEnd.bind(this));
  }
   
  attachedCallback(): void {
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    const termContainer = <HTMLDivElement> util.getShadowId(this, ID_TERM_CONTAINER);
    // termContainer.addEventListener('mousedown', this._handleMouseDownTermOnCapture.bind(this), true);
    // termContainer.addEventListener('mousedown', this._handleMouseDownTerm.bind(this));
    
    this._emulator.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');
    
    const scrollbar = <CbScrollbar> util.getShadowId(this, ID_SCROLLBAR);
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.position);
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
    this._codeMirrorTerminal.focus();
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    return this._codeMirrorTerminal.hasFocus();
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
        
        #${ID_SCROLLER} {
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
          <div id='${ID_SCROLLER}'>
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
  private _handleTitle(emulator: termjs.Emulator, title: string): void {
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
//   private _handleManualScroll(scrollDetail: termjs.ScrollDetail): void {
// console.log("*** _handleManualScroll()");
//     
//     this._autoscroll = scrollDetail.isBottom;
//     if (scrollDetail.isBottom) {
//       this._scrollTo(Number.MAX_SAFE_INTEGER);
//     }
//   }

  private _handleCodeMirrorResize(ev: CustomEvent): void {
    this._virtualScrollArea.updateScrollableHeights(this._codeMirrorTerminal, this._codeMirrorTerminal.getMinHeight(),
      this._codeMirrorTerminal.getVirtualHeight())
  }
  
  private _syncScrolling(): void {
    // if (this._scrollSyncLaterHandle === null) {
    //   this._scrollSyncLaterHandle = util.doLaterFrame( this._syncScrollingExec.bind(this) );
    // }
  }

  /**
   * Handle a resize event from the window.
   */
  private _processResize(): void {
    this._codeMirrorTerminal.resizeEmulatorToParentContainer();
    this._virtualScrollArea.resize();    
  }
  
  // private _resizePoll(): void {
  //   if (this._codeMirrorTerminal !== null && this._mainStyleLoaded && this._themeStyleLoaded) {
  //     if ( ! this._codeMirrorTerminal.isFontLoaded()) {
  //       // Font has not been correctly applied yet.
  //       this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
  //     } else {
  //       // Yay! the font is correct. Resize the term soon.
  //       this._scheduleResize.bind(this);
  //     }
  //   }
  // }

  private _handleCursorMove(ev: CustomEvent): void {
    this._scheduleCursorMoveUpdate(<EtCodeMirrorViewer> ev.target);
  }
  
  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------
  // ----------------------------------------------------------------------

  /**
   * Handle an unknown key down event from the term.
   */
  // private _handleKeyDown(ev: KeyboardEvent): void {
  //   if (ev.keyCode === 67 && ev.ctrlKey && ev.shiftKey) {
  //     // Ctrl+Shift+C
  //     this.copyToClipboard();
  //     
  //   } else if (ev.keyCode === 86 && ev.ctrlKey && ev.shiftKey) {
  //     // Ctrl+Shift+V
  //     this._pasteFromClipboard();
  //     
  //   } else if (ev.keyCode === 33 && ev.shiftKey) {
  //     // page up
  //     this._scrollTo(this._scrollYOffset - this._terminalSize.height / 2);
  //     
  //   } else if (ev.keyCode === 34 && ev.shiftKey) {
  //     // page down
  //     this._scrollTo(this._scrollYOffset + this._terminalSize.height / 2);
  //     
  //   // } else if (ev.keyCode === 32 && ev.ctrlKey) {
  //   //   // Ctrl + Space
  //   //   this._enterSelectionMode(Mode.KEYBOARD_SELECTION);
  //     
  //   } else {
  //     // log("keyDown: ", ev);
  //     
  //     return;
  //   }
  //   ev.stopPropagation();
  // }
  
  private _handleKeyPressTerminal(ev: KeyboardEvent): void {
    // this._term.keyPress(ev);
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
    // if (this._mode === Mode.TERM) {
    //   this._term.keyDown(ev);
    // }
  }

  private _handleMouseDownTermOnCapture(ev: MouseEvent): void {
    if ( ! this.hasFocus() && this._mode === Mode.TERM) {
      ev.stopPropagation();
      ev.preventDefault();
      this.focus();
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
  
//   private _enterSelectionMode(newMode: Mode): void {
// console.log("_enterSelectionMode (enter)");
//     this._mode = newMode;
//     
//     const scroller = util.getShadowId(this, ID_SCROLLER);
//     scroller.classList.add(CLASS_SELECTION_MODE);
//     
//     // Copy the current screen lines into the scrollback code mirror.
//     const {text: allText, decorations: allDecorations} = this._linesToTextStyles(this._term.getScreenLines(true));
//     const scrollbackCodeMirror = this._getScrollBackCodeMirror();
//     scrollbackCodeMirror.processKeyboard = newMode === Mode.KEYBOARD_SELECTION;
//     
//     this._selectionPreviousLineCount = scrollbackCodeMirror.lineCount();
//     
//     scrollbackCodeMirror.appendText(allText, allDecorations);
// 
//     const cursorInfo = this._term.getDimensions();
//     scrollbackCodeMirror.refresh();
//     
//     if (newMode === Mode.KEYBOARD_SELECTION) {
//       scrollbackCodeMirror.setCursor(this._selectionPreviousLineCount + cursorInfo.cursorY, cursorInfo.cursorX);
//       scrollbackCodeMirror.focus();
//     }
//     
//     util.doLater( () => {
//       // This is absoletely needed to fix the annoying problem when one of the DIVs in the codemirror
//       // viewer is scrolled down and exposes empty space even though it should never scroll.
//       scrollbackCodeMirror.refresh();
//     });
//     
//     this._refreshScroll();
// console.log("_enterSelectionMode (exit)");
//   }
  
  // private _enterSelectionModeMouse(ev: MouseEvent): void {
  //   const pos = this._term.getTerminalCoordsFromEvent(ev);
  //   if (pos === null) {
  //     return;
  //   }
  //   this._enterSelectionMode(Mode.MOUSE_SELECTION);
  // 
  //   const scrollbackCodeMirror = this._getScrollBackCodeMirror();
  //   scrollbackCodeMirror.fakeMouseDown(ev);
  // }
  
//   private _exitSelectionMode(): void {
// console.log("_exitSelectionMode (enter)");
//     
//     this._mode = Mode.TERM;
//     
//     const scrollbackCodeMirror = this._getScrollBackCodeMirror();
//     scrollbackCodeMirror.deleteLinesFrom(this._selectionPreviousLineCount);
//     
//     const scroller = util.getShadowId(this, ID_SCROLLER);
//     scroller.classList.remove(CLASS_SELECTION_MODE);
//     
//     this._term.focus();
//     this._refreshScroll();
//     this._handleScrollbackReady();
// console.log("_exitSelectionMode (enter)");
//   }

  /* ******************************************************************** */
  
  /**
   * Handle when the embedded term.js enters start of application mode.
   * 
   * @param {array} params The list of parameter which were specified in the
   *     escape sequence.
   */
  // private _handleApplicationModeStart(emulator: termjs.Emulator, params: string[]): void {
  //   log("application-mode started! ",params);
  //   
  //   // FIXME check cookie!
  // 
  //   if (params.length === 1) {
  //     // Normal HTML mode.
  //     this._applicationMode = ApplicationMode.APPLICATION_MODE_HTML;
  // 
  //   } else if(params.length >= 2) {
  //     switch ("" + params[1]) {
  //       case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
  //         this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START;
  //         this._bracketStyle = params[2];
  //         break;
  // 
  //       case "" + ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
  //         this._applicationMode = ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END;
  //         log("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
  //         break;
  //         
  //       case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
  //         this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
  //         log("Starting APPLICATION_MODE_REQUEST_FRAME");
  //         break;
  //         
  //       case "" + ApplicationMode.APPLICATION_MODE_SHOW_MIME:
  //         log("Starting APPLICATION_MODE_SHOW_MIME");
  //         this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_MIME;
  //         this._mimeData = "";
  //         this._mimeType = params[2];
  //         break;
  //       
  //       default:
  //         log("Unrecognized application escape parameters.");
  //         break;
  //     }
  //   }
  //   this._htmlData = "";
  // }

  /**
   * Handle incoming data while in application mode.
   * 
   * @param {string} data The new data.
   */
  // private _handleApplicationModeData(data: string): void {
  //   log("html-mode data!", data);
  //   switch (this._applicationMode) {
  //     case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
  //     case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
  //       this._htmlData = this._htmlData + data;
  //       break;
  //       
  //     case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
  //       this._mimeData = this._mimeData + data;
  //       break;
  //       
  //     default:
  //       break;
  //   }
  // }
  
  /**
   * Handle the exit from application mode.
   */
  // private _handleApplicationModeEnd(): void {
  //   let el: HTMLElement;
  //   let startdivs: NodeList;
  //   
  //   switch (this._applicationMode) {
  //     case ApplicationMode.APPLICATION_MODE_HTML:
  //       el = this._getWindow().document.createElement("div");
  //       el.innerHTML = this._htmlData;
  //       this._term.appendElement(el);
  //       break;
  // 
  //     case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
  //       this._handleApplicationModeBracketStart();
  //       break;
  // 
  //     case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
  //       this._handleApplicationModeBracketEnd();
  //       break;
  // 
  //     case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
  //       this.handleRequestFrame(this._htmlData);
  //       break;
  //       
  //     case ApplicationMode.APPLICATION_MODE_SHOW_MIME:
  //       this._handleShowMimeType(this._mimeType, this._mimeData);
  //       this._mimeType = "";
  //       this._mimeData = "";
  //       break;
  //       
  //     default:
  //       break;
  //   }
  //   this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  // 
  //   log("html-mode end!",this._htmlData);
  //   this._htmlData = null;
  // }

  // private _handleApplicationModeBracketStart(): void {
  //   const startdivs = this._term.element.querySelectorAll(
  //                       EtEmbeddedViewer.TAG_NAME + ":not([return-code]), "+EtCommandPlaceHolder.TAG_NAME);
  // 
  //   if (startdivs.length !== 0) {
  //     return;  // Don't open a new frame.
  //   }
  //   
  //   // Fetch the command line.
  //   let cleancommand = this._htmlData;
  //   if (this._bracketStyle === "bash") {
  //     // Bash includes the history number. Remove it.
  //     const trimmed = this._htmlData.trim();
  //     cleancommand = trimmed.slice(trimmed.indexOf(" ")).trim();
  //   }
  //   
  //   if ( ! this._isNoFrameCommand(cleancommand)) {
  //     // Create and set up a new command-frame.
  //     const el = this._createEmbeddedViewerElement(cleancommand);
  //     this._term.appendElement(el);
  //   } else {
  //           
  //     // Don't place an embedded viewer, but use an invisible place holder instead.
  //     const el = this._getWindow().document.createElement(EtCommandPlaceHolder.TAG_NAME);
  //     el.setAttribute('command-line', cleancommand);
  //     this._term.appendElement(el);
  //   }
  // }
  
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
  
  // private _handleApplicationModeBracketEnd(): void {
  //   this._closeLastEmbeddedViewer(this._htmlData);    
  // }
  // 
  // private _closeLastEmbeddedViewer(returnCode: string): void {
  //   const startElement = this._term.element.querySelectorAll(
  //                         EtEmbeddedViewer.TAG_NAME + ":not([return-code]), " + EtCommandPlaceHolder.TAG_NAME);
  // 
  //   if (startElement.length !== 0) {
  //     let embeddedSomethingElement = <HTMLElement>startElement[startElement.length-1];
  //     let embeddedViewerElement: EtEmbeddedViewer = null;
  //     if (embeddedSomethingElement instanceof EtCommandPlaceHolder) {
  //       // There is a place holder and not an embedded viewer.
  //       if (returnCode === "0") {
  //         // The command returned successful, just remove the place holder and that is it.
  //         embeddedSomethingElement.parentNode.removeChild(embeddedSomethingElement);
  //         return;
  //       } else {
  //         // The command went wrong. Replace the place holder with a real viewer
  //         // element and pretend that we had done this when the command started running.
  //         const newViewerElement = this._createEmbeddedViewerElement(embeddedSomethingElement.getAttribute("command-line"));
  //         embeddedSomethingElement.parentNode.replaceChild(newViewerElement, embeddedSomethingElement);
  //         embeddedViewerElement = newViewerElement;
  //       }
  //     } else {
  //       embeddedViewerElement = <EtEmbeddedViewer> embeddedSomethingElement;
  //     }
  //     
  //     this._term.moveRowsToScrollback();        
  //     let node = embeddedViewerElement.nextSibling;
  // 
  //     // Collect the DIVs in the scrollback from the EtEmbeddedViewer up to the end of the scrollback.
  //     const nodelist: Node[] = [];
  //     while (node !== null) {
  //       if (node.nodeName !== "DIV" || ! (<HTMLElement> node).classList.contains("terminal-active")) {
  //         nodelist.push(node);
  //       }
  //       node = node.nextSibling;
  //     }
  //     
  //     // Create a terminal viewer and fill it with the row DIVs.
  //     // const terminalViewerElement = <EtTerminalViewer> this._getWindow().document.createElement(EtTerminalViewer.TAG_NAME);
  //     const terminalViewerElement = <EtCodeMirrorViewer> this._getWindow().document.createElement(EtCodeMirrorViewer.TAG_NAME);
  //     terminalViewerElement.themeCssPath = this._themeCssPath;
  //     terminalViewerElement.returnCode = returnCode;
  //     terminalViewerElement.commandLine = embeddedViewerElement.getAttribute("command-line");
  //     
  //     // Move the row DIVs into their new home.
  //     nodelist.forEach(function(node) {
  //       terminalViewerElement.appendChild(node);
  //     });
  //     // Hang the terminal viewer under the Embedded viewer.
  //     embeddedViewerElement.appendChild(terminalViewerElement);
  //     
  //     embeddedViewerElement.setAttribute('return-code', returnCode);
  //     embeddedViewerElement.className = "extraterm_output";
  //   }
  // }

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    // let text: string = "";
    // if (this._mode !== Mode.TERM) {
    //   const cmv = this._getScrollBackCodeMirror();
    //   text = cmv.getSelectionText();
    // } else {
    //   const candidates = this.shadowRoot.querySelectorAll(EtEmbeddedViewer.TAG_NAME);
    //   text = _.first<string>(util.nodeListToArray(candidates)
    //     .map<string>( (node: Node) => (<EtEmbeddedViewer> node).getSelectionText())
    //     .filter( (text) => text !== null)
    //   );
    //   text = text === undefined ? null : text;
    // }
    // 
    // if (text !== null) {
    //   webipc.clipboardWrite(text);
    // }
  }
  
  pasteText(text: string): void {
    this.send(text);
    // this._term.scrollToBottom();
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
    this._emulator.write("" + data);
    this._syncScrolling();
  }

  /**
   * Handle new stderr data from the pty.
   * 
   * @param {type} data New data.
   */
  private _handlePtyStderrData(data: string): void {
    this._emulator.write(data);
    this._syncScrolling();
  }

  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  private _handleTermData(emulator: termjs.Emulator, data: string): void {
console.log("_handleTermData !!");
    this._sendDataToPtyEvent(data);
  }
  
  private _handleTermSize(emulator: termjs.Emulator, newRows: number, newColumns: number, realizedRows: number): void {
console.log("_handleTermSize !!");
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
  
  private _embeddedViewerPopOutEvent(viewerElement: EtEmbeddedViewer): void {
    const event = new CustomEvent(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT,
      { detail: { terminal: this, embeddedViewer: viewerElement} });
    this.dispatchEvent(event);
  }
  
  // private handleRequestFrame(frameId: string): void {
  //   const sourceFrame: EtEmbeddedViewer = this._findFrame(frameId);
  //   const data = sourceFrame !== null ? sourceFrame.text : "";
  //   const lines = data.split("\n");
  //   let encodedData: string = "";
  //   lines.forEach( (line: string) => {
  //     encodedData = window.btoa(line +"\n");
  //     this._sendDataToPtyEvent(encodedData+"\n");
  //   });
  //     
  //   this._sendDataToPtyEvent("\x04");
  //   
  //   if (encodedData.length !== 0) {
  //     this._sendDataToPtyEvent("\x04");
  //   }
  // }

  // private _handleShowMimeType(mimeType: string, mimeData: string): void {
  //   const mimeViewerElement = this._createMimeViewer(mimeType, mimeData);
  //   if (mimeViewerElement !== null) {
  //     this._closeLastEmbeddedViewer("0");
  //     const viewerElement = this._createEmbeddedViewerElement("viewer");
  //     viewerElement.viewerElement = mimeViewerElement;
  //     this._term.appendElement(viewerElement);
  //   }
  // }

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
  // private _findFrame(frameId: string): EtEmbeddedViewer {
  //   if (/[^0-9]/.test(frameId)) {
  //     return null;
  //   }
  //   const matches = this._term.element.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
  //   return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  // }
  
  private _getNextTag(): number {
    this._tagCounter++;
    return this._tagCounter;
  }
}

export = EtTerminal;
