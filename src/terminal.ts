/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs  = require('fs');
import crypto = require('crypto');
import _ = require('lodash');
import base64arraybuffer = require('base64-arraybuffer');
import utf8 = require('utf8');

import ViewerElement = require("./viewerelement");
import ViewerElementTypes = require("./viewerelementtypes");
import ResizeableElementBase = require("./resizeableelementbase");
import ThemeableElementBase = require('./themeableelementbase');
import ThemeTypes = require('./theme');
import EtEmbeddedViewer = require('./embeddedviewer');
import EtCommandPlaceHolder = require('./commandplaceholder');
import EtTerminalViewer = require('./viewers/terminalviewer');
import EtTerminalViewerTypes = require('./viewers/terminalviewertypes');
import EtTextViewer = require('./viewers/textviewer');
import EtImageViewer = require('./viewers/imageviewer');
import EtTipViewer = require('./viewers/tipviewer');
import generalevents = require('./generalevents');
import keybindingmanager = require('./keybindingmanager');
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import CommandPaletteRequestTypes = require('./commandpaletterequesttypes');
type CommandPaletteRequest = CommandPaletteRequestTypes.CommandPaletteRequest;

// import EtMarkdownViewer = require('./viewers/markdownviewer');
import Logger = require('./logger');
import LogDecorator = require('./logdecorator');
import domutils = require('./domutils');
import termjs = require('./term');
import CbScrollbar = require('./gui/scrollbar');
import util = require('./gui/util');

import electron = require('electron');
const clipboard = electron.clipboard;

import webipc = require('./webipc');
import Messages = require('./windowmessages');
import virtualscrollarea = require('./virtualscrollarea');
import FrameFinderType = require('./framefindertype');
type FrameFinder = FrameFinderType.FrameFinder;

import config = require('./config');
type Config = config.Config;
type ConfigManager = config.ConfigManager;

type CommandLineAction = config.CommandLineAction;

type TextDecoration = EtTerminalViewerTypes.TextDecoration;
type BookmarkRef = EtTerminalViewerTypes.BookmarkRef;
type VirtualScrollable = virtualscrollarea.VirtualScrollable;
const VisualState = ViewerElementTypes.VisualState;

type Mode = ViewerElementTypes.Mode;  // This is the enum type.
const Mode = ViewerElementTypes.Mode; // This gets us access to the object holding the enum values.

type ScrollableElement = VirtualScrollable & HTMLElement;

const log = LogDecorator;

const DEBUG = true;
const DEBUG_APPLICATION_MODE = false;

let startTime: number = window.performance.now();
let registered = false;

const ID = "EtTerminalTemplate";
const EXTRATERM_COOKIE_ENV = "EXTRATERM_COOKIE";
const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_CONTAINER = "ID_CONTAINER";
const KEYBINDINGS_DEFAULT_MODE = "terminal-default-mode";
const KEYBINDINGS_SELECTION_MODE = "terminal-selection-mode";

const COMMAND_ENTER_SELECTION_MODE = "enterSelectionMode";
const COMMAND_ENTER_NORMAL_MODE = "enterNormalMode";
const COMMAND_SCROLL_PAGE_UP = "scrollPageUp";
const COMMAND_SCROLL_PAGE_DOWN = "scrollPageDown";
const COMMAND_COPY_TO_CLIPBOARD = "copyToClipboard";
const COMMAND_PASTE_FROM_CLIPBOARD = "pasteFromClipboard";
const COMMAND_DELETE_LAST_FRAME = "deleteLastFrame";
const COMMAND_OPEN_LAST_FRAME = "openLastFrame";

const CLASS_SELECTION_MODE = "selection-mode";
const SCROLL_STEP = 1;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

const enum ApplicationMode {
  APPLICATION_MODE_NONE = 0,
  APPLICATION_MODE_HTML = 1,
  APPLICATION_MODE_OUTPUT_BRACKET_START = 2,
  APPLICATION_MODE_OUTPUT_BRACKET_END = 3,
  APPLICATION_MODE_REQUEST_FRAME = 4,
  APPLICATION_MODE_SHOW_FILE = 5,
}

// List of viewer classes.
const viewerClasses: ViewerElementTypes.SupportsMimeTypes[] = [];
viewerClasses.push(EtImageViewer);
viewerClasses.push(EtTextViewer);
viewerClasses.push(EtTipViewer);

/**
 * An Extraterm terminal.
 * 
 * An EtTerminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 */
class EtTerminal extends ThemeableElementBase implements CommandPaletteRequestTypes.Commandable,
    keybindingmanager.AcceptsKeyBindingManager, config.AcceptsConfigManager {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-TERMINAL";
  
  static EVENT_USER_INPUT = "user-input";
  
  static EVENT_TERMINAL_RESIZE = "terminal-resize";
  
  static EVENT_TITLE = "title";
  
  static EVENT_EMBEDDED_VIEWER_POP_OUT = "viewer-pop-out";
  
  /**
   * Initialize the EtTerminal class and resources.
   *
   * When EtTerminal is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      CbScrollbar.init();
      EtEmbeddedViewer.init();
      EtCommandPlaceHolder.init();
      EtTerminalViewer.init();
      EtTextViewer.init();
      EtImageViewer.init();
      EtTipViewer.init();

      // EtMarkdownViewer.init();
      window.document.registerElement(EtTerminal.TAG_NAME, {prototype: EtTerminal.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;

  private _virtualScrollArea: virtualscrollarea.VirtualScrollArea;
  
  private _autoscroll: boolean;
  
  private _terminalViewer: EtTerminalViewer;
  
  private _emulator: termjs.Emulator;
  private _cookie: string;
  private _htmlData: string;
  
  private _showPayloadSize: string;
  private _showData: string;
  
  private _applicationMode: ApplicationMode;
  private _bracketStyle: string;

  // The command line string of the last command started.
  private _lastCommandLine: string;
  
  // The terminal viewer containing the start output of the last command started.
  private _lastCommandTerminalViewer: EtTerminalViewer;
  
  // The line number of the start of output of the last command started.
  private _lastCommandTerminalLine: BookmarkRef;
  
  private _mode: Mode;
  private _selectionPreviousLineCount: number;
  
  private _configManager: ConfigManager;
  private _keyBindingManager: KeyBindingManager;
  
  private _blinkingCursor: boolean;
  private _title: string;
  private _commandLineActions: CommandLineAction[];
  private _frameFinder: FrameFinder;
  private _scrollbackSize: number;
  
  private _nextTag: string;

  private _themeCssPath: string;
  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: domutils.LaterHandle;
  private _elementAttached: boolean;

  // This flag is needed to prevent the _enforceScrollbackLength() method from being run recursively
  private _enforceScrollbackLengthGuard: boolean;
  
  private _scheduleLaterHandle: domutils.LaterHandle;
  private _scheduledCursorUpdates: EtTerminalViewer[];
  private _scheduledResize: boolean;
  private _scheduleResizeBound: any;
  
  // The current size of the emulator. This is used to detect changes in size.
  private _columns = -1;
  private _rows = -1;
  
  private _initProperties(): void {
    this._log = new Logger(EtTerminal.TAG_NAME);
    this._virtualScrollArea = null;
    this._elementAttached = false;
    this._autoscroll = true;
    this._emulator = null;
    this._cookie = null;
    this._terminalViewer = null;
    this._htmlData = null;
    this._showPayloadSize = null;
    this._showData = null;
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
    this._bracketStyle = null;
    
    this._mode = Mode.DEFAULT;
    
    this._configManager = null;
    this._keyBindingManager = null;
    this._blinkingCursor = false;
    this._commandLineActions = [];
    this._scrollbackSize = 10000;
    this._frameFinder = null;
    this._title = "New Tab";
    this._nextTag = null;
    this._themeCssPath = null;
    this._mainStyleLoaded = false;
    this._themeStyleLoaded = false;
    this._resizePollHandle = null;

    this._enforceScrollbackLengthGuard = false;
    this._scheduleLaterHandle = null;
    this._scheduledCursorUpdates = [];
    this._scheduledResize = false;
    
    this._lastCommandLine = null;
    this._lastCommandTerminalViewer = null;
    this._lastCommandTerminalLine = null;
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
  
  /**
   * The number of columns in the terminal screen.
   */
  get columns(): number {
    return this._columns;
  }
  
  /**
   * The number of rows in the terminal screen.
   */
  get rows(): number {
    return this._rows;
  }

  setConfigManager(configManager: ConfigManager): void {
    this._configManager = configManager;
  }
  
  setKeyBindingManager(keyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = keyBindingManager;
  }
  
  set scrollbackSize(scrollbackSize: number) {
    this._scrollbackSize = scrollbackSize;
  }
  
  get scrollbackSize(): number {
    return this._scrollbackSize;
  }
  
  set commandLineActions(commandLineActions: CommandLineAction[]) {
    if (commandLineActions === null) {
      this._commandLineActions = [];
      return;
    }
    
    this._commandLineActions = commandLineActions;
  }
  
  private _isNoFrameCommand(commandLine: string): boolean {
    const cleanCommandLine = commandLine.trim();
    if (cleanCommandLine === "") {
      return true;
    }
    
    const commandParts = cleanCommandLine.split(/\s+/);    
    return this._commandLineActions.some( cla => {
      if (cla.matchType === 'name') {
        const matcherParts = cla.match.split(/\s+/);
        for (let i=0; i < matcherParts.length; i++) {
          if (i >= commandParts.length) {
            return false;
          }
          if (matcherParts[i] !== commandParts[i]) {
            return false;
          }
        }
        return true;        
      } else {
        // regexp
        return (new RegExp(cla.match)).test(cleanCommandLine);
      }
    } );
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
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.cancel();
      this._resizePollHandle = null;
    }

    this._getWindow().removeEventListener('resize', this._scheduleResizeBound);
    if (this._emulator !== null) {
      this._emulator.destroy();
    }
    this._emulator = null;
  }

  /**
   * Focus on this terminal.
   */
  focus(): void {
    if (this._terminalViewer !== null) {
      const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
      const top = scrollerArea.scrollTop;
      const left = scrollerArea.scrollLeft;
      this._terminalViewer.focus();
      scrollerArea.scrollTop = top;
      scrollerArea.scrollLeft = left;
    }
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    const shadowRoot = domutils.getShadowRoot(this);
    if (shadowRoot === null) {
      return false;
    }
    return shadowRoot.activeElement !== null;
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
  
  set frameFinder(func: FrameFinder) {
    this._frameFinder = func;
  }
  
  getFrameContents(frameId: string): string {
    const embeddedViewer = this._findFrame(frameId);
    if (embeddedViewer === null) {
      return null;
    }
    const text = embeddedViewer.text;
    return text === undefined ? null : text;
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

  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties();
    this._fetchNextTag();
  }
   
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    super.attachedCallback();
    
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;

    const shadow = domutils.createShadowRoot(this);

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
    this.addEventListener(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, (ev: CustomEvent) => {
        this._handleCommandPaletteRequest(ev);
      });

    const scrollbar = <CbScrollbar> domutils.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    
    this._virtualScrollArea.setScrollContainer(scrollerArea);
    this._virtualScrollArea.setScrollbar(scrollbar);
    
    // Set up the emulator
    this._cookie = crypto.randomBytes(10).toString('hex');
    process.env[EXTRATERM_COOKIE_ENV] = this._cookie;
    this._initEmulator(this._cookie);
    this._appendNewTerminalViewer();
    
    this.updateThemeCss();
    
    scrollerArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === scrollerArea) {
        this._terminalViewer.focus();
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
    scrollerArea.addEventListener('keypress', this._handleKeyPressCapture.bind(this), true);

    scrollerArea.addEventListener(virtualscrollarea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(EtTerminalViewer.EVENT_KEYBOARD_ACTIVITY, () => {
      this._virtualScrollArea.scrollToBottom();
    });
    scrollerArea.addEventListener(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE,
      this._handleBeforeSelectionChange.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleTerminalViewerCursor.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_EDGE, this._handleTerminalViewerCursorEdge.bind(this));
    
    this._showTip();
    this._emulator.write('\x1b[31mWelcome to Extraterm!\x1b[m\r\n');
    
    this._scheduleResize();
  }
  
  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    super.detachedCallback();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL];
  }

  protected updateThemeCss() {
    super.updateThemeCss();
    this.resizeToContainer();
  }
  
  resize(): void {
    this._processFullResize();
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

      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
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
  
  private _showTip(): void {
    const config = this._configManager.getConfig();
    switch (config.showTips) {
      case 'always':
        break;
      case 'never':
        return;
      case 'daily':
        if ( (Date.now() - config.tipTimestamp) > MILLIS_PER_DAY) {
          const newConfig = _.cloneDeep(config);
          newConfig.tipTimestamp = Date.now();
          this._configManager.setConfig(newConfig);
        } else {
          return;
        }
    }
    this._appendMimeViewer(EtTipViewer.MIME_TYPE, "Tip", "utf8", "");
  }
  
  private _handleFocus(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear focused.
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.visualState = this._mode === Mode.SELECTION ? VisualState.AUTO : VisualState.FOCUSED;
      }
    });
  }
  
  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.visualState = VisualState.UNFOCUSED;
      }
    });
  }
  
  private _handleBeforeSelectionChange(ev: CustomEvent): void {
    const target = ev.target;
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node) && node !== target) {
        node.clearSelection();
      }
    });

    if (ev.detail.originMouse) {
      domutils.doLater( () => { this.copyToClipboard() } ); // FIXME This should be debounced slightly.
    }
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

  private _appendNewTerminalViewer(): void {
    // Create the TerminalViewer
    const terminalViewer = <EtTerminalViewer> document.createElement(EtTerminalViewer.TAG_NAME);
    keybindingmanager.injectKeyBindingManager(terminalViewer, this._keyBindingManager);
    config.injectConfigManager(terminalViewer, this._configManager);
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(terminalViewer);
    
    terminalViewer.visualState = domutils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED;
    terminalViewer.emulator = this._emulator;
    this._virtualScrollArea.appendScrollable(terminalViewer);

    this._terminalViewer = terminalViewer;
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
  
  private _disconnectActiveTerminalViewer(): void {
    this._emulator.moveRowsToScrollback();
    if (this._terminalViewer !== null) {
      this._terminalViewer.emulator = null;
      this._terminalViewer.deleteScreen();
      this._terminalViewer.useVPad = false;
      this._virtualScrollArea.updateScrollableSize(this._terminalViewer);
      this._terminalViewer = null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    this._emulator.moveRowsToScrollback();
    let currentTerminalViewer = this._terminalViewer;
    
    if (currentTerminalViewer !== null) {
      currentTerminalViewer.deleteScreen();
      
      if (currentTerminalViewer.isEmpty()) {
        // Keep this terminal viewer and re-use it later in the new position.
        this._virtualScrollArea.removeScrollable(currentTerminalViewer);
      } else {
        // This terminal viewer has stuff in it.
        currentTerminalViewer.emulator = null;
        currentTerminalViewer.useVPad = false;
        this._virtualScrollArea.updateScrollableSize(currentTerminalViewer);
        this._terminalViewer = null;
        currentTerminalViewer = null;
      }
    }
  
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
    if (currentTerminalViewer !== null) {
      // Move it into the DOM.
      const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
      scrollerArea.appendChild(currentTerminalViewer);
      this._virtualScrollArea.appendScrollable(currentTerminalViewer);
    } else {
      this._appendNewTerminalViewer();
    }
  }
  
  private _removeScrollableElement(el: ScrollableElement): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.removeChild(el);
    this._virtualScrollArea.removeScrollable(el);
  }

  private _replaceScrollableElement(oldEl: ScrollableElement, newEl: ScrollableElement): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
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
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node) => {
      if (ViewerElement.isViewerElement(node)) {
        node.mode = ViewerElementTypes.Mode.SELECTION;
        node.visualState = VisualState.AUTO;
      }
    });
    this._mode = Mode.SELECTION;
    if (domutils.getShadowRoot(this).activeElement !== this._terminalViewer) {
      this._terminalViewer.focus();
    }
  }
  
  private _exitSelectionMode(): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node) => {
      if (ViewerElement.isViewerElement(node)) {
        node.mode = ViewerElementTypes.Mode.DEFAULT;
        node.visualState = VisualState.FOCUSED;
      }
    });
    this._mode = Mode.DEFAULT;
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
    ev.stopPropagation();
    ev.preventDefault();
    const delta = ev.deltaY * SCROLL_STEP;
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset() + delta);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    this._updateVirtualScrollableSize(<any> ev.target); 
      // ^ We know this event only comes from VirtualScrollable elements.
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
    this._enforceScrollbackLength();
  }

  private _processFullResize(): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    if (scrollerArea !== null) {
      ResizeableElementBase.resizeChildNodes(scrollerArea);
    }
    
    this._virtualScrollArea.resize();
    this._virtualScrollArea.updateAllScrollableSizes();
    this._enforceScrollbackLength();
  }

  /**
   * Handle a resize event from the above.
   */
  private _processResize(): void {
    if (this._terminalViewer !== null) {
      this._terminalViewer.resizeEmulatorToParentContainer();
    }
    this._virtualScrollArea.resize();
    this._updateVirtualScrollableSize(this._terminalViewer);
  }

  private _handleTerminalViewerCursor(ev: CustomEvent): void {
    const node = <Node> ev.target;
    if (ViewerElement.isViewerElement(node)) {
      const pos = node.getCursorPosition();
      const nodeTop = this._virtualScrollArea.getScrollableTop(node);
      const top = pos.top + nodeTop;
      const bottom = pos.bottom + nodeTop;
      this._virtualScrollArea.scrollIntoView(top, bottom);
    } else {
      this._log.warn("_handleTerminalViewerCursor(): node is not a ViewerElement.");
    }
  }
  
  private _handleTerminalViewerCursorEdge(ev: CustomEvent): void {
    const detail = <ViewerElementTypes.CursorEdgeDetail> ev.detail;
    
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const kids = domutils.nodeListToArray(scrollerArea.childNodes);
    const index = kids.indexOf(<Node> ev.target);
    if (index === -1) {
      this._log.warn("_handleTerminalViewerCursorEdge(): Couldn't find the target.");
      return;
    }

    if (detail.edge === ViewerElementTypes.Edge.TOP) {
      // A top edge was hit. Move the cursor to the bottom of the ViewerElement above it.
      for (let i=index-1; i>=0; i--) {
        const node = kids[i];
        if (ViewerElement.isViewerElement(node)) {
          if (node.setCursorPositionBottom(detail.ch)) {
            node.focus();
            break;
          }
        }
      }
    
    } else {
      // Bottom edge. Move the cursor to the top of the next ViewerElement.
      for (let i=index+1; i<kids.length; i++) {
        const node = kids[i];
        if (ViewerElement.isViewerElement(node)) {
          if (node.setCursorPositionTop(detail.ch)) {
            node.focus();
            break;
          }
        }
      }
    }
  }

  // Run a function and only afterwards check the size of the scrollback.
  private _enforceScrollbackLengthAfter(func: () => any): any {
    const oldGuardFlag = this._enforceScrollbackLengthGuard;
    this._enforceScrollbackLengthGuard = true;
    const rc = func();
    this._enforceScrollbackLengthGuard = oldGuardFlag;
    this._enforceScrollbackLength();
    return rc;
  }
  
  private _enforceScrollbackLength(): void {
    // Prevent the scrollback check from running multiple times.
    if (this._enforceScrollbackLengthGuard) {
      return;
    }
    this._enforceScrollbackLengthGuard = true;
    const hasFocus = this.hasFocus();
    this._enforceScrollbackLength2();
    if (hasFocus && ! this.hasFocus()) {
      this.focus();
    }
    this._enforceScrollbackLengthGuard = false;
  }
  
  private _enforceScrollbackLength2(): void {
    let virtualHeight = this._virtualScrollArea.getVirtualHeight();
    const scrollbackSize = window.screen.height + this._scrollbackSize;
    const hardLimit = Math.floor(scrollbackSize * 1.1);
    if (virtualHeight < hardLimit) {
      return;
    }
    
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const kids = domutils.nodeListToArray(scrollerArea.childNodes);
    for (const kidNode of kids) {
      const scrollableKid: VirtualScrollable & HTMLElement = <any> kidNode;
      const kidVirtualHeight = this._virtualScrollArea.getScrollableVirtualHeight(scrollableKid);
      const newVirtualHeight = virtualHeight - kidVirtualHeight;
      // We don't want to cut out too much at once.
      if (newVirtualHeight > scrollbackSize) {
        // Just remove the thing. There is plenty of scrollback left over.
        this._removeScrollableElement(scrollableKid);
        
      } else {
        this._deleteTopPixels(scrollableKid, virtualHeight - scrollbackSize);
        break;
      }
      
      virtualHeight = newVirtualHeight;
      if (virtualHeight < hardLimit) {
        break;
      }
    }
  }
  
  private _deleteTopPixels(kidNode: HTMLElement & VirtualScrollable, pixelCount: number): void {
    // Try to cut part of it off.
    if (EtTerminalViewer.is(kidNode)) {
      (<EtTerminalViewer> kidNode).deleteTopPixels(pixelCount);
      return;
      
    } else if (EtEmbeddedViewer.is(kidNode)) {
      const terminalViewer = (<EtEmbeddedViewer> kidNode).viewerElement;

      if (EtTerminalViewer.is(terminalViewer)) {
        terminalViewer.deleteTopPixels(pixelCount);
        return;  
        
      } else if (EtTextViewer.is(terminalViewer)) {
        (<EtTextViewer> terminalViewer).deleteTopPixels(pixelCount);
        return;
      }
    }
    this._removeScrollableElement(kidNode);
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
    if (this._terminalViewer === null || this._keyBindingManager === null ||
        this._keyBindingManager.getKeyBindingContexts() === null) {
      return;
    }
    
    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_SELECTION_MODE);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
    } else {
      if (this._mode !== Mode.SELECTION && ev.target !== this._terminalViewer) {
        // Route the key down to the current code mirror terminal which has the emulator attached.
        const simulatedKeydown = domutils.newKeyboardEvent('keydown', ev);
        ev.stopPropagation();
        if ( ! this._terminalViewer.dispatchEvent(simulatedKeydown)) {
          // Cancelled.
          ev.preventDefault();
        }
      }
    }
  }

  private _handleKeyPressCapture(ev: KeyboardEvent): void {
    if (this._terminalViewer === null) {
      return;
    }

    if (this._mode !== Mode.SELECTION && ev.target !== this._terminalViewer) {
      // Route the key down to the current code mirror terminal which has the emulator attached.
      const simulatedKeypress = domutils.newKeyboardEvent('keypress', ev);
      ev.preventDefault();
      ev.stopPropagation();
      if ( ! this._terminalViewer.dispatchEvent(simulatedKeypress)) {
        // Cancelled.
        ev.preventDefault();
      }
    }
  }
  
  private _handleCommandPaletteRequest(ev: CustomEvent): void {
    if (ev.path[0] === this) { // Don't process our own messages.
      return;
    }
    
    ev.stopPropagation();
    
    const request: CommandPaletteRequestTypes.CommandPaletteRequest = ev.detail;
    const commandPaletteRequestDetail: CommandPaletteRequest = {
        srcElement: request.srcElement === null ? this : request.srcElement,
        commandEntries: [...request.commandEntries, ...this._commandPaletteEntries()],
        contextElement: this
      };
    const commandPaletteRequestEvent = new CustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST,
      { detail: commandPaletteRequestDetail });
    commandPaletteRequestEvent.initCustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, true, true,
      commandPaletteRequestDetail);
    this.dispatchEvent(commandPaletteRequestEvent);
  }

  private _commandPaletteEntries(): CommandPaletteRequestTypes.CommandEntry[] {
    const commandList: CommandPaletteRequestTypes.CommandEntry[] = [
      { id: COMMAND_ENTER_SELECTION_MODE, iconRight: "i-cursor", label: "Enter cursor mode", target: this },
      { id: COMMAND_ENTER_NORMAL_MODE, label: "Enter normal mode", target: this },
      { id: COMMAND_SCROLL_PAGE_UP, iconRight: "angle-double-up", label: "Scroll Page Up", target: this },
      { id: COMMAND_SCROLL_PAGE_DOWN, iconRight: "angle-double-down", label: "Scroll Page Down", target: this },
      { id: COMMAND_COPY_TO_CLIPBOARD, iconRight: "copy", label: "Copy to Clipboard", target: this },
      { id: COMMAND_PASTE_FROM_CLIPBOARD, iconRight: "clipboard", label: "Paste from Clipboard", target: this },
      { id: COMMAND_DELETE_LAST_FRAME, iconRight: "times-circle", label: "Delete Last Frame", target: this },
      { id: COMMAND_OPEN_LAST_FRAME, iconRight: "external-link", label: "Open Last Frame", target: this },
    ];

    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_SELECTION_MODE);
    if (keyBindings !== null) {
      commandList.forEach( (commandEntry) => {
        const shortcut = keyBindings.mapCommandToKeyBinding(commandEntry.id)
        commandEntry.shortcut = shortcut === null ? "" : shortcut;
      });
    }    
    return commandList;
  }

  executeCommand(commandId: string): void {
    this._executeCommand(commandId);
  }
  
  private _executeCommand(command: string): boolean {
      switch (command) {
        case COMMAND_ENTER_SELECTION_MODE:
          this._enterSelectionMode();
          break;

        case COMMAND_ENTER_NORMAL_MODE:
          this._exitSelectionMode();
          break;
          
        case COMMAND_SCROLL_PAGE_UP:
          this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
            - this._virtualScrollArea.getScrollContainerHeight() / 2);
          break;
          
        case COMMAND_SCROLL_PAGE_DOWN:
          this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
            + this._virtualScrollArea.getScrollContainerHeight() / 2);
          break;

        case COMMAND_COPY_TO_CLIPBOARD:
          this.copyToClipboard();
          break;

        case COMMAND_PASTE_FROM_CLIPBOARD:
          this._pasteFromClipboard();
          break;

        case COMMAND_DELETE_LAST_FRAME:
          this._deleteLastEmbeddedViewer();
          break;

        case COMMAND_OPEN_LAST_FRAME:
          const viewer = this._getLastEmbeddedViewer();
          if (viewer !== null) {
            this._embeddedViewerPopOutEvent(viewer);
          }
          break;
        
      default:
        return false;
    }
    return true;
  }

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
   * @param {EtTerminalViewer} updateTarget [description]
   */
  // private _scheduleCursorMoveUpdate(updateTarget: EtTerminalViewer): void {
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
      this._scheduleLaterHandle = domutils.doLater(this._processScheduled.bind(this));
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
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("application-mode started! ",params);
    }

    this._htmlData = "";
    
    // Check security cookie
    if (params.length === 0) {
      this._log.warn("Received an application mode sequence with no parameters.");
      return;
    }
    
    if (params[0] !== this._cookie) {
      this._log.warn("Received the wrong cookie at the start of an application mode sequence.");
      return;
    }
  
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
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_OUTPUT_BRACKET_END");
          }
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
          this._applicationMode = ApplicationMode.APPLICATION_MODE_REQUEST_FRAME;
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_REQUEST_FRAME");
          }
          break;
          
        case "" + ApplicationMode.APPLICATION_MODE_SHOW_FILE:
          if (DEBUG_APPLICATION_MODE) {
            this._log.debug("Starting APPLICATION_MODE_SHOW_FILE");
          }
          this._applicationMode = ApplicationMode.APPLICATION_MODE_SHOW_FILE;
          this._showData = "";
          this._showPayloadSize = params[2];
          break;
        
        default:
          this._log.warn("Unrecognized application escape parameters.");
          break;
      }
    }
  }

  /**
   * Handle incoming data while in application mode.
   * 
   * @param {string} data The new data.
   */
  private _handleApplicationModeData(data: string): void {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode data!", data);
    }
    switch (this._applicationMode) {
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_START:
      case ApplicationMode.APPLICATION_MODE_OUTPUT_BRACKET_END:
      case ApplicationMode.APPLICATION_MODE_REQUEST_FRAME:
        this._htmlData = this._htmlData + data;
        break;
        
      case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
        this._showData = this._showData + data;
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
        
      case ApplicationMode.APPLICATION_MODE_SHOW_FILE:
        this._handleShowFile(this._showPayloadSize, this._showData);
        this._showPayloadSize = "";
        this._showData = "";
        break;
        
      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode end!",this._htmlData);
    }
    this._htmlData = null;
  }

  private _handleApplicationModeBracketStart(): void {
    const scrollArea = domutils.getShadowId(this, ID_SCROLL_AREA);
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
    } else {
      
      let currentTerminalViewer = this._terminalViewer;
      if (currentTerminalViewer !== null) {
        currentTerminalViewer.deleteScreen();
      }
      this._emulator.moveRowsToScrollback();
      
      this._lastCommandTerminalLine = this._terminalViewer.bookmarkLine(this._terminalViewer.lineCount() -1);
      this._lastCommandLine = cleancommand;
      this._lastCommandTerminalViewer = this._terminalViewer;
    }
    this._virtualScrollArea.resize();
  }
  
  public deleteEmbeddedViewer(viewer: EtEmbeddedViewer): void {
    viewer.remove();
    this._virtualScrollArea.removeScrollable(viewer);
  }
  
  private _getLastEmbeddedViewer(): EtEmbeddedViewer {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);  
    const kids = scrollerArea.children;
    const len = kids.length;
    for (let i=len-1; i>=0;i--) {
      const kid = kids[i];
      if (EtEmbeddedViewer.is(kid)) {
        return kid;
      }
    }
    return null;
  }
  
  private _deleteLastEmbeddedViewer(): void {
    const kid = this._getLastEmbeddedViewer();
    if (kid === null) {
      return;
    }
    this.deleteEmbeddedViewer(kid);
    this.focus();
  }
  
  private _createEmbeddedViewerElement(title: string): EtEmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EtEmbeddedViewer> this._getWindow().document.createElement(EtEmbeddedViewer.TAG_NAME);
    keybindingmanager.injectKeyBindingManager(el, this._keyBindingManager);
    config.injectConfigManager(el, this._configManager);
    el.awesomeIcon = 'cog';
    el.addEventListener(EtEmbeddedViewer.EVENT_CLOSE_REQUEST, () => {
      this.deleteEmbeddedViewer(el);
      this.focus();
    });

    el.addEventListener(generalevents.EVENT_TYPE_TEXT, (ev: CustomEvent) => {
      const detail: generalevents.TypeTextEventDetail = ev.detail;
      this._sendDataToPtyEvent(ev.detail.text);
    });

    el.addEventListener(generalevents.EVENT_SET_MODE, (ev: CustomEvent) => {
      const detail: generalevents.SetModeEventDetail = ev.detail;
      if (detail.mode !== this._mode) {
        switch (this._mode) {
          case Mode.DEFAULT:
              this._enterSelectionMode();
              break;

          case Mode.SELECTION:
              this._exitSelectionMode();
              break;
        }
      }
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
    
    el.visualState = domutils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED;
    el.setAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE, title);
    el.setAttribute(EtEmbeddedViewer.ATTR_TAG, "" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    this._enforceScrollbackLengthAfter( () => {
      this._closeLastEmbeddedViewer(this._htmlData);
    });
  }
  
  private _closeLastEmbeddedViewer(returnCode: string): void {
    const scrollArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const startElement = scrollArea.querySelectorAll(
      `${EtEmbeddedViewer.TAG_NAME}:not([${EtEmbeddedViewer.ATTR_RETURN_CODE}])`);
    
    if (startElement.length !== 0) {
      // Finish framing an already existing Embedded viewer bar.
      
      let embeddedSomethingElement = <HTMLElement>startElement[startElement.length-1];
      const embeddedViewerElement = <EtEmbeddedViewer> embeddedSomethingElement;
      
      const activeTerminalViewer = this._terminalViewer;
      this._disconnectActiveTerminalViewer();
      
      activeTerminalViewer.returnCode = returnCode;
      activeTerminalViewer.commandLine = embeddedViewerElement.getAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE);
      activeTerminalViewer.useVPad = false;
      
      // Hang the terminal viewer under the Embedded viewer.
      embeddedViewerElement.setAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE, returnCode);
      embeddedViewerElement.awesomeIcon = returnCode === '0' ? 'check' : 'times';
      embeddedViewerElement.setAttribute(EtEmbeddedViewer.ATTR_TOOL_TIP, "Return code: " + returnCode);
      embeddedViewerElement.className = "extraterm_output";
      
      // Some focus management to make sure that activeTerminalViewer still keeps
      // the focus after we remove it from the DOM and place it else where.
      const restoreFocus = domutils.getShadowRoot(this).activeElement === activeTerminalViewer;
      const previousActiveTerminal = activeTerminalViewer;
      
      embeddedViewerElement.viewerElement = activeTerminalViewer;
      activeTerminalViewer.editable = true;
      this._virtualScrollArea.removeScrollable(activeTerminalViewer);
      this._virtualScrollArea.updateScrollableSize(embeddedViewerElement);
      this._appendNewTerminalViewer();
      
      if (restoreFocus) {
        previousActiveTerminal.focus();
      }
    } else {
      
      if (this._lastCommandTerminalViewer === null) {
        // Nothing to frame.
        return;
      }
      
      if (returnCode === "0") {
        // No need to frame anything.
        this._lastCommandLine = null;
        this._lastCommandTerminalViewer = null;
        return;
      }
      
      // Insert a frame where there was none because this command returned an error code.
      
      // Close off the current terminal viewer.
      this._disconnectActiveTerminalViewer();
      
      // Extract the output of the failed command.
      const moveText = this._lastCommandTerminalViewer.getDecoratedLines(this._lastCommandTerminalLine);
      this._lastCommandTerminalViewer.deleteLines(this._lastCommandTerminalLine);
      this._lastCommandTerminalViewer = null;
      
      // Append our new embedded viewer.
      const newViewerElement = this._createEmbeddedViewerElement(this._lastCommandLine);
      // Hang the terminal viewer under the Embedded viewer.
      newViewerElement.setAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE, returnCode);
      newViewerElement.awesomeIcon = 'times';
      newViewerElement.setAttribute(EtEmbeddedViewer.ATTR_TOOL_TIP, "Return code: " + returnCode);
      newViewerElement.className = "extraterm_output";
      scrollArea.appendChild(newViewerElement);
      
      // Create a terminal viewer to display the output of the last command.
      const outputTerminalViewer = <EtTerminalViewer> document.createElement(EtTerminalViewer.TAG_NAME);
      keybindingmanager.injectKeyBindingManager(outputTerminalViewer, this._keyBindingManager);
      config.injectConfigManager(outputTerminalViewer, this._configManager);
      newViewerElement.viewerElement = outputTerminalViewer;
      
      outputTerminalViewer.visualState = domutils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED;
      outputTerminalViewer.returnCode = returnCode;
      outputTerminalViewer.commandLine = this._lastCommandLine;
      outputTerminalViewer.useVPad = false;
      if (moveText !== null) {
        outputTerminalViewer.setDecoratedLines(moveText.text, moveText.decorations);
      }
      outputTerminalViewer.editable = true;
      
      this._virtualScrollArea.appendScrollable(newViewerElement);
        
      this._appendNewTerminalViewer();
      
      const activeTerminalViewer = this._terminalViewer;
      this._virtualScrollArea.updateScrollableSize(activeTerminalViewer);
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
    let text: string = null;
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const kids = domutils.nodeListToArray(scrollerArea.childNodes);
    for (let i=0; i<kids.length; i++) {
      const node = kids[i];
      if (ViewerElement.isViewerElement(node)) {
        text = node.getSelectionText();
        if (text !== null) {
          webipc.clipboardWrite(text);
          break;
        }
      }
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
    let data = "";
    if (this._frameFinder !== null) {
      data = this._frameFinder(frameId);
    } else {
      data = this.getFrameContents(frameId);
    }
    
    const lines = data.split("\n");
    let encodedData: string = "";
    lines.forEach( (line: string) => {
      const utf8line = utf8.encode(line);
      encodedData = window.btoa(utf8line +"\n");
      this._sendDataToPtyEvent("#" + encodedData + "\n");
    });
      
    this._sendDataToPtyEvent("#;0\n");  // Terminating char
  }

  private _handleShowFile(metadataSizeStr: string, encodedData: string): void {
    const metadataSize = parseInt(metadataSizeStr,10);
    if (metadataSize > encodedData.length) {
      this._log.warn("Received corrupt data for a 'show' control sequence.");
      return;
    }
    
    const metadata = JSON.parse(encodedData.substr(0, metadataSize));
    const charset = metadata.charset === undefined ? null : metadata.charset;
    this._appendMimeViewer(metadata.mimeType, metadata.filename, charset, encodedData.slice(metadataSize));
  }

  private _appendMimeViewer(mimeType:string, filename: string, charset: string, encodedData: string): void {
    const mimeViewerElement = this._createMimeViewer(mimeType, charset, encodedData);
    if (mimeViewerElement !== null) {
      this._closeLastEmbeddedViewer("0");
      const viewerElement = this._createEmbeddedViewerElement("viewer");
      viewerElement.viewerElement = mimeViewerElement;
      viewerElement.setAttribute(EtEmbeddedViewer.ATTR_FRAME_TITLE, filename);
      viewerElement.awesomeIcon = mimeViewerElement.awesomeIcon;
      viewerElement.setAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE, "0"); // FIXME
      this._appendScrollableElement(viewerElement);
      this._enforceScrollbackLength();
    }
  }

  private _createMimeViewer(mimeType: string, charset: string, mimeData: string): ViewerElement {
    const candidates = viewerClasses.filter( (viewerClass) => viewerClass.supportsMimeType(mimeType) );
    
    if (candidates.length === 0) {
      this._log.debug("Unknown mime type: " + mimeType);
      return null;
    }
    
    const dataViewer = <ViewerElement> this._getWindow().document.createElement(candidates[0].TAG_NAME);
    keybindingmanager.injectKeyBindingManager(dataViewer, this._keyBindingManager);
    config.injectConfigManager(dataViewer, this._configManager);
    const buffer = new Uint8Array(base64arraybuffer.decode(mimeData));
    dataViewer.setBytes(buffer, charset !== null ? mimeType + ";" + charset : mimeType);
    dataViewer.editable = true;
    return dataViewer;
  }

  /**
   * Find a command frame by ID.
   */
  private _findFrame(frameId: string): EtEmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    
    const scrollArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const matches = scrollArea.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  }
  
  private _getNextTag(): string {
    let tag  = this._nextTag;
    if (tag === null) {
      // Fetching new tags from the main process is async. If we get here it means
      // that we were waiting for a new tag to arrive. Just fetch one sync.
      tag = webipc.requestNewTagSync();
    }
    this._fetchNextTag();
    return tag;
  }
  
  private _fetchNextTag(): void {
    webipc.requestNewTag().then( (msg: Messages.NewTagMessage) => {
      this._nextTag = msg.tag;
    });
  }
}

export = EtTerminal;
