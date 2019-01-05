/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as crypto from 'crypto';
import {BulkFileHandle, Disposable, ViewerMetadata, ViewerPosture} from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';
import { ResizeNotifier } from 'extraterm-resize-notifier';

import {BulkFileBroker} from './bulk_file_handling/BulkFileBroker';
import {BulkFileUploader} from './bulk_file_handling/BulkFileUploader';
import * as BulkFileUtils from './bulk_file_handling/BulkFileUtils';
import {DownloadApplicationModeHandler} from './DownloadApplicationModeHandler';
import {DownloadViewer} from './viewers/DownloadViewer';
import {Pty} from '../pty/Pty';

import {ViewerElement} from './viewers/ViewerElement';
import { SupportsMimeTypes, Mode, RefreshLevel, VisualState } from './viewers/ViewerElementTypes';
import {ResizeCanary} from './ResizeCanary';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as ThemeTypes from '../theme/Theme';
import {EmbeddedViewer} from './viewers/EmbeddedViewer';
import {CommandPlaceHolder} from './CommandPlaceholder';
import {TerminalViewer} from './viewers/TerminalAceViewer';
import {BookmarkRef} from './viewers/TerminalViewerTypes';
import {TextViewer} from './viewers/TextAceViewer';
import {ImageViewer} from './viewers/ImageViewer';
import {TipViewer} from './viewers/TipViewer';
import * as GeneralEvents from './GeneralEvents';
import {KeybindingsManager, injectKeybindingsManager, AcceptsKeybindingsManager} from './keybindings/KeyBindingsManager';
import { Commandable, BoundCommand } from './command/CommandTypes';
import { COMMAND_OPEN_COMMAND_PALETTE, COMMAND_OPEN_CONTEXT_MENU } from './command/CommandUtils';
import {Logger, getLogger} from "extraterm-logging";
import { log as LogDecorator} from "extraterm-logging";
import * as DomUtils from './DomUtils';
import {doLater, DebouncedDoLater} from '../utils/DoLater';
import * as Term from './emulator/Term';
import * as TermApi from 'term-api';
import {ScrollBar} from './gui/ScrollBar';
import {UploadProgressBar} from './UploadProgressBar';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';
import { TerminalCanvas } from './TerminalCanvas';
import * as VirtualScrollArea from './VirtualScrollArea';
import {FrameFinder} from './FrameFinderType';
import { ConfigDatabase, CommandLineAction, injectConfigDatabase, AcceptsConfigDatabase, COMMAND_LINE_ACTIONS_CONFIG,
  GENERAL_CONFIG } from '../Config';
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";
import * as SupportsDialogStack from "./SupportsDialogStack";
import { ExtensionManager } from './extension/InternalTypes';
import { DeepReadonly } from 'extraterm-readonly-toolbox';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { FindPanel, TempFindPanelViewer_FIXME } from "./FindPanel";

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type ScrollableElement = VirtualScrollable & HTMLElement;

const log = LogDecorator;

const DEBUG_APPLICATION_MODE = false;

const ID = "EtTerminalTemplate";
export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";
const ID_TOP = "ID_TOP";
const ID_SCROLL_CONTAINER = "ID_SCROLL_CONTAINER";
const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_SCROLLBAR_CONTAINER = "ID_SCROLLBAR_CONTAINER";
const ID_CENTER_COLUMN = "ID_CENTER_COLUMN";
const ID_CENTER_CONTAINER = "ID_CENTER_CONTAINER";
const ID_NORTH_CONTAINER = "ID_NORTH_CONTAINER";
const ID_SOUTH_CONTAINER = "ID_SOUTH_CONTAINER";
const ID_EAST_CONTAINER = "ID_EAST_CONTAINER";
const ID_WEST_CONTAINER = "ID_WEST_CONTAINER";

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
const COMMAND_FIND = "find";


const CLASS_VISITOR_DIALOG = "CLASS_VISITOR_DIALOG";
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
const viewerClasses: SupportsMimeTypes[] = [];
viewerClasses.push(ImageViewer);
viewerClasses.push(TextViewer);
viewerClasses.push(TipViewer);
viewerClasses.push(DownloadViewer);

interface WriteBufferStatus {
  bufferSize: number;
}

type InputStreamFilter = (input: string) => string;

enum BorderSide {
  NORTH,
  SOUTH,
  EAST,
  WEST
}

/**
 * An Extraterm terminal.
 * 
 * An EtTerminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 */
@WebComponent({tag: "et-terminal"})
export class EtTerminal extends ThemeableElementBase implements Commandable, AcceptsKeybindingsManager,
  AcceptsConfigDatabase, Disposable, SupportsClipboardPaste.SupportsClipboardPaste,
  SupportsDialogStack.SupportsDialogStack {
  
  static TAG_NAME = "ET-TERMINAL";
  static EVENT_TITLE = "title";
  static EVENT_EMBEDDED_VIEWER_POP_OUT = "viewer-pop-out";
  
  private static _resizeNotifier = new ResizeNotifier();

  private _log: Logger;
  private _pty: Pty = null;

  private _terminalCanvas: TerminalCanvas = null;
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
  
  private _configDatabase: ConfigDatabase = null;
  private _keyBindingManager: KeybindingsManager = null;
  private _extensionManager: ExtensionManager = null;

  private _title = "New Tab";
  private _frameFinder: FrameFinder = null;
  
  private _nextTag: string = null;

  private _resizePollHandle: Disposable = null;
  private _elementAttached = false;

  private _scheduleResizeBound: any;

  // The current size of the emulator. This is used to detect changes in size.
  private _columns = -1;
  private _rows = -1;
  private _fontSizeAdjustment = 0;
  private _armResizeCanary = false;  // Controls when the resize canary is allowed to chirp.

  private _inputStreamFilters: InputStreamFilter[] = [];
  private _dialogStack: HTMLElement[] = [];

  private _copyToClipboardLater: DebouncedDoLater = null;
  private _findPanel: FindPanel = null;

  constructor() {
    super();
    this._log = getLogger(EtTerminal.TAG_NAME, this);
    this._copyToClipboardLater = new DebouncedDoLater(() => this.copyToClipboard(), 100);
    this._fetchNextTag();
  }
   
  /**
   * Custom Element 'connected' life cycle hook.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._elementAttached) {
      this._elementAttached = true;

      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this._createClone();
      shadow.appendChild(clone);
      
      this.addEventListener('focus', this._handleFocus.bind(this));
      this.addEventListener('blur', this._handleBlur.bind(this));

      const scrollBar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
      const scrollArea = <HTMLDivElement> DomUtils.getShadowId(this, ID_SCROLL_AREA);
      const scrollContainer = <HTMLDivElement> DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
      DomUtils.preventScroll(scrollContainer);
      EtTerminal._resizeNotifier.observe(scrollContainer, (target: Element, contentRect: DOMRectReadOnly) => {
        this._refresh(RefreshLevel.COMPLETE);
      });
      this._terminalCanvas = new TerminalCanvas(scrollContainer, scrollArea, scrollBar);
      this._terminalCanvas.setConfigDatabase(this._configDatabase);
      this._terminalCanvas.onBeforeSelectionChange(ev => this._handleBeforeSelectionChange(ev));

      scrollArea.addEventListener("keypress", (ev) => this._handleKeyPressCapture(ev), true);
      scrollArea.addEventListener('keydown', (ev) => this._handleKeyDownCapture(ev), true);

      DomUtils.addCustomEventResender(scrollContainer, GeneralEvents.EVENT_DRAG_STARTED, this);
      DomUtils.addCustomEventResender(scrollContainer, GeneralEvents.EVENT_DRAG_ENDED, this);

      this._terminalCanvas.connectedCallback();

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
          this._terminalCanvas.focus();
          if (ev.buttons & 2) { // Right Mouse Button
            this._handleContextMenu(ev.clientX, ev.clientY);
          }
        }
      });
      
      scrollContainer.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
      
      scrollArea.addEventListener(GeneralEvents.EVENT_TYPE_TEXT, (ev: CustomEvent) => {
        const detail: GeneralEvents.TypeTextEventDetail = ev.detail;
        this.send(detail.text);
      });

      // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
      const containerDiv = DomUtils.getShadowId(this, ID_CENTER_CONTAINER);
      const resizeCanary = <ResizeCanary> document.createElement(ResizeCanary.TAG_NAME);
      resizeCanary.setCss(`
          font-family: var(--terminal-font);
          font-size: var(--terminal-font-size);
      `);
      containerDiv.appendChild(resizeCanary);
      resizeCanary.addEventListener('resize', () => {
        if (this._armResizeCanary) {
          this._armResizeCanary = false;
          this._refresh(RefreshLevel.COMPLETE);
        }
      });

      this._showTip();
    } else {

      // This was already attached at least once.
      this._terminalCanvas.scheduleResize();
    }

    this._setFontSizeInCss(this._fontSizeAdjustment);
  }
  
  /**
   * Custom Element 'disconnected' life cycle hook.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._terminalCanvas.disconnectedCallback();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL];
  }

  dispose(): void {
    this._copyToClipboardLater.cancel();
    this._terminalCanvas.dispose();
  }

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
    });

    doLater(() => {
      pty.resize(this._columns, this._rows);
    });
  }

  setConfigDatabase(configDatabase: ConfigDatabase): void {
    this._configDatabase = configDatabase;
    if (this._terminalCanvas != null) {
      this._terminalCanvas.setConfigDatabase(configDatabase);
    }
  }

  setKeybindingsManager(keyBindingManager: KeybindingsManager): void {
    this._keyBindingManager = keyBindingManager;
  }
  
  setBulkFileBroker(fileBroker: BulkFileBroker): void {
    this._fileBroker = fileBroker;

    if (this._emulator != null) {
      this._initDownloadApplicationModeHandler();
    }
  }

  setExtensionManager(extensionManager: ExtensionManager): void {
    this._extensionManager = extensionManager;
  }

  private _commandNeedsFrame(commandLine: string): boolean {
    const cleanCommandLine = commandLine.trim();
    if (cleanCommandLine === "") {
      return false;
    }
    
    if (this._configDatabase === null) {
      return false;
    } else {
    
      const commandLineActions: DeepReadonly<CommandLineAction[]> = 
        this._configDatabase.getConfig(COMMAND_LINE_ACTIONS_CONFIG) || [];
      const frameByDefault = this._configDatabase.getConfig(GENERAL_CONFIG).frameByDefault;

      for (const cla of commandLineActions) {
        if (this._commandLineActionMatches(commandLine, cla)) {
          return cla.frame;
        }
      }
      return frameByDefault;
    }
  }

  private _commandLineActionMatches(command: string, cla: DeepReadonly<CommandLineAction>): boolean {
    const cleanCommandLine = command.trim();
    const commandParts = command.trim().split(/\s+/);

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
  
  setTerminalTitle(title: string): void {
    this._title = title;
    this._sendTitleEvent(title);
  }

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

  focus(): void {
    if (this._dialogStack.length !== 0) {
      this._dialogStack[this._dialogStack.length-1].focus();
      return;
    }
    this._terminalCanvas.focus();
  }
  
  hasFocus(): boolean {
    const shadowRoot = DomUtils.getShadowRoot(this);
    if (shadowRoot === null) {
      return false;
    }
    return shadowRoot.activeElement !== null;
  }
  
  /**
   * Write VT data to the terminal screen.
   * 
   * @param text the stream of text and VT codes to write.
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
    this._terminalCanvas.scheduleResize();
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
    
    for (const element of this._terminalCanvas.getChildElements()) {
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
    return <ViewerElement[]> this._terminalCanvas.getChildElements().filter(el => el instanceof ViewerElement);
  }
    
  getExtratermCookieValue(): string {
    return this._cookie;
  }

  protected updateThemeCss() {
    super.updateThemeCss();
    this.resizeToContainer();
  }

  private _refresh(level: RefreshLevel): void {
    this._terminalCanvas.refresh(level);
  }

  showDialog(dialogElement: HTMLElement): Disposable {
    const containerDiv = DomUtils.getShadowId(this, ID_CENTER_CONTAINER);
    dialogElement.classList.add(CLASS_VISITOR_DIALOG);
    containerDiv.appendChild(dialogElement);
    this._dialogStack.push(dialogElement);
    return {
      dispose: () => {
        dialogElement.classList.remove(CLASS_VISITOR_DIALOG);
        this._dialogStack = this._dialogStack.filter(el => el !== dialogElement);
        containerDiv.removeChild(dialogElement);
      }
    };
  }

  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      template.innerHTML = trimBetweenTags(`
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <div id='${ID_TOP}'>
          <div id ='${ID_WEST_CONTAINER}'></div>
          <div id='${ID_CENTER_COLUMN}'>
            <div id='${ID_NORTH_CONTAINER}'></div>
            <div id='${ID_CENTER_CONTAINER}'>
              <div id='${ID_SCROLL_CONTAINER}'>
                <div id='${ID_SCROLL_AREA}'></div>
              </div>
              <div id='${ID_SCROLLBAR_CONTAINER}'>
                <${ScrollBar.TAG_NAME} id='${ID_SCROLLBAR}'></${ScrollBar.TAG_NAME}>
              </div>
            </div>
            <div id ='${ID_SOUTH_CONTAINER}'></div>
          </div>
          <div id ='${ID_EAST_CONTAINER}'></div>
        </div>
        `);
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _getCssVarsRules(): string {
    return `
    #${ID_CENTER_CONTAINER} {
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
  
  private _showTip(): void {
    const config = this._configDatabase.getConfigCopy(GENERAL_CONFIG);
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
    config.tipTimestamp = Date.now();
    config.tipCounter = config.tipCounter + 1;
    this._configDatabase.setConfig(GENERAL_CONFIG, config);
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

  private _initEmulator(cookie: string): void {
    const emulator = new Term.Emulator({
      platform: <Term.Platform> process.platform,
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
    injectKeybindingsManager(terminalViewer, this._keyBindingManager);
    injectConfigDatabase(terminalViewer, this._configDatabase);
    
    terminalViewer.setEmulator(this._emulator);

    this._terminalViewer = terminalViewer;  // Putting this in _terminalViewer now prevents the VirtualScrollArea 
                                            // removing it from the DOM in the next method call.
    this._terminalCanvas.appendScrollable(terminalViewer)
    this._terminalCanvas.setTerminalViewer(terminalViewer);
    
    terminalViewer.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);

    this._emulator.refreshScreen();
  }

  /**
   * Handler for window title change events from the pty.
   * 
   * @param title The new window title for this terminal.
   */
  private _handleTitle(emulator: Term.Emulator, title: string): void {
    this.setTerminalTitle(title);
  }
  
  private _disconnectActiveTerminalViewer(): void {
    this._moveCursorToFreshLine();
    this._emulator.moveRowsAboveCursorToScrollback();
    this._emulator.flushRenderQueue();
    if (this._terminalViewer !== null) {
      this._terminalViewer.setEmulator(null);
      this._terminalViewer.deleteScreen();
      this._terminalViewer.setUseVPad(false);
      this._terminalCanvas.updateScrollableSize(this._terminalViewer);
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
        this._terminalCanvas.removeScrollable(currentTerminalViewer);
      } else {
        // This terminal viewer has stuff in it.
        currentTerminalViewer.setEmulator(null);
        currentTerminalViewer.setUseVPad(false);
        this._terminalCanvas.updateScrollableSize(currentTerminalViewer);
        this._terminalViewer = null;
        currentTerminalViewer = null;
      }
    }
    this._terminalCanvas.appendScrollable(el);
      
    if (currentTerminalViewer !== null) {
      this._terminalCanvas.appendScrollable(currentTerminalViewer);
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
    // Apply the input filters
    let filteredData = data;
    for (const filter of this._inputStreamFilters) {
      filteredData = filter(filteredData);
    }

    if (filteredData !== "") {
      this.send(filteredData);
    }
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
    this._terminalCanvas.setModeAndVisualState(Mode.CURSOR, VisualState.AUTO);
    this._mode = Mode.CURSOR;
  }
  
  private _exitCursorMode(): void {
    this._terminalCanvas.setModeAndVisualState(Mode.DEFAULT, VisualState.FOCUSED);
    this._mode = Mode.DEFAULT;
    this._refocus();
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

  private _handleBeforeSelectionChange(ev: {sourceMouse: boolean}): void {
    if (ev.sourceMouse) {
      const generalConfig = this._configDatabase.getConfig("general");
      if (generalConfig.autoCopySelectionToClipboard) {
        this._copyToClipboardLater.trigger();
      }
    }
  }

  private _registerInputStreamFilter(filter: InputStreamFilter): Disposable {
    this._inputStreamFilters.push(filter);
    return {
      dispose: () => {
        this._inputStreamFilters = this._inputStreamFilters.filter(f => f !== filter);
      }
    };
  }

  private _handleKeyDownCapture(ev: KeyboardEvent): void {
    if (this._terminalViewer === null || this._keyBindingManager === null ||
        this._keyBindingManager.getKeybindingsContexts() === null) {
      return;
    }
    
    const keyBindings = this._keyBindingManager.getKeybindingsContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_CURSOR_MODE);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  private _handleKeyPressCapture(ev :KeyboardEvent): void {
    if (this._terminalViewer === null || this._keyBindingManager === null ||
        this._keyBindingManager.getKeybindingsContexts() === null) {
      return;
    }
    
    const keyBindings = this._keyBindingManager.getKeybindingsContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_CURSOR_MODE);
    const command = keyBindings.mapEventToCommand(ev);
    if (command != null) {
      // We merely have to detech the key press as belonging to one of our shortcuts and then prevent
      // it from reaching the layers below such as the terminal viewer and term emulation.
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  private _handleContextMenu(x: number, y: number): void {
    if (this._terminalViewer !== null) {
      this._terminalViewer.executeCommand(COMMAND_OPEN_CONTEXT_MENU, {x, y});
    }
  }

  getCommands(commandableStack): BoundCommand[] {
    const defaults = { group: PALETTE_GROUP, commandExecutor: this, contextMenu: true };
    const commands: BoundCommand[] = [
      { ...defaults, id: COMMAND_OPEN_COMMAND_PALETTE, icon: "fas fa-toolbox", label: "Command Palette", commandPalette: false},

      this._mode === Mode.DEFAULT
        ? { ...defaults, id: COMMAND_ENTER_CURSOR_MODE, icon: "fa fa-i-cursor", label: "Enter cursor mode" }
        : { ...defaults, id: COMMAND_ENTER_NORMAL_MODE, label: "Exit cursor mode" },
    
      { ...defaults, id: COMMAND_FIND, icon: "fas fa-search", label: "Find", contextMenu: true },
      { ...defaults, id: COMMAND_SCROLL_PAGE_UP, icon: "fa fa-angle-double-up", label: "Scroll Page Up", contextMenu: false },
      { ...defaults, id: COMMAND_SCROLL_PAGE_DOWN, icon: "fa fa-angle-double-down", label: "Scroll Page Down", contextMenu: false },
      { ...defaults, id: COMMAND_GO_TO_PREVIOUS_FRAME, label: "Go to Previous Frame", icon: "fas fa-step-backward fa-rotate-90" },
      { ...defaults, id: COMMAND_GO_TO_NEXT_FRAME, label: "Go to Next Frame", icon: "fas fa-step-forward fa-rotate-90" },
      { ...defaults, id: COMMAND_COPY_TO_CLIPBOARD, icon: "far fa-copy", label: "Copy to Clipboard" },
      { ...defaults, id: COMMAND_PASTE_FROM_CLIPBOARD, icon: "fa fa-clipboard", label: "Paste from Clipboard" },
      { ...defaults, id: COMMAND_OPEN_LAST_FRAME, icon: "fa fa-external-link-alt", label: "Open Last Frame", contextMenu: false },
      { ...defaults, id: COMMAND_DELETE_LAST_FRAME, icon: "fa fa-times-circle", label: "Delete Last Frame", contextMenu: false },
      { ...defaults, id: COMMAND_FONT_SIZE_INCREASE, label: "Increase Font Size" },
      { ...defaults, id: COMMAND_FONT_SIZE_DECREASE, label: "Decrease Font Size" },
      { ...defaults, id: COMMAND_FONT_SIZE_RESET, label: "Reset Font Size" },
      { ...defaults, id: COMMAND_CLEAR_SCROLLBACK, icon: "fa fa-eraser", label: "Clear Scrollback" },
      { ...defaults, id: COMMAND_RESET_VT, icon: "fa fa-sync", label: "Reset VT" },
    ];
    
    const keyBindings = this._keyBindingManager.getKeybindingsContexts().context(this._mode === Mode.DEFAULT
        ? KEYBINDINGS_DEFAULT_MODE : KEYBINDINGS_CURSOR_MODE);
    if (keyBindings !== null) {
      commands.forEach( (commandEntry) => {
        const shortcut = keyBindings.mapCommandToReadableKeyStroke(commandEntry.id)
        commandEntry.shortcut = shortcut === null ? "" : shortcut;
      });
    }    
    return commands;
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
        this._terminalCanvas.scrollPageUp();
        break;
          
      case COMMAND_SCROLL_PAGE_DOWN:
        this._terminalCanvas.scrollPageDown();
        break;

      case COMMAND_GO_TO_PREVIOUS_FRAME:
        this._terminalCanvas.goToPreviousFrame();
        break;

      case COMMAND_GO_TO_NEXT_FRAME:
        this._terminalCanvas.goToNextFrame();
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
        this._popOutLastEmbeddedViewer();
        break;

      case COMMAND_RESET_VT:
        this._emulator.reset();
        break;

      case COMMAND_CLEAR_SCROLLBACK:
        this._terminalCanvas.enforceScrollbackSize(0, 0);
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

      case COMMAND_FIND:
        this._openFindPanel();
        break;

      default:
        return false;
    }
    return true;
  }

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
    for (const element of this._terminalCanvas.getChildElements()) {
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
    
    if (this._commandNeedsFrame(cleancommand)) {
      // Create and set up a new command-frame.
      const el = this._createEmbeddedViewerElement();

      const defaultMetadata: ViewerMetadata = {
        title: cleancommand,
        posture: ViewerPosture.RUNNING,
        icon: "fa fa-cog",
        moveable: false,
        deleteable: false,
        toolTip: null
      };
      el.setDefaultMetadata(defaultMetadata);

      this._appendScrollableElement(el);
    } else {

      this._moveCursorToFreshLine();
      this._emulator.moveRowsAboveCursorToScrollback();
      this._emulator.flushRenderQueue();

      this._lastCommandTerminalLine = this._terminalViewer.bookmarkLine(this._terminalViewer.lineCount() -1);
      this._lastCommandTerminalViewer = this._terminalViewer;
    }
    this._lastCommandLine = cleancommand;

    // const scrollContainer = DomUtils.getShadowId(this, ID_SCROLL_CONTAINER);
    // this._virtualScrollArea.updateContainerHeight(scrollContainer.clientHeight);
// FIXME ^    
  }
  
  private _moveCursorToFreshLine(): void {
    const dims = this._emulator.getDimensions();
    if (dims.cursorX !== 0 && this._emulator.getLineText(dims.cursorY).trim() !== '') {
      this._emulator.newLine();
    }
  }

  public deleteEmbeddedViewer(viewer: EmbeddedViewer): void {
    this._terminalCanvas.removeScrollable(viewer);
    viewer.dispose();
  }

  private _popOutLastEmbeddedViewer(): void {
    const viewer = this._terminalCanvas.getLastEmbeddedViewer();
    if (viewer === null) {
      return;
    }
    const metadata = viewer.getMetadata();
    if (metadata.moveable !== false) {
      this._embeddedViewerPopOutEvent(viewer);
    }
  }

  private _deleteLastEmbeddedViewer(): void {
    const viewer = this._terminalCanvas.getLastEmbeddedViewer();
    if (viewer === null) {
      return;
    }
    const metadata = viewer.getMetadata();
    if (metadata.deleteable !== false) {
      this.deleteEmbeddedViewer(viewer);
      this.focus();
    }
  }
  
  private _createEmbeddedViewerElement(): EmbeddedViewer {
    // Create and set up a new command-frame.
    const el = <EmbeddedViewer> this._getWindow().document.createElement(EmbeddedViewer.TAG_NAME);
    injectKeybindingsManager(el, this._keyBindingManager);
    injectConfigDatabase(el, this._configDatabase);
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

    el.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);
    el.setTag("" + this._getNextTag());
    return el;
  }
  
  private _handleApplicationModeBracketEnd(): void {
    this._terminalCanvas.enforceScrollbackLengthAfter( () => {
      this._closeLastEmbeddedViewer(this._htmlData);
    });
  }

  private _closeLastEmbeddedViewer(returnCode: string): void {
    // Find the terminal viewer which has no return code set on it.
    let startElement: HTMLElement & VirtualScrollable = null;
    for (const el of this._terminalCanvas.getChildElements()) {
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

      this._terminalCanvas.removeScrollable(activeTerminalViewer);

      this._terminalCanvas.updateScrollableSize(embeddedViewerElement);
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
      const moveText = this._lastCommandTerminalViewer.getTerminalLines(this._lastCommandTerminalLine);
      this._lastCommandTerminalViewer.deleteLines(this._lastCommandTerminalLine);
      this._lastCommandTerminalViewer = null;
      
      // Append our new embedded viewer.
      const newViewerElement = this._createEmbeddedViewerElement();

        // Hang the terminal viewer under the Embedded viewer.
      newViewerElement.className = "extraterm_output";

      this._terminalCanvas.appendScrollable(newViewerElement);
      
      // Create a terminal viewer to display the output of the last command.
      const outputTerminalViewer = <TerminalViewer> document.createElement(TerminalViewer.TAG_NAME);
      injectKeybindingsManager(outputTerminalViewer, this._keyBindingManager);
      injectConfigDatabase(outputTerminalViewer, this._configDatabase);
      newViewerElement.setViewerElement(outputTerminalViewer);
      
      outputTerminalViewer.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);
      outputTerminalViewer.setReturnCode(returnCode);
      outputTerminalViewer.setCommandLine(this._lastCommandLine);
      outputTerminalViewer.setUseVPad(false);
      if (moveText !== null) {
        outputTerminalViewer.setTerminalLines(moveText);
      }
      outputTerminalViewer.setEditable(true);

      this._appendNewTerminalViewer();
      this._refocus();
      const activeTerminalViewer = this._terminalViewer;
      this._terminalCanvas.updateScrollableSize(activeTerminalViewer);
    }
  }

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    const text = this._terminalCanvas.getSelectionText();
    if (text !== null) {
      WebIpc.clipboardWrite(text);
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

    const uploader = new BulkFileUploader(bulkFileHandle, this._pty);

    const containerDiv = DomUtils.getShadowId(this, ID_CENTER_CONTAINER);
    const uploadProgressBar = <UploadProgressBar> document.createElement(UploadProgressBar.TAG_NAME);
    
    if ("filename" in bulkFileHandle.getMetadata()) {
      uploadProgressBar.filename = <string> bulkFileHandle.getMetadata()["filename"];
    }

    uploadProgressBar.total = bulkFileHandle.getTotalSize();
    uploader.onUploadedChange(uploaded => {
      uploadProgressBar.transferred = uploaded;
    });

    const inputFilterRegistration = this._registerInputStreamFilter((input: string): string => {
      const ctrlCIndex = input.indexOf("\x03");
      if (ctrlCIndex !== -1) {
        // Abort the upload.
        uploader.abort();
        inputFilterRegistration.dispose();
        return input.substr(ctrlCIndex + 1);
      } else {
        return "";
      }
    });

    uploader.onFinished(() => {
      containerDiv.removeChild(uploadProgressBar);
      inputFilterRegistration.dispose();
      doLater(() => {
        uploader.dispose();
      });
    });

    uploadProgressBar.hide();
    containerDiv.appendChild(uploadProgressBar);
    uploadProgressBar.show(200);  // Show after delay

    uploader.upload();
  }

  private _handleShowFile(bulkFileHandle: BulkFileHandle): void {
    const isDownload = bulkFileHandle.getMetadata()["download"] === "true";
    const {mimeType, charset} = BulkFileUtils.guessMimetype(bulkFileHandle);
    if (mimeType == null || isDownload) {
      this._appendMimeViewer("application/octet-stream", bulkFileHandle);
    } else {
      const newViewer = this._appendMimeViewer(mimeType, bulkFileHandle);
      if (newViewer == null) {
        this._appendMimeViewer("application/octet-stream", bulkFileHandle);
      }
    }
  }

  private _appendMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): ViewerElement {
    const mimeViewerElement = this._createMimeViewer(mimeType, bulkFileHandle);
    if (mimeViewerElement !== null) {
      this._closeLastEmbeddedViewer("0");
      const viewerElement = this._createEmbeddedViewerElement();
      viewerElement.setViewerElement(mimeViewerElement);
      this._appendScrollableElement(viewerElement);

      if (this._configDatabase != null) {
        const config = this._configDatabase.getConfig(GENERAL_CONFIG);
        this._terminalCanvas.enforceScrollbackSize(config.scrollbackMaxLines, config.scrollbackMaxFrames);
      }
    }
    return mimeViewerElement;
  }

  private _createMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): ViewerElement {
    let tag: string = null;
    const candidates = viewerClasses.filter( (viewerClass) => viewerClass.supportsMimeType(mimeType) );
    if (candidates.length !== 0) {
      tag = candidates[0].TAG_NAME;
    } else {
      tag = this._extensionManager.findViewerElementTagByMimeType(mimeType);
    }

    if (tag == null) {
      this._log.debug("Unknown mime type: " + mimeType);
      return null;
    }
    
    const dataViewer = <ViewerElement> this._getWindow().document.createElement(tag);
    injectKeybindingsManager(dataViewer, this._keyBindingManager);
    injectConfigDatabase(dataViewer, this._configDatabase);
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

  private _appendElementToBorder(element: HTMLElement, borderSide: BorderSide): void {
    // borderSize
    const sideToIdMapping = {
      [BorderSide.NORTH]: ID_NORTH_CONTAINER,
      [BorderSide.SOUTH]: ID_SOUTH_CONTAINER,
      [BorderSide.EAST]: ID_EAST_CONTAINER,
      [BorderSide.WEST]: ID_WEST_CONTAINER,
    };
    const borderSideElement = DomUtils.getShadowId(this, sideToIdMapping[borderSide]);
    borderSideElement.appendChild(element);
  }

  private _removeElementFromBorder(element: HTMLElement): void {
    const borderIds = [ID_NORTH_CONTAINER, ID_SOUTH_CONTAINER, ID_EAST_CONTAINER, ID_WEST_CONTAINER];
    for (const borderId of borderIds) {
      const borderSideElement = DomUtils.getShadowId(this, borderId);
      if (borderSideElement === element.parentElement) {
        borderSideElement.removeChild(element);
        break;
      }
    }
  }

  private _openFindPanel(): void {
    if (this._findPanel == null) {
      this._findPanel = <FindPanel> document.createElement(FindPanel.TAG_NAME);

//----    
      const fakeTerminal = {
        getViewers: (): TempFindPanelViewer_FIXME[] => {
          const result: TempFindPanelViewer_FIXME[] = [];
          for (const v of this.getViewerElements()) {
            if (v instanceof TerminalViewer) {
              result.push(v);
            }
          }
          return result;
        }
      };
//----    

      this._findPanel.setTerminal(fakeTerminal);
      this._findPanel.addEventListener("close", () => {
        this._removeElementFromBorder(this._findPanel);
        this._findPanel = null;
      });

      this._appendElementToBorder(this._findPanel, BorderSide.SOUTH);
    }
    this._findPanel.focus();
  }

}

// interface ApplicationModeHandler {
//   getIdentifier(): string;
//   handleStart(parameters: string[]): TermApi.ApplicationModeResponse;
//   handleData(data: string): TermApi.ApplicationModeResponse;
//   handleEnd(): void;
// }
