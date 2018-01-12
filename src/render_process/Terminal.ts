/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import * as _ from 'lodash';
import * as utf8 from 'utf8';
import {clipboard} from 'electron';
import {Disposable} from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';

import {BulkFileBroker} from './bulk_file_handling/BulkFileBroker';
import {BulkFileHandle} from './bulk_file_handling/BulkFileHandle';
import {BulkFileUploader} from './bulk_file_handling/BulkFileUploader';
import * as BulkFileUtils from './bulk_file_handling/BulkFileUtils';
import * as DisposableUtils from '../utils/DisposableUtils';
import {DownloadApplicationModeHandler} from './DownloadApplicationModeHandler';
import {DownloadViewer} from './viewers/DownloadViewer';
import {Pty} from '../pty/Pty';

import {ViewerElement} from './viewers/ViewerElement';
import * as ViewerElementTypes from './viewers/ViewerElementTypes';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';
import {ResizeCanary} from './ResizeCanary';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as ThemeTypes from '../theme/Theme';
import {EmbeddedViewer} from './viewers/EmbeddedViewer';
import {CommandPlaceHolder} from './CommandPlaceholder';
import {TerminalViewer} from './viewers/TerminalViewer';
import {TextDecoration, BookmarkRef} from './viewers/TerminalViewerTypes';
import {TextViewer} from './viewers/TextViewer';
import {ImageViewer} from './viewers/ImageViewer';
import {TipViewer} from './viewers/TipViewer';
import * as GeneralEvents from './GeneralEvents';
import {KeyBindingManager, injectKeyBindingManager, AcceptsKeyBindingManager} from './keybindings/KeyBindingManager';
import {Commandable, EVENT_COMMAND_PALETTE_REQUEST, CommandEntry, COMMAND_OPEN_COMMAND_PALETTE}
  from './CommandPaletteRequestTypes';
import {Logger, getLogger} from '../logging/Logger';
import LogDecorator from '../logging/LogDecorator';
import * as DomUtils from './DomUtils';
import {doLater} from '../utils/DoLater';
import * as Term from './emulator/Term';
import * as TermApi from './emulator/TermApi';
import {ScrollBar} from './gui/ScrollBar';
import {UploadProgressBar} from './UploadProgressBar';
import * as util from './gui/Util';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';
import * as VirtualScrollArea from './VirtualScrollArea';
import {FrameFinder} from './FrameFinderType';
import * as CodeMirrorOperation from './codemirror/CodeMirrorOperation';
import {Config, ConfigDistributor, CommandLineAction, injectConfigDistributor, AcceptsConfigDistributor} from '../Config';
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type VirtualScrollArea = VirtualScrollArea.VirtualScrollArea;
const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;

type Mode = ViewerElementTypes.Mode;  // This is the enum type.
const Mode = ViewerElementTypes.Mode; // This gets us access to the object holding the enum values.

type ScrollableElement = VirtualScrollable & HTMLElement;

const log = LogDecorator;

const DEBUG = true;
const DEBUG_APPLICATION_MODE = false;

let startTime: number = window.performance.now();

const ID = "EtTerminalTemplate";
export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";
const ID_SCROLL_CONTAINER = "ID_SCROLL_CONTAINER";
const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CSS_VARS = "ID_CSS_VARS";
const KEYBINDINGS_DEFAULT_MODE = "terminal-default-mode";
const KEYBINDINGS_CURSOR_MODE = "terminal-cursor-mode";

const PALETTE_GROUP = "terminal";
const COMMAND_ENTER_CURSOR_MODE = "enterCursorMode";
const COMMAND_ENTER_NORMAL_MODE = "enterNormalMode";
const COMMAND_SCROLL_PAGE_UP = "scrollPageUp";
const COMMAND_SCROLL_PAGE_DOWN = "scrollPageDown";
const COMMAND_COPY_TO_CLIPBOARD = "copyToClipboard";
const COMMAND_PASTE_FROM_CLIPBOARD = "pasteFromClipboard";
const COMMAND_DELETE_LAST_FRAME = "deleteLastFrame";
const COMMAND_OPEN_LAST_FRAME = "openLastFrame";
const COMMAND_RESET_VT = "resetVT";
const COMMAND_CLEAR_SCROLLBACK = "clearScrollback";
const COMMAND_FONT_SIZE_INCREASE = "increaseFontSize";
const COMMAND_FONT_SIZE_DECREASE = "decreaseFontSize";
const COMMAND_FONT_SIZE_RESET = "resetFontSize";
const COMMAND_GO_TO_PREVIOUS_FRAME = "goToPreviousFrame";
const COMMAND_GO_TO_NEXT_FRAME = "goToNextFrame";

const CHILD_RESIZE_BATCH_SIZE = 3;

const CLASS_CURSOR_MODE = "cursor-mode";
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

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;

// List of viewer classes.
const viewerClasses: ViewerElementTypes.SupportsMimeTypes[] = [];
viewerClasses.push(ImageViewer);
viewerClasses.push(TextViewer);
viewerClasses.push(TipViewer);
viewerClasses.push(DownloadViewer);

interface ChildElementStatus {
  element: VirtualScrollable & HTMLElement;
  needsRefresh: boolean;
  refreshLevel: ResizeRefreshElementBase.RefreshLevel;
}

interface WriteBufferStatus {
  bufferSize: number;
}

/**
 * An Extraterm terminal.
 * 
 * An EtTerminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 */
@WebComponent({tag: "et-terminal"})
export class EtTerminal extends ThemeableElementBase implements Commandable, AcceptsKeyBindingManager,
  AcceptsConfigDistributor, Disposable, SupportsClipboardPaste.SupportsClipboardPaste {
  
  static TAG_NAME = "ET-TERMINAL";
  static EVENT_TITLE = "title";
  static EVENT_EMBEDDED_VIEWER_POP_OUT = "viewer-pop-out";
  
  private _log: Logger;
  private _pty: Pty = null;
  private _virtualScrollArea: VirtualScrollArea.VirtualScrollArea = null;
  private _stashArea: DocumentFragment = null;
  private _childElementList: ChildElementStatus[] = [];

  private _autoscroll = true;
  
  private _terminalViewer: TerminalViewer = null;
  
  private _emulator: Term.Emulator = null;
  private _cookie = null;
  private _htmlData: string = null;
  
  private _fileBroker: BulkFileBroker = null;
  private _downloadHandler: DownloadApplicationModeHandler = null;
  
  private _applicationMode: ApplicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  private _bracketStyle: string = null;

  // The command line string of the last command started.
  private _lastCommandLine: string = null;
  
  // The terminal viewer containing the start output of the last command started.
  private _lastCommandTerminalViewer: TerminalViewer = null;
  
  // The line number of the start of output of the last command started.
  private _lastCommandTerminalLine: BookmarkRef = null;
  
  private _mode: Mode = Mode.DEFAULT;
  private _selectionPreviousLineCount: number;
  
  private _configManager: ConfigDistributor = null;
  private _keyBindingManager: KeyBindingManager = null;
  
  private _title = "New Tab";
  private _frameFinder: FrameFinder = null;
  private _scrollbackSize: number;
  
  private _nextTag: string = null;

  private _themeCssPath: string = null;
  private _mainStyleLoaded = false;
  private _themeStyleLoaded = false;
  private _resizePollHandle: Disposable = null;
  private _elementAttached = false;
  private _needsCompleteRefresh = true;

  // This flag is needed to prevent the _enforceScrollbackLength() method from being run recursively
  private _enforceScrollbackLengthGuard= false;
  
  private _scheduleLaterHandle: Disposable = null;
  private _scheduleLaterQueue: Function[] = [];
  private _stashedChildResizeTask: () => void = null;

  private _scheduleResizeBound: any;

  // The current size of the emulator. This is used to detect changes in size.
  private _columns = -1;
  private _rows = -1;
  private _fontSizeAdjustment = 0;
  private _armResizeCanary = false;  // Controls when the resize canary is allowed to chirp.

  private _childFocusHandlerFunc: (ev: FocusEvent) => void;

  constructor() {
    super();
    this._log = getLogger(EtTerminal.TAG_NAME, this);
    this._childFocusHandlerFunc = this._handleChildFocus.bind(this);
    this._fetchNextTag();
  }
   
  /**
   * Custom Element 'connected' life cycle hook.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._elementAttached) {
      this._elementAttached = true;

      this._stashArea = window.document.createDocumentFragment();
      this._stashArea.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this._createClone();
      shadow.appendChild(clone);
      
      this.addEventListener('focus', this._handleFocus.bind(this));
      this.addEventListener('blur', this._handleBlur.bind(this));

      const scrollbar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
      const scrollArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
      const scrollContainer = DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
      DomUtils.preventScroll(scrollContainer);

      DomUtils.addCustomEventResender(scrollContainer, GeneralEvents.EVENT_DRAG_STARTED, this);
      DomUtils.addCustomEventResender(scrollContainer, GeneralEvents.EVENT_DRAG_ENDED, this);

      this._virtualScrollArea = new VirtualScrollArea.VirtualScrollArea();
      this._virtualScrollArea.setScrollFunction( (offset: number): void => {
        scrollArea.style.top = "-" + offset + "px";
      });
      this._virtualScrollArea.setScrollbar(scrollbar);
      this._virtualScrollArea.setSetTopFunction(this._setTopFunction.bind(this));
      this._virtualScrollArea.setMarkVisibleFunction(this._markVisible.bind(this));

      // Set up the emulator
      this._cookie = crypto.randomBytes(10).toString('hex');
      process.env[EXTRATERM_COOKIE_ENV] = this._cookie;
      this._initEmulator(this._cookie);
      this._appendNewTerminalViewer();
      
      this.updateThemeCss();

      scrollContainer.addEventListener('mousedown', (ev: MouseEvent): void => {
        if (ev.target === scrollContainer) {
          ev.preventDefault();
          ev.stopPropagation();
          this._terminalViewer.focus();
          if (ev.buttons & 2) { // Right Mouse Button
            this._handleContextMenu();
          }
        }
      });
      
      scrollArea.addEventListener('mousedown', (ev: MouseEvent): void => {
        if (ev.target === scrollArea) {
          this._terminalViewer.focus();
          ev.preventDefault();
          ev.stopPropagation();
        }
      });
      
      scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
        this._virtualScrollArea.scrollTo(scrollbar.getPosition());
      });

      scrollArea.addEventListener('wheel', this._handleMouseWheel.bind(this), true);
      scrollContainer.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
      scrollArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);

      scrollArea.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
      scrollArea.addEventListener(TerminalViewer.EVENT_KEYBOARD_ACTIVITY, () => {
        this._virtualScrollArea.scrollToBottom();
      });
      scrollArea.addEventListener(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE,
        this._handleBeforeSelectionChange.bind(this));
      scrollArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleTerminalViewerCursor.bind(this));
      scrollArea.addEventListener(ViewerElement.EVENT_CURSOR_EDGE, this._handleTerminalViewerCursorEdge.bind(this));
      
      scrollArea.addEventListener(GeneralEvents.EVENT_TYPE_TEXT, (ev: CustomEvent) => {
        const detail: GeneralEvents.TypeTextEventDetail = ev.detail;
        this.send(ev.detail.text);
      });

      // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      const resizeCanary = <ResizeCanary> document.createElement(ResizeCanary.TAG_NAME);
      resizeCanary.setCss(`
          font-family: var(--terminal-font);
          font-size: var(--terminal-font-size);
      `);
      containerDiv.appendChild(resizeCanary);
      resizeCanary.addEventListener('resize', () => {
        if (this._armResizeCanary) {
          this._armResizeCanary = false;
          this.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
        }
      });

      this._showTip();
      
      this._scheduleResize();
    } else {

      // This was already attached at least once.
      this._scheduleResize();
    }

    this._setFontSizeInCss(this._fontSizeAdjustment);
  }
  
  /**
   * Custom Element 'disconnected' life cycle hook.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._needsCompleteRefresh = true;
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL];
  }

  dispose(): void {
    this._disposeChildren();
  }

  private _disposeChildren(): void {
    for (const kid of this._childElementList) {
      if (DisposableUtils.isDisposable(kid.element)) {
        kid.element.dispose();
      }
    }
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
  setBlinkingCursor(blink: boolean): void {
    // this._blinkingCursor = blink;
    // if (this._term !== null) {
    //   this._term.setCursorBlink(blink);
    // }
  }
  
  /**
   * The number of columns in the terminal screen.
   */
  getColumns(): number {
    return this._columns;
  }

  /**
   * The number of rows in the terminal screen.
   */
  getRows(): number {
    return this._rows;
  }

  getPty(): Pty {
    return this._pty;
  }

  setPty(pty: Pty): void {
    this._pty = pty;

    pty.onData((text: string): void => {
      this._emulator.write(text);
      // FIXME flow control.
    });

    doLater(() => {
      pty.resize(this._columns, this._rows);
    })
  }

  setConfigDistributor(configManager: ConfigDistributor): void {
    this._configManager = configManager;
  }
  
  setKeyBindingManager(keyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = keyBindingManager;
  }
  
  setBulkFileBroker(fileBroker: BulkFileBroker): void {
    this._fileBroker = fileBroker;

    if (this._emulator != null) {
      this._initDownloadApplicationModeHandler();
    }
  }

  setScrollbackSize(scrollbackSize: number): void {
    this._scrollbackSize = scrollbackSize;
  }
  
  getScrollbackSize(): number {
    return this._scrollbackSize;
  }
  
  private _isNoFrameCommand(commandLine: string): boolean {
    const cleanCommandLine = commandLine.trim();
    if (cleanCommandLine === "") {
      return true;
    }
    
    const commandParts = cleanCommandLine.split(/\s+/);
    if (this._configManager === null) {
      return false;
    } else {
    
      const commandLineActions = this._configManager.getConfig().commandLineActions || [];
      return commandLineActions
        .filter( cla => ! cla.frame)
        .some( cla => {
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
  }

  /**
   * Get this terminal's title.
   *
   * This is the window title of the terminal, don't confuse it with more
   * general HTML title of the element.
   */
  getTerminalTitle(): string {
    return this._title;
  }
  
  /**
   * Destroy the terminal.
   */
  destroy(): void {
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.dispose();
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
      DomUtils.focusWithoutScroll(this._terminalViewer);
    }
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    const shadowRoot = DomUtils.getShadowRoot(this);
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
  write(text: string): WriteBufferStatus {
    return this._emulator.write(text);
  }
  
  /**
   * Send data to the pty and process connected to the terminal.
   * @param text the data to send.
   */
  send(text: string): void {
    this._pty.write(text);
  }
    
  resizeToContainer(): void {
    this._scheduleResize();
  }
  
  setFrameFinder(func: FrameFinder): void {
    this._frameFinder = func;
  }
  
  getFrameContents(frameId: string): BulkFileHandle {
    const embeddedViewer = this.getEmbeddedViewerByFrameId(frameId);
    if (embeddedViewer === null) {
      return null;
    }
    const text = embeddedViewer.getBulkFileHandle();
    return text === undefined ? null : text;
  }

  getEmbeddedViewerByFrameId(frameId: string): EmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    
    for (const elementStat of this._childElementList) {
      const element = elementStat.element;
      if (EmbeddedViewer.is(element) && element.getTag() === frameId) {
        return element;
      }
    }
    return null;
  }

  getFontAdjust(): number {
    return this._fontSizeAdjustment;
  }

  setFontAdjust(delta: number): void {
    this._adjustFontSize(delta)
  }

  getViewerElements(): ViewerElement[] {
    return <ViewerElement[]> this._childElementList
      .map(status => status.element)
      .filter(el => el instanceof ViewerElement);
  }
    
  getExtratermCookieValue(): string {
    return this._cookie;
  }


  protected updateThemeCss() {
    super.updateThemeCss();
    this.resizeToContainer();
  }
  
  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._processRefresh(level);
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
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
      <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_CONTAINER}'>
            <div id='${ID_SCROLL_AREA}'></div>
          </div>
          <${ScrollBar.TAG_NAME} id='${ID_SCROLLBAR}'></${ScrollBar.TAG_NAME}>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _getCssVarsRules(): string {
    return `
    #${ID_CONTAINER} {
        ${this._getCssFontSizeRule(this._fontSizeAdjustment)}
    }
    `;
  }

  private _getCssFontSizeRule(adjustment: number): string {
    const scale = [0.6, 0.75, 0.89, 1, 1.2, 1.5, 2, 3][adjustment-MINIMUM_FONT_SIZE];
    return `--terminal-font-size: calc(var(--default-terminal-font-size) * ${scale});`;
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
        if ( (Date.now() - config.tipTimestamp) < MILLIS_PER_DAY) {
          return;
        }
    }

    this._appendMimeViewer(TipViewer.MIME_TYPE, null);
    const newConfig = _.cloneDeep(config);
    newConfig.tipTimestamp = Date.now();
    newConfig.tipCounter = newConfig.tipCounter + 1;
    this._configManager.setConfig(newConfig);
  }
  
  private _handleFocus(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear focused.
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    DomUtils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(this._mode === Mode.CURSOR ? VisualState.AUTO : VisualState.FOCUSED);
      }
    });
  }
  
  private _refocus(): void {
    if (this.hasFocus() && this._mode === Mode.DEFAULT && this._terminalViewer != null && ! this._terminalViewer.hasFocus()) {
      DomUtils.focusWithoutScroll(this._terminalViewer);
    }
  }

  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    DomUtils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(VisualState.UNFOCUSED);
      }
    });
  }
  
  private _handleBeforeSelectionChange(ev: CustomEvent): void {
    const target = ev.target;
    this._childElementList.forEach( (nodeInfo): void => {
      const node = nodeInfo.element;
      if (ViewerElement.isViewerElement(node) && node !== target) {
        node.clearSelection();
      }
    });

    if (ev.detail.originMouse) {
      doLater( () => { this.copyToClipboard() } ); // FIXME This should be debounced slightly.
    }
  }

  private _handleChildFocus(ev: FocusEvent): void {
    // This needs to be done later otherwise it tickles a bug in
    // Chrome/Blink and prevents drag and drop from working.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=726248
    doLater( () => {
      if (this._mode === Mode.DEFAULT) {
        this.focus();
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
    const emulator = new Term.Emulator({
      userAgent: window.navigator.userAgent,
      applicationModeCookie: cookie,
      debug: true
    });
    
    emulator.debug = true;
    emulator.addTitleChangeEventListener(this._handleTitle.bind(this));
    emulator.addDataEventListener(this._handleTermData.bind(this));
    emulator.addRenderEventListener(this._handleTermSize.bind(this));
    
    // Application mode handlers
    const applicationModeHandler: TermApi.ApplicationModeHandler = {
      start: this._handleApplicationModeStart.bind(this),
      data: this._handleApplicationModeData.bind(this),
      end: this._handleApplicationModeEnd.bind(this)
    };
    emulator.registerApplicationModeHandler(applicationModeHandler);
    emulator.addWriteBufferSizeEventListener(this._handleWriteBufferSize.bind(this));
    this._emulator = emulator;
    this._initDownloadApplicationModeHandler();
  }

  private _initDownloadApplicationModeHandler(): void {
    this._downloadHandler = new DownloadApplicationModeHandler(this._emulator, this._fileBroker);
    this._downloadHandler.onCreatedBulkFile(this._handleShowFile.bind(this));
  }

  private _appendNewTerminalViewer(): void {
    // Create the TerminalViewer
    const terminalViewer = <TerminalViewer> document.createElement(TerminalViewer.TAG_NAME);
    injectKeyBindingManager(terminalViewer, this._keyBindingManager);
    injectConfigDistributor(terminalViewer, this._configManager);
    
    terminalViewer.setEmulator(this._emulator);

    this._terminalViewer = terminalViewer;  // Putting this in _terminalViewer now prevents the VirtualScrollArea 
                                            // removing it from the DOM in the next method call.
    this._appendScrollable(terminalViewer)
    
    terminalViewer.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);

    this._emulator.refreshScreen();
  }

  private _appendScrollable(el: HTMLElement & VirtualScrollable): void {
    el.addEventListener('focus', this._childFocusHandlerFunc);
    
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    this._childElementList.push( { element: el, needsRefresh: false, refreshLevel: ResizeRefreshElementBase.RefreshLevel.RESIZE } );
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }

  private _removeScrollable(el: HTMLElement & VirtualScrollable): void {
    el.removeEventListener('focus', this._childFocusHandlerFunc);

    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    if (el.parentElement === scrollerArea) {
      scrollerArea.removeChild(el);
    } else if(el.parentNode === this._stashArea) {
      this._stashArea.removeChild(el);
    }

    const pos = this._childElementListIndexOf(el);
    this._childElementList.splice(pos, 1);

    this._virtualScrollArea.removeScrollable(el);
  }

  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  private _handleTitle(emulator: Term.Emulator, title: string): void {
    this._title = title;
    this._sendTitleEvent(title);
  }
  
  private _disconnectActiveTerminalViewer(): void {
    this._moveCursorToFreshLine();
    this._emulator.moveRowsAboveCursorToScrollback();
    this._emulator.flushRenderQueue();
    if (this._terminalViewer !== null) {
      this._terminalViewer.setEmulator(null);
      this._terminalViewer.deleteScreen();
      this._terminalViewer.setUseVPad(false);
      this._virtualScrollArea.updateScrollableSize(this._terminalViewer);
      this._terminalViewer = null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    this._emulator.moveRowsAboveCursorToScrollback();
    this._emulator.flushRenderQueue();
    let currentTerminalViewer = this._terminalViewer;
    
    let currentTerminalViewerHadFocus = false;
    if (currentTerminalViewer !== null) {
      currentTerminalViewer.deleteScreen();
      currentTerminalViewerHadFocus = currentTerminalViewer.hasFocus();

      if (currentTerminalViewer.isEmpty()) {
        // Keep this terminal viewer and re-use it later in the new position.
        this._removeScrollable(currentTerminalViewer);
      } else {
        // This terminal viewer has stuff in it.
        currentTerminalViewer.setEmulator(null);
        currentTerminalViewer.setUseVPad(false);
        this._virtualScrollArea.updateScrollableSize(currentTerminalViewer);
        this._terminalViewer = null;
        currentTerminalViewer = null;
      }
    }
    this._appendScrollable(el);
      
    if (currentTerminalViewer !== null) {
      this._appendScrollable(currentTerminalViewer);
      if (currentTerminalViewerHadFocus) {
        currentTerminalViewer.focus();
      }
    } else {
      this._appendNewTerminalViewer();
      this._refocus();
    }
  }
  
  private _handleMouseDown(ev: MouseEvent): void {
    if (ev.buttons === 4) { // Middle mouse button
      ev.stopPropagation();
      ev.preventDefault();
      this._pasteFromClipboard();
    }
  }

  private _handleWriteBufferSize(emulator: Term.Emulator, status: TermApi.WriteBufferStatus): void {
    if (this._pty != null) {
      this._pty.permittedDataSize(status.bufferSize);
    }
  }

  /**
   * Handle data coming from the user.
   * 
   * This just pushes the keys from the user through to the pty.
   * @param {string} data The data to process.
   */
  private _handleTermData(emulator: Term.Emulator, data: string): void {
// Filter the input in the case that an upload is in progress.
    this.send(data);
  }
  
  private _handleTermSize(emulator: Term.Emulator, event: TermApi.RenderEvent): void {
    const newColumns = event.columns;
    const newRows = event.rows;
    if (this._columns === newColumns && this._rows === newRows) {
      return;
    }
    this._columns = newColumns;
    this._rows = newRows;

    if (this._pty != null) {
      this._pty.resize(newColumns, newRows);
    }
  }
  
  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_TITLE, { detail: {title: title } });
    this.dispatchEvent(event);    
  }
  
  private _enterCursorMode(): void {
    this._setModeAndVisualState(ViewerElementTypes.Mode.CURSOR, VisualState.AUTO);
    this._mode = Mode.CURSOR;
  }
  
  private _exitCursorMode(): void {
    this._setModeAndVisualState(ViewerElementTypes.Mode.DEFAULT, VisualState.FOCUSED);
    this._mode = Mode.DEFAULT;
    this._refocus();
  }

  private _setModeAndVisualState(mode: ViewerElementTypes.Mode, visualState: VisualState): void {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    const childNodes = <ViewerElement[]> DomUtils.nodeListToArray(scrollerArea.childNodes).filter(ViewerElement.isViewerElement);
    childNodes.forEach( (node) => node.setMode(mode));
    childNodes.forEach( (node) => node.setVisualState(visualState));
  }

  private _childElementListIndexOf(element: HTMLElement & VirtualScrollable): number {
    const list = this._childElementList;;
    const len = list.length;
    for (let i=0; i<len; i++) {
      const item = list[i];
      if (item.element === element) {
        return i;
      }
    }
    return -1;
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
    const el = <HTMLElement & VirtualScrollable> ev.target;
    if (el.parentNode === this._stashArea) {
      this._scheduleStashedChildResize(el);
    } else {
      this._updateVirtualScrollableSize(el);
    }
  }

  private _markVisible(scrollable: VirtualScrollable, visible: boolean): void {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    const element: ViewerElement = <any> scrollable;
    if ( ! visible) {

      if (this._terminalViewer !== element && ! (ViewerElement.isViewerElement(element) && element.hasFocus())) {
        // Move the scrollable into the stash area.
        this._stashArea.appendChild(element);
      }

    } else {

      if (element.parentElement !== scrollerArea) {
        // Move the element to the scroll area and place it in the correct position relative to the other child elements.

        const scrollerAreaChildrenCount = scrollerArea.children.length;
        if (scrollerAreaChildrenCount === 0) {
          scrollerArea.appendChild(element);
        } else {

          let scrollerIndex = 0;
          let childIndex = 0;
          while (childIndex < this._childElementList.length) {

            const currentElement = this._childElementList[childIndex].element;
            if (currentElement === element) {
              scrollerArea.insertBefore(element, scrollerArea.children[scrollerIndex]);
              break;
            }

            if (scrollerArea.children[scrollerIndex] === currentElement) {
              scrollerIndex++;
              if (scrollerIndex >= scrollerAreaChildrenCount) {
                scrollerArea.appendChild(element);
                break;
              }
            }
            childIndex++;
          }
        }

        // Set the current mode on the scrollable.
        const visualState = this._mode === Mode.CURSOR ? VisualState.AUTO : VisualState.FOCUSED;
        element.setMode(this._mode);
        element.setVisualState(visualState);
      }
    }
  }

  private _makeVisible(element: HTMLElement & VirtualScrollable): void {
    this._markVisible(element, true);
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
    this._enforceScrollbackLength(this._scrollbackSize);
  }

  private _processRefresh(requestedLevel: ResizeRefreshElementBase.RefreshLevel): void {
    let level = requestedLevel;
    if (this._needsCompleteRefresh) {
      level = ResizeRefreshElementBase.RefreshLevel.COMPLETE;
      this._needsCompleteRefresh = false;
    }

    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    if (scrollerArea !== null) {
      // --- DOM Read ---
      CodeMirrorOperation.bulkOperation(() => {
        ResizeRefreshElementBase.ResizeRefreshElementBase.refreshChildNodes(scrollerArea, level);

        const scrollbar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
        scrollbar.refresh(level);

        // --- DOM write ---
        const scrollContainer = DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
        this._virtualScrollArea.updateContainerHeight(scrollContainer.getBoundingClientRect().height);

        // Build the list of elements we will resize right now.
        const childrenToResize: VirtualScrollable[] = [];
        const len = scrollerArea.children.length;
        for (let i=0; i<len; i++) {
          const child = scrollerArea.children[i];
          if (ViewerElement.isViewerElement(child)) {
            childrenToResize.push(child);
          }
        }

        // Keep track of which children will need a resize later on.
        const childrenToResizeSet = new Set(childrenToResize);
        for (const childStatus of this._childElementList) {
          if ( ! childrenToResizeSet.has(childStatus.element)) {
            childStatus.needsRefresh = true;
            childStatus.refreshLevel = level;
          }
        }

        if (childrenToResize.length !== this._childElementList.length) {
          this._scheduleStashedChildResizeTask();
        }

        this._virtualScrollArea.updateScrollableSizes(childrenToResize);
        this._virtualScrollArea.reapplyState();
        this._enforceScrollbackLength(this._scrollbackSize);
      });
    }
  }

  private _setTopFunction(scrollable: VirtualScrollable, top: number):  void {
    (<HTMLElement> (<any> scrollable)).style.top = "" + top + "px";
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
    const index = this._childElementListIndexOf(<any> ev.target);
    if (index === -1) {
      this._log.warn("_handleTerminalViewerCursorEdge(): Couldn't find the target.");
      return;
    }

    if (detail.edge === ViewerElementTypes.Edge.TOP) {
      // A top edge was hit. Move the cursor to the bottom of the ViewerElement above it.
      for (let i=index-1; i>=0; i--) {
        const node = this._childElementList[i].element;
        if (ViewerElement.isViewerElement(node)) {
          this._makeVisible(node);
          if (node.setCursorPositionBottom(detail.ch)) {
            DomUtils.focusWithoutScroll(node);
            break;
          }
        }
      }
    
    } else {
      // Bottom edge. Move the cursor to the top of the next ViewerElement.
      for (let i=index+1; i<this._childElementList.length; i++) {
        const node = this._childElementList[i].element;
        if (ViewerElement.isViewerElement(node)) {
          this._makeVisible(node);
          if (node.setCursorPositionTop(detail.ch)) {
            DomUtils.focusWithoutScroll(node);
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
    this._enforceScrollbackLength(this._scrollbackSize);
    return rc;
  }
  
  private _enforceScrollbackLength(scrollbackSize: number): void {
    // Prevent the scrollback check from running multiple times.
    if (this._enforceScrollbackLengthGuard) {
      return;
    }
    this._enforceScrollbackLengthGuard = true;
    const hasFocus = this.hasFocus();
    this._enforceScrollbackLength2(scrollbackSize);
    if (hasFocus && ! this.hasFocus()) {
      this.focus();
    }
    this._enforceScrollbackLengthGuard = false;
  }

  private _enforceScrollbackLength2(scrollbackSize: number): void {
    let virtualHeight = this._virtualScrollArea.getVirtualHeight();
    const effectiveScrollbackSize = window.screen.height + scrollbackSize;
    const hardLimit = Math.floor(effectiveScrollbackSize * 1.1);
    if (virtualHeight < hardLimit) {
      return;
    }
    
    const killList: (VirtualScrollable & HTMLElement)[] = [];
    for (const nodeInfo of this._childElementList) {
      const scrollableKid: VirtualScrollable & HTMLElement = <any> nodeInfo.element;
      const kidVirtualHeight = this._virtualScrollArea.getScrollableVirtualHeight(scrollableKid);
      const newVirtualHeight = virtualHeight - kidVirtualHeight;
      // We don't want to cut out too much at once.
      if (newVirtualHeight > effectiveScrollbackSize) {
        // Just remove the thing. There is plenty of scrollback left over.
        killList.push(scrollableKid);
        
      } else {
        this._deleteTopPixels(scrollableKid, virtualHeight - effectiveScrollbackSize);
        break;
      }
      
      virtualHeight = newVirtualHeight;
      if (virtualHeight < hardLimit) {
        break;
      }
    }

    for (const scrollableKid of killList) {
      this._removeScrollable(scrollableKid);
    }
  }

  private _deleteTopPixels(kidNode: HTMLElement & VirtualScrollable, pixelCount: number): void {
    // Try to cut part of it off.
    if (TerminalViewer.is(kidNode)) {
      kidNode.deleteTopPixels(pixelCount);
      this._scheduleStashedChildResize(kidNode);
      return;
      
    } else if (EmbeddedViewer.is(kidNode)) {
      const viewer = kidNode.getViewerElement();

      if (TerminalViewer.is(viewer)) {
        viewer.deleteTopPixels(pixelCount);
        this._scheduleStashedChildResize(kidNode);
        return;  
        
      } else if (TextViewer.is(viewer)) {
        viewer.deleteTopPixels(pixelCount);
        this._scheduleStashedChildResize(kidNode);
        return;
      }
    }
    this._removeScrollable(kidNode);
    if (ViewerElement.isViewerElement(kidNode)) {
      kidNode.dispose();
    }
  }
  
  private _adjustFontSize(delta: number): void {
    const newAdjustment = Math.min(Math.max(this._fontSizeAdjustment + delta, MINIMUM_FONT_SIZE), MAXIMUM_FONT_SIZE);
    if (newAdjustment !== this._fontSizeAdjustment) {
      this._fontSizeAdjustment = newAdjustment;
      this._setFontSizeInCss(newAdjustment);
    }
  }

  private _setFontSizeInCss(size: number): void {
    const styleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);
    (<any>styleElement.sheet).cssRules[0].style.cssText = this._getCssFontSizeRule(size);  // Type stubs are missing cssRules.
    this._armResizeCanary = true;
    // Don't refresh. Let the Resize Canary detect the real change in the DOM when it arrives.
  }

  private _resetFontSize(): void {
    this._adjustFontSize(-this._fontSizeAdjustment);
  }

  private _goToPreviousFrame(): void {
    const heights = this._virtualScrollArea.getScrollableHeights();

    const y = this._virtualScrollArea.getScrollYOffset();
    let heightCount = 0;
    for (let i=0; i<heights.length; i++) {
      if (y <= (heightCount + heights[i].height)) {
        this._virtualScrollArea.scrollTo(heightCount);
        break;
      }
      heightCount += heights[i].height;
    }
  }

  private _goToNextFrame(): void {
    const heights = this._virtualScrollArea.getScrollableHeights();

    const y = this._virtualScrollArea.getScrollYOffset();
    let heightCount = 0;
    for (let i=0; i<heights.length; i++) {
      if (y < (heightCount + heights[i].height)) {
        this._virtualScrollArea.scrollTo(heightCount + heights[i].height);
        break;
      }
      heightCount += heights[i].height;
    }
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
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_CURSOR_MODE);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }
  
  private _handleContextMenu(): void {
    if (this._terminalViewer !== null) {
      this._terminalViewer.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
    }
  }

  getCommandPaletteEntries(commandableStack): CommandEntry[] {
    const commandList: CommandEntry[] = [];
    if (this._mode === Mode.DEFAULT) {
      commandList.push( { id: COMMAND_ENTER_CURSOR_MODE, group: PALETTE_GROUP, iconRight: "i-cursor", label: "Enter cursor mode", commandExecutor: this } );
    } else {
      commandList.push( { id: COMMAND_ENTER_NORMAL_MODE, group: PALETTE_GROUP, label: "Enter normal mode", commandExecutor: this } );
    }
    commandList.push( { id: COMMAND_SCROLL_PAGE_UP, group: PALETTE_GROUP, iconRight: "angle-double-up", label: "Scroll Page Up", commandExecutor: this } );
    commandList.push( { id: COMMAND_SCROLL_PAGE_DOWN, group: PALETTE_GROUP, iconRight: "angle-double-down", label: "Scroll Page Down", commandExecutor: this } );

    commandList.push( { id: COMMAND_GO_TO_PREVIOUS_FRAME, group: PALETTE_GROUP, label: "Go to Previous Frame", commandExecutor: this } );
    commandList.push( { id: COMMAND_GO_TO_NEXT_FRAME, group: PALETTE_GROUP, label: "Go to Next Frame", commandExecutor: this } );
    
    commandList.push( { id: COMMAND_COPY_TO_CLIPBOARD, group: PALETTE_GROUP, iconRight: "copy", label: "Copy to Clipboard", commandExecutor: this } );
    if (this._mode === Mode.CURSOR) {
      commandList.push( { id: COMMAND_PASTE_FROM_CLIPBOARD, group: PALETTE_GROUP, iconRight: "clipboard", label: "Paste from Clipboard", commandExecutor: this } );
    }
    commandList.push( { id: COMMAND_OPEN_LAST_FRAME, group: PALETTE_GROUP, iconRight: "external-link", label: "Open Last Frame", commandExecutor: this } );
    commandList.push( { id: COMMAND_DELETE_LAST_FRAME, group: PALETTE_GROUP, iconRight: "times-circle", label: "Delete Last Frame", commandExecutor: this } );

    commandList.push( { id: COMMAND_FONT_SIZE_INCREASE, group: PALETTE_GROUP, label: "Increase Font Size", commandExecutor: this } );
    commandList.push( { id: COMMAND_FONT_SIZE_DECREASE, group: PALETTE_GROUP, label: "Decrease Font Size", commandExecutor: this } );
    commandList.push( { id: COMMAND_FONT_SIZE_RESET, group: PALETTE_GROUP, label: "Reset Font Size", commandExecutor: this } );


    commandList.push( { id: COMMAND_CLEAR_SCROLLBACK, group: PALETTE_GROUP, iconRight: "eraser", label: "Clear Scrollback", commandExecutor: this } );
    commandList.push( { id: COMMAND_RESET_VT, group: PALETTE_GROUP, iconRight: "refresh", label: "Reset VT", commandExecutor: this } );

    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_CURSOR_MODE);
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
        case COMMAND_ENTER_CURSOR_MODE:
          this._enterCursorMode();
          break;

        case COMMAND_ENTER_NORMAL_MODE:
          this._exitCursorMode();
          break;
          
        case COMMAND_SCROLL_PAGE_UP:
          this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
            - this._virtualScrollArea.getScrollContainerHeight() / 2);
          break;
          
        case COMMAND_SCROLL_PAGE_DOWN:
          this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset()
            + this._virtualScrollArea.getScrollContainerHeight() / 2);
          break;

        case COMMAND_GO_TO_PREVIOUS_FRAME:
          this._goToPreviousFrame();
          break;

        case COMMAND_GO_TO_NEXT_FRAME:
          this._goToNextFrame();
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

      case COMMAND_RESET_VT:
        this._emulator.reset();
        break;

      case COMMAND_CLEAR_SCROLLBACK:
        this._enforceScrollbackLength(0);
        break;

      case COMMAND_FONT_SIZE_INCREASE:
        this._adjustFontSize(1);
        break;

      case COMMAND_FONT_SIZE_DECREASE:
        this._adjustFontSize(-1);
        break;

      case COMMAND_FONT_SIZE_RESET:
        this._resetFontSize();
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
    
  private _scheduleResize(): void {
    this._scheduleLaterProcessing( () => {
      this._processRefresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);
    });
  }

  private _scheduleStashedChildResize(el: HTMLElement & VirtualScrollable): void {
    if(el.parentNode !== this._stashArea) {
      return;
    }

    for (const childInfo of this._childElementList) {
      if (childInfo.element === el) {
        if ( ! childInfo.needsRefresh) {
          childInfo.needsRefresh = true;
          childInfo.refreshLevel = ResizeRefreshElementBase.RefreshLevel.RESIZE;
          this._scheduleStashedChildResizeTask();
        }
        return;
      }
    }

    this._log.warn("_scheduleStashedChildResize() called with an unknown element instance.");
  }

  private _scheduleStashedChildResizeTask(): void {
    if (this._stashedChildResizeTask == null) {
      this._stashedChildResizeTask = () => {
        // Gather the list of elements/scrollables that need refreshing and updating.
        const processList: ChildElementStatus[] = [];
        for (let i=this._childElementList.length-1; i>=0 && processList.length < CHILD_RESIZE_BATCH_SIZE; i--) {
          const childStatus = this._childElementList[i];
          if (childStatus.needsRefresh) {
            processList.push(childStatus);
            childStatus.needsRefresh = false;
          }
        }

        if (processList.length !== 0) {
          // Find the elements which need to be moved into the scroll area.
          const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
          const stashedList: (HTMLElement & VirtualScrollable)[] = [];
          for (const childStatus of processList) {
            const element = childStatus.element;
            if (element.parentElement !== scrollerArea) {
              stashedList.push(element);
            }
          }

          CodeMirrorOperation.bulkOperation( () => {
            stashedList.forEach(el => this._markVisible(el, true));

            for (const childStatus of processList) {
              const el = childStatus.element;
              if (ResizeRefreshElementBase.ResizeRefreshElementBase.is(el)) {
                el.refresh(childStatus.refreshLevel);
              }
            }

            this._virtualScrollArea.updateScrollableSizes(processList.map(childStatus => childStatus.element));
          });

          if (stashedList.length !== 0) {
            stashedList.filter( (el) => ! this._virtualScrollArea.getScrollableVisible(el))
              .forEach( (el) => this._markVisible(el, false) );
          }

          this._scheduleStashedChildResizeTask();
        }
      };
    }

    if (this._scheduleLaterQueue.indexOf(this._stashedChildResizeTask) === -1) {
      this._scheduleLaterProcessing(this._stashedChildResizeTask);
    }
  }  

  private _scheduleLaterProcessing(func: Function): void {
    this._scheduleLaterQueue.push(func);
    
    if (this._scheduleLaterHandle === null) {
      this._scheduleLaterHandle = doLater( () => {
        this._scheduleLaterHandle = null;
        const queue = this._scheduleLaterQueue;
        this._scheduleLaterQueue = [];
        queue.forEach( (func) => func() );
      });
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
  private _handleApplicationModeStart(params: string[]): TermApi.ApplicationModeResponse {
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("application-mode started! ",params);
    }

    this._htmlData = "";
    
    // Check security cookie
    if (params.length === 0) {
      this._log.warn("Received an application mode sequence with no parameters.");
      return {action: TermApi.ApplicationModeResponseAction.ABORT};
    }
    
    if (params[0] !== this._cookie) {
      this._log.warn("Received the wrong cookie at the start of an application mode sequence.");
      return {action: TermApi.ApplicationModeResponseAction.ABORT};
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
          return this._downloadHandler.handleStart(params.slice(2));
        
        default:
          this._log.warn("Unrecognized application escape parameters.");
          break;
      }
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  /**
   * Handle incoming data while in application mode.
   * 
   * @param {string} data The new data.
   */
  private _handleApplicationModeData(data: string): TermApi.ApplicationModeResponse {
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
        return this._downloadHandler.handleData(data);
        
      default:
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }
  
  /**
   * Handle the exit from application mode.
   */
  private _handleApplicationModeEnd(): TermApi.ApplicationModeResponse {
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
        return this._downloadHandler.handleStop();
        
      default:
        break;
    }
    this._applicationMode = ApplicationMode.APPLICATION_MODE_NONE;
  
    if (DEBUG_APPLICATION_MODE) {
      this._log.debug("html-mode end!",this._htmlData);
    }
    this._htmlData = null;

    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _handleApplicationModeBracketStart(): void {
    for (const kidInfo of this._childElementList) {
      const element = kidInfo.element;
      if ((EmbeddedViewer.is(element) && element.children.length === 0) || CommandPlaceHolder.is(element)) {
        return;  // Don't open a new frame.
      }
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
      const el = this._createEmbeddedViewerElement();
      this._appendScrollableElement(el);
    } else {

      this._moveCursorToFreshLine();
      this._emulator.moveRowsAboveCursorToScrollback();
      this._emulator.flushRenderQueue();

      this._lastCommandTerminalLine = this._terminalViewer.bookmarkLine(this._terminalViewer.lineCount() -1);
      this._lastCommandTerminalViewer = this._terminalViewer;
    }
    this._lastCommandLine = cleancommand;

    const scrollContainer = DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
    this._virtualScrollArea.updateContainerHeight(scrollContainer.getBoundingClientRect().height);
  }
  
  private _moveCursorToFreshLine(): void {
    const dims = this._emulator.getDimensions();
    if (dims.cursorX !== 0 && this._emulator.getLineText(dims.cursorY).trim() !== '') {
      this._emulator.newLine();
    }
  }

  public deleteEmbeddedViewer(viewer: EmbeddedViewer): void {
    this._removeScrollable(viewer);
    viewer.dispose();
  }
  
  private _getLastEmbeddedViewer(): EmbeddedViewer {
    const kids = this._childElementList;
    const len = this._childElementList.length;
    for (let i=len-1; i>=0;i--) {
      const kid = kids[i].element;
      if (EmbeddedViewer.is(kid)) {
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
  
  private _createEmbeddedViewerElement(): EmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EmbeddedViewer> this._getWindow().document.createElement(EmbeddedViewer.TAG_NAME);
    injectKeyBindingManager(el, this._keyBindingManager);
    injectConfigDistributor(el, this._configManager);
    el.addEventListener(EmbeddedViewer.EVENT_CLOSE_REQUEST, () => {
      this.deleteEmbeddedViewer(el);
      this.focus();
    });

    el.addEventListener(GeneralEvents.EVENT_SET_MODE, (ev: CustomEvent) => {
      const detail: GeneralEvents.SetModeEventDetail = ev.detail;
      if (detail.mode !== this._mode) {
        switch (this._mode) {
          case Mode.DEFAULT:
              this._enterCursorMode();
              break;

          case Mode.CURSOR:
              this._exitCursorMode();
              break;
        }
      }
    });

    el.addEventListener(EmbeddedViewer.EVENT_FRAME_POP_OUT, (ev: CustomEvent) => {
      this._embeddedViewerPopOutEvent(<EmbeddedViewer>ev.srcElement);
      ev.stopPropagation();
    });

    // el.addEventListener('copy-clipboard-request', (function(ev: CustomEvent) {
    //   var clipboard = gui.Clipboard.get();
    //   clipboard.set(ev.detail, 'text');
    // }).bind(this));
// FIXME
    
    el.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);
    el.setTag("" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    this._enforceScrollbackLengthAfter( () => {
      this._closeLastEmbeddedViewer(this._htmlData);
    });
  }

  private _closeLastEmbeddedViewer(returnCode: string): void {
    // Find the terminal viewer which has no return code set on it.
    let startElement: HTMLElement & VirtualScrollable = null;
    for (let i=this._childElementList.length-1; i>=0; i--) {
      const el = this._childElementList[i].element;
      if (el instanceof EmbeddedViewer && el.children.length === 0) {
        startElement = el;
        break;
      }
    }
    
    if (startElement != null) {
      // Finish framing an already existing Embedded viewer bar.
      const embeddedViewerElement = <EmbeddedViewer> startElement;
      
      const activeTerminalViewer = this._terminalViewer;
      this._disconnectActiveTerminalViewer();
      
      activeTerminalViewer.setCommandLine(this._lastCommandLine);
      activeTerminalViewer.setReturnCode(returnCode);
      activeTerminalViewer.setUseVPad(false);
      
      // Hang the terminal viewer under the Embedded viewer.
      embeddedViewerElement.className = "extraterm_output";
      
      // Some focus management to make sure that activeTerminalViewer still keeps
      // the focus after we remove it from the DOM and place it else where.
      const restoreFocus = DomUtils.getShadowRoot(this).activeElement === activeTerminalViewer;
      
      embeddedViewerElement.setViewerElement(activeTerminalViewer);
      activeTerminalViewer.setEditable(true);

      this._removeScrollable(activeTerminalViewer);

      this._virtualScrollArea.updateScrollableSize(embeddedViewerElement);
      this._appendNewTerminalViewer();
      
      if (restoreFocus) {
        this._terminalViewer.focus();
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
      const newViewerElement = this._createEmbeddedViewerElement();
      // Hang the terminal viewer under the Embedded viewer.
      newViewerElement.className = "extraterm_output";

      this._appendScrollable(newViewerElement);
      
      // Create a terminal viewer to display the output of the last command.
      const outputTerminalViewer = <TerminalViewer> document.createElement(TerminalViewer.TAG_NAME);
      injectKeyBindingManager(outputTerminalViewer, this._keyBindingManager);
      injectConfigDistributor(outputTerminalViewer, this._configManager);
      newViewerElement.setViewerElement(outputTerminalViewer);
      
      outputTerminalViewer.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);
      outputTerminalViewer.setReturnCode(returnCode);
      outputTerminalViewer.setCommandLine(this._lastCommandLine);
      outputTerminalViewer.setUseVPad(false);
      if (moveText !== null) {
        outputTerminalViewer.setDecoratedLines(moveText.text, moveText.decorations);
      }
      outputTerminalViewer.setEditable(true);
      
      this._appendNewTerminalViewer();
      this._refocus();
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
    for (let i=0; i<this._childElementList.length; i++) {
      const node = this._childElementList[i].element;
      if (ViewerElement.isViewerElement(node)) {
        text = node.getSelectionText();
        if (text !== null) {
          WebIpc.clipboardWrite(text);
          break;
        }
      }
    }
  }
  
  canPaste(): boolean {
    return true;
  }

  pasteText(text: string): void {
    if (this._mode === Mode.CURSOR) {
      const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
      for (const node of scrollerArea.childNodes) {
        if (ViewerElement.isViewerElement(node) && node.hasFocus()) {
          if (SupportsClipboardPaste.isSupportsClipboardPaste(node) && node.canPaste()) {
            node.pasteText(text);
          }
          break;
        }
      }

    } else {
      this.send(text);  // Send it to the PTY.
    }
  }

  /**
   * Paste text from the clipboard.
   *
   * This method is async and returns before the paste is done.
   */
  private _pasteFromClipboard(): void {
    WebIpc.clipboardReadRequest();
  }
  
  private _embeddedViewerPopOutEvent(viewerElement: EmbeddedViewer): void {
    const event = new CustomEvent(EtTerminal.EVENT_EMBEDDED_VIEWER_POP_OUT,
      { detail: { terminal: this, embeddedViewer: viewerElement} });
    this.dispatchEvent(event);
  }
  
  private handleRequestFrame(frameId: string): void {
    if (this._frameFinder === null) {
      return;
    }

    const bulkFileHandle = this._frameFinder(frameId);
    if (bulkFileHandle === null) {
      this.send("#error\n");
      return;
    }

    const uploader = new BulkFileUploader(bulkFileHandle); //, this._pty);
    uploader.onPtyData(text => {
      this.send(text);
    });

// Filter
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    const uploadProgressBar = <UploadProgressBar> document.createElement(UploadProgressBar.TAG_NAME);

    uploadProgressBar.total = bulkFileHandle.getTotalSize();
    uploader.onUploadedChange(uploaded => {
      uploadProgressBar.transferred = uploaded;
    });
    uploader.onFinished(() => {
      containerDiv.removeChild(uploadProgressBar);
    });
    
    containerDiv.appendChild(uploadProgressBar);

    uploader.upload();
  }

  private _handleShowFile(bulkFileHandle: BulkFileHandle): void {
    const {mimeType, charset} = BulkFileUtils.guessMimetype(bulkFileHandle);
    if (mimeType !== null) {
      this._appendMimeViewer(mimeType, bulkFileHandle);
    } else {
      this._appendMimeViewer("application/octet-stream", bulkFileHandle);
    }
  }

  private _appendMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): void {
    const mimeViewerElement = this._createMimeViewer(mimeType, bulkFileHandle);
    if (mimeViewerElement !== null) {
      this._closeLastEmbeddedViewer("0");
      const viewerElement = this._createEmbeddedViewerElement();
      viewerElement.setViewerElement(mimeViewerElement);
      this._appendScrollableElement(viewerElement);
      this._enforceScrollbackLength(this._scrollbackSize);
    }
  }

  private _createMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): ViewerElement {
    const candidates = viewerClasses.filter( (viewerClass) => viewerClass.supportsMimeType(mimeType) );
    
    if (candidates.length === 0) {
      this._log.debug("Unknown mime type: " + mimeType);
      return null;
    }
    
    const dataViewer = <ViewerElement> this._getWindow().document.createElement(candidates[0].TAG_NAME);
    injectKeyBindingManager(dataViewer, this._keyBindingManager);
    injectConfigDistributor(dataViewer, this._configManager);
    if (bulkFileHandle !== null) {
      dataViewer.setBulkFileHandle(bulkFileHandle);
    }
    dataViewer.setEditable(true);
    return dataViewer;
  }

  private _getNextTag(): string {
    let tag  = this._nextTag;
    if (tag === null) {
      // Fetching new tags from the main process is async. If we get here it means
      // that we were waiting for a new tag to arrive. Just fetch one sync.
      tag = WebIpc.requestNewTagSync();
    }
    this._fetchNextTag();
    return tag;
  }
  
  private _fetchNextTag(): void {
    WebIpc.requestNewTag().then( (msg: Messages.NewTagMessage) => {
      this._nextTag = msg.tag;
    });
  }
}

// interface ApplicationModeHandler {
//   getIdentifier(): string;
//   handleStart(parameters: string[]): TermApi.ApplicationModeResponse;
//   handleData(data: string): TermApi.ApplicationModeResponse;
//   handleEnd(): void;
// }
