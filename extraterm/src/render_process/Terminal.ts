/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as crypto from 'crypto';
import { BulkFileHandle, Disposable, Event, ViewerMetadata, ViewerPosture, TerminalEnvironment } from 'extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import {WebComponent} from 'extraterm-web-component-decorators';
import { log as LogDecorator, Logger, getLogger } from "extraterm-logging";
import * as TermApi from 'term-api';
import { DeepReadonly } from 'extraterm-readonly-toolbox';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

import {BulkFileBroker} from './bulk_file_handling/BulkFileBroker';
import {BulkFileUploader} from './bulk_file_handling/BulkFileUploader';
import * as BulkFileUtils from './bulk_file_handling/BulkFileUtils';
import {DownloadApplicationModeHandler} from './DownloadApplicationModeHandler';
import {DownloadViewer} from './viewers/DownloadViewer';
import {Pty} from '../pty/Pty';
import {ViewerElement} from './viewers/ViewerElement';
import { SupportsMimeTypes, Mode, VisualState } from './viewers/ViewerElementTypes';
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
import { dispatchContextMenuRequest } from './command/CommandUtils';
import * as DomUtils from './DomUtils';
import {doLater, DebouncedDoLater} from 'extraterm-later';
import * as Term from './emulator/Term';
import {UploadProgressBar} from './UploadProgressBar';
import * as WebIpc from './WebIpc';
import * as Messages from '../WindowMessages';
import { TerminalCanvas } from './TerminalCanvas';
import { SidebarLayout, BorderSide } from './gui/SidebarLayout';
import {FrameFinder} from './FrameFinderType';
import { ConfigDatabase, CommandLineAction, injectConfigDatabase, AcceptsConfigDatabase, COMMAND_LINE_ACTIONS_CONFIG,
  GENERAL_CONFIG } from '../Config';
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";
import * as SupportsDialogStack from "./SupportsDialogStack";
import { ExtensionManager } from './extension/InternalTypes';
import { TerminalVisualConfig } from './TerminalVisualConfig';

const log = LogDecorator;

const DEBUG_APPLICATION_MODE = false;

const ID = "EtTerminalTemplate";
export const EXTRATERM_COOKIE_ENV = "LC_EXTRATERM_COOKIE";

const ID_CONTAINER = "ID_CONTAINER";

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


/**
 * An Extraterm terminal.
 * 
 * An EtTerminal is full terminal emulator with GUI intergration. It handles the
 * UI chrome wrapped around the smaller terminal emulation part (term.js).
 */
@WebComponent({tag: "et-terminal"})
export class EtTerminal extends ThemeableElementBase implements AcceptsKeybindingsManager,
  AcceptsConfigDatabase, Disposable, SupportsClipboardPaste.SupportsClipboardPaste,
  SupportsDialogStack.SupportsDialogStack {
  
  static TAG_NAME = "ET-TERMINAL";
  static EVENT_TITLE = "title";
  static EVENT_EMBEDDED_VIEWER_POP_OUT = "viewer-pop-out";
  static EVENT_APPENDED_VIEWER = "terminal-appended-viewer";

  environment = new TerminalEnvironmentImpl();

  private _log: Logger;
  private _pty: Pty = null;

  private _containerElement: HTMLElement = null;
  private _terminalCanvas: TerminalCanvas = null;
  private _terminalViewer: TerminalViewer = null;
  
  private _emulator: Term.Emulator = null;
  private _cookie = null;
  private _htmlData: string = null;
  
  private _fileBroker: BulkFileBroker = null;
  private _downloadHandler: DownloadApplicationModeHandler = null;
  private _terminalVisualConfig: TerminalVisualConfig = null;

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

  private _inputStreamFilters: InputStreamFilter[] = [];
  private _dialogStack: HTMLElement[] = [];

  private _copyToClipboardLater: DebouncedDoLater = null;

  static registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
    commands.registerCommand("extraterm:terminal.enterCursorMode", (args: any) => extensionManager.getActiveTerminal().commandEnterCursorMode());
    commands.registerCommand("extraterm:terminal.enterNormalMode", (args: any) => extensionManager.getActiveTerminal().commandExitCursorMode());
    commands.registerCommand("extraterm:terminal.scrollPageUp", (args: any) => extensionManager.getActiveTerminal().commandScrollPageUp());
    commands.registerCommand("extraterm:terminal.scrollPageDown", (args: any) => extensionManager.getActiveTerminal().commandScrollPageDown());
    commands.registerCommand("extraterm:terminal.goToPreviousFrame", (args: any) => extensionManager.getActiveTerminal().commandGoToPreviousFrame());
    commands.registerCommand("extraterm:terminal.goToNextFrame", (args: any) => extensionManager.getActiveTerminal().commandGoToNextFrame());
    commands.registerCommand("extraterm:terminal.copyToClipboard", (args: any) => extensionManager.getActiveTerminal().commandCopyToClipboard());
    commands.registerCommand("extraterm:terminal.pasteFromClipboard", (args: any) => extensionManager.getActiveTerminal().commandPasteFromClipboard());
    commands.registerCommand("extraterm:terminal.deleteLastFrame", (args: any) => extensionManager.getActiveTerminal().commandDeleteLastFrame());
    commands.registerCommand("extraterm:terminal.openLastFrame", (args: any) => extensionManager.getActiveTerminal().commandOpenLastFrame());
    commands.registerCommand("extraterm:terminal.resetVT", (args: any) => extensionManager.getActiveTerminal().commandResetVT());
    commands.registerCommand("extraterm:terminal.clearScrollback", (args: any) => extensionManager.getActiveTerminal().commandClearScrollback());
    commands.registerCommand("extraterm:terminal.increaseFontSize", (args: any) => extensionManager.getActiveTerminal().commandFontSizeIncrease());
    commands.registerCommand("extraterm:terminal.decreaseFontSize", (args: any) => extensionManager.getActiveTerminal().commandFontSizeDecrease());
    commands.registerCommand("extraterm:terminal.resetFontSize", (args: any) => extensionManager.getActiveTerminal().commandFontSizeReset());
    commands.registerCommand("extraterm:terminal.typeSelection", (args: any) => extensionManager.getActiveTerminal().commandTypeSelection());
    commands.registerCommand("extraterm:terminal.typeSelectionAndCr", (args: any) => extensionManager.getActiveTerminal().commandTypeSelectionAndCr());
  }
  
  constructor() {
    super();
    this._log = getLogger(EtTerminal.TAG_NAME, this);
    this._copyToClipboardLater = new DebouncedDoLater(() => this.copyToClipboard(), 100);
    this._fetchNextTag();
  }
   
  connectedCallback(): void {
    super.connectedCallback();
    if ( ! this._elementAttached) {
      this._elementAttached = true;

      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this._createClone();
      shadow.appendChild(clone);
      
      this.addEventListener('focus', this._handleFocus.bind(this));
      this.addEventListener('blur', this._handleBlur.bind(this));

      this._terminalCanvas = new TerminalCanvas();
      this._terminalCanvas.setConfigDatabase(this._configDatabase);
      this._terminalCanvas.setTerminalVisualConfig(this._terminalVisualConfig);
      this._containerElement = DomUtils.getShadowId(this, ID_CONTAINER);
      this._containerElement.appendChild(this._terminalCanvas);

      this._terminalCanvas.onBeforeSelectionChange(ev => this._handleBeforeSelectionChange(ev));

      this._terminalCanvas.connectedCallback();

      // Set up the emulator
      this._cookie = crypto.randomBytes(10).toString('hex');
      process.env[EXTRATERM_COOKIE_ENV] = this._cookie;
      this._initEmulator(this._cookie);
      this._appendNewTerminalViewer();
      
      this.updateThemeCss();

      this._terminalCanvas.addEventListener('mousedown', ev => this._handleMouseDownCapture(ev), true);
      this._terminalCanvas.addEventListener("contextmenu", (ev) => this._handleContextMenu(ev));
      
      this._terminalCanvas.addEventListener(GeneralEvents.EVENT_TYPE_TEXT, (ev: CustomEvent) => {
        const detail: GeneralEvents.TypeTextEventDetail = ev.detail;
        this.sendToPty(detail.text);
      });

      this._showTip();
    } else {

      // This was already attached at least once.
      this._terminalCanvas.scheduleResize();
    }
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

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this._terminalVisualConfig = terminalVisualConfig;
    if (this._terminalCanvas != null) {
      this._terminalCanvas.setTerminalVisualConfig(this._terminalVisualConfig);
    }
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
  sendToPty(text: string): void {
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
    
    for (const element of this._terminalCanvas.getViewerElements()) {
      if (EmbeddedViewer.is(element) && element.getTag() === frameId) {
        return element;
      }
    }
    return null;
  }

  getFontAdjust(): number {
    return this._terminalCanvas.getFontSizeAdjustment();
  }

  setFontAdjust(delta: number): void {
    this._terminalCanvas.setFontSizeAdjustment(delta);
  }

  getViewerElements(): ViewerElement[] {
    return this._terminalCanvas.getViewerElements();
  }
    
  getExtratermCookieValue(): string {
    return this._cookie;
  }

  protected updateThemeCss() {
    super.updateThemeCss();
    this.resizeToContainer();
  }

  showDialog(dialogElement: HTMLElement): Disposable {
    dialogElement.classList.add(CLASS_VISITOR_DIALOG);
    this._containerElement.appendChild(dialogElement);
    this._dialogStack.push(dialogElement);
    return {
      dispose: () => {
        dialogElement.classList.remove(CLASS_VISITOR_DIALOG);
        this._dialogStack = this._dialogStack.filter(el => el !== dialogElement);
        this._containerElement.removeChild(dialogElement);
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
        <${SidebarLayout.TAG_NAME} id='${ID_CONTAINER}'></${SidebarLayout.TAG_NAME}>
        `);
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

    config.tipTimestamp = Date.now();
    config.tipCounter = config.tipCounter + 1;
    this._configDatabase.setConfig(GENERAL_CONFIG, config);

    this._appendMimeViewer(TipViewer.MIME_TYPE, null);
  }
  
  private _handleFocus(event: FocusEvent): void {
    this._terminalCanvas.setModeAndVisualState(this._mode,
      this._mode === Mode.CURSOR ? VisualState.AUTO : VisualState.FOCUSED);
  }
  
  private _refocus(): void {
    if (this.hasFocus() && this._mode === Mode.DEFAULT &&
        this._terminalViewer != null && ! this._terminalViewer.hasFocus()) {
      DomUtils.focusWithoutScroll(this._terminalViewer);
    }
  }

  private _handleBlur(event: FocusEvent): void {
    this._terminalCanvas.setModeAndVisualState(this._mode, VisualState.UNFOCUSED);
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
    const terminalViewer = this._createTerminalViewer();
    terminalViewer.setEmulator(this._emulator);

    this._terminalViewer = terminalViewer;  // Putting this in _terminalViewer now prevents the VirtualScrollArea 
                                            // removing it from the DOM in the next method call.
    this._terminalCanvas.appendViewerElement(terminalViewer);
    this._terminalCanvas.setTerminalViewer(terminalViewer);

    this._emulator.refreshScreen();

    this._emitDidAppendViewer(terminalViewer);
  }

  private _createTerminalViewer(): TerminalViewer {
    const terminalViewer = <TerminalViewer> document.createElement(TerminalViewer.TAG_NAME);
    injectKeybindingsManager(terminalViewer, this._keyBindingManager);
    injectConfigDatabase(terminalViewer, this._configDatabase);
    terminalViewer.setVisualState(DomUtils.getShadowRoot(this).activeElement !== null
                                      ? VisualState.FOCUSED
                                      : VisualState.UNFOCUSED);
    return terminalViewer;
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
      this._terminalCanvas.updateSize(this._terminalViewer);
      this._terminalViewer = null;
    }
  }
  
  private _appendViewerElement(el: ViewerElement): void {
    this._emulator.moveRowsAboveCursorToScrollback();
    this._emulator.flushRenderQueue();
    let currentTerminalViewer = this._terminalViewer;
    
    let currentTerminalViewerHadFocus = false;
    if (currentTerminalViewer !== null) {
      currentTerminalViewer.deleteScreen();
      currentTerminalViewerHadFocus = currentTerminalViewer.hasFocus();

      if (currentTerminalViewer.isEmpty()) {
        // Keep this terminal viewer and re-use it later in the new position.
        this._terminalCanvas.removeViewerElement(currentTerminalViewer);
      } else {
        // This terminal viewer has stuff in it.
        currentTerminalViewer.setEmulator(null);
        currentTerminalViewer.setUseVPad(false);
        this._terminalCanvas.updateSize(currentTerminalViewer);
        this._terminalViewer = null;
        currentTerminalViewer = null;
      }
    }
    this._terminalCanvas.appendViewerElement(el);
    this._emitDidAppendViewer(el);

    if (currentTerminalViewer !== null) {
      this._terminalCanvas.appendViewerElement(currentTerminalViewer);
      this._terminalCanvas.setTerminalViewer(currentTerminalViewer);
      if (currentTerminalViewerHadFocus) {
        this._terminalCanvas.focus();
      }
      this._emitDidAppendViewer(currentTerminalViewer);

    } else {
      this._appendNewTerminalViewer();
      this._refocus();
    }
  }

  private _handleMouseDownCapture(ev: MouseEvent): void {
    if (ev.buttons === 4) { // Middle mouse button
      ev.stopPropagation();
      ev.preventDefault();
      this._pasteFromClipboard();
    }
  }

  private _handleContextMenu(ev: MouseEvent): void {
    if (this._terminalViewer !== null) {
      ev.stopPropagation();
      ev.preventDefault();
      dispatchContextMenuRequest(this._terminalViewer, ev.x, ev.y);
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
      this.sendToPty(filteredData);
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

      this.environment.setList([
        { key: TerminalEnvironment.TERM_ROWS, value: "" + newRows},
        { key: TerminalEnvironment.TERM_COLUMNS, value: "" + newColumns},
      ]);
    }
  }
  
  private _sendTitleEvent(title: string): void {
    const event = new CustomEvent(EtTerminal.EVENT_TITLE, { detail: {title: title } });
    this.dispatchEvent(event);    

    this.environment.set(TerminalEnvironment.TERM_TITLE, title);
  }

  getMode(): Mode {
    return this._mode;
  }

  private _enterCursorMode(): void {
    this._terminalCanvas.setModeAndVisualState(Mode.CURSOR, VisualState.AUTO);
    this._mode = Mode.CURSOR;
  }
  
  private _exitCursorMode(): void {
    if (this._mode == Mode.DEFAULT) {
      return;
    }
    this._terminalCanvas.setModeAndVisualState(Mode.DEFAULT, VisualState.FOCUSED);
    this._mode = Mode.DEFAULT;
    this._refocus();
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

  commandEnterCursorMode(): void {
    this._enterCursorMode();
  }

  commandExitCursorMode(): void {
    this._exitCursorMode();
  }
  
  commandScrollPageUp(): void {
    this._terminalCanvas.scrollPageUp();
  }
    
  commandScrollPageDown(): void {
    this._terminalCanvas.scrollPageDown();
  }

  commandGoToPreviousFrame(): void {
    this._terminalCanvas.goToPreviousFrame();
  }

  commandGoToNextFrame(): void {
    this._terminalCanvas.goToNextFrame();
  }

  commandCopyToClipboard(): void {
    this.copyToClipboard();
  }

  commandPasteFromClipboard(): void {
    this._pasteFromClipboard();
  }

  commandDeleteLastFrame(): void {
    this._deleteLastEmbeddedViewer();
  }

  commandOpenLastFrame(): void {
    this._popOutLastEmbeddedViewer();
  }

  commandResetVT(): void {
    this._emulator.reset();
  }

  commandClearScrollback(): void {
    this._terminalCanvas.enforceScrollbackSize(0, 0);
  }

  commandFontSizeIncrease(): void {
    this._terminalCanvas.setFontSizeAdjustment(1);
  }

  commandFontSizeDecrease(): void {
  this._terminalCanvas.setFontSizeAdjustment(-1);
  }

  commandFontSizeReset(): void {
    this._terminalCanvas.resetFontSize();
  }

  commandTypeSelection(): void {
    const text = this._terminalCanvas.getSelectionText();
    if (text !== null) {
      this.sendToPty(text);
    }
  }

  commandTypeSelectionAndCr(): void {
    const text = this._terminalCanvas.getSelectionText();
    if (text !== null) {
      this.sendToPty(text + "\r");
    }
    this.commandExitCursorMode();
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
    for (const element of this._terminalCanvas.getViewerElements()) {
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
      
      this._appendViewerElement(el);
    } else {

      this._moveCursorToFreshLine();
      this._emulator.moveRowsAboveCursorToScrollback();
      this._emulator.flushRenderQueue();

      this._lastCommandTerminalLine = this._terminalViewer.bookmarkLine(this._terminalViewer.lineCount() -1);
      this._lastCommandTerminalViewer = this._terminalViewer;
    }
    this._lastCommandLine = cleancommand;

    this.environment.setList([
      { key: TerminalEnvironment.COMMAND_CURRENT, value: cleancommand },
      { key: TerminalEnvironment.COMMAND_EXIT_CODE, value: "" },
    ]);
  }
  
  private _moveCursorToFreshLine(): void {
    const dims = this._emulator.getDimensions();
    if (dims.cursorX !== 0 && this._emulator.getLineText(dims.cursorY).trim() !== '') {
      this._emulator.newLine();
    }
  }

  deleteEmbeddedViewer(viewer: EmbeddedViewer): void {
    this._terminalCanvas.removeViewerElement(viewer);
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
      const returnCode = this._htmlData;
      this._closeLastEmbeddedViewer(returnCode);

      const lastCommand = this.environment.get(TerminalEnvironment.COMMAND_CURRENT);
      const newVars = [
        { key: TerminalEnvironment.COMMAND_EXIT_CODE, value: "" },
        { key: TerminalEnvironment.COMMAND_CURRENT, value: "" },
      ];
      if (lastCommand != null) {
        newVars.push( { key: TerminalEnvironment.COMMAND_LAST, value: lastCommand });
      }
      this.environment.setList(newVars);
    });
  }

  private _closeLastEmbeddedViewer(returnCode: string): void {
    // Find the terminal viewer which has no return code set on it.
    let startElement: ViewerElement = null;
    for (const el of this._terminalCanvas.getViewerElements()) {
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
      const restoreFocus = this._terminalCanvas.hasFocus();
      
      embeddedViewerElement.setViewerElement(activeTerminalViewer);
      activeTerminalViewer.setEditable(true);
      this._terminalCanvas.removeViewerElement(activeTerminalViewer);

      this._terminalCanvas.updateSize(embeddedViewerElement);
      this._appendNewTerminalViewer();
      
      if (restoreFocus) {
        this._terminalCanvas.focus();
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
      const newEmbeddedViewer = this._createEmbeddedViewerElement();

        // Hang the terminal viewer under the Embedded viewer.
      newEmbeddedViewer.className = "extraterm_output";

      this._terminalCanvas.appendViewerElement(newEmbeddedViewer);
      
      // Create a terminal viewer to display the output of the last command.
      const outputTerminalViewer = this._createTerminalViewer();
      newEmbeddedViewer.setViewerElement(outputTerminalViewer);
      
      outputTerminalViewer.setReturnCode(returnCode);
      outputTerminalViewer.setCommandLine(this._lastCommandLine);
      outputTerminalViewer.setUseVPad(false);
      if (moveText !== null) {
        outputTerminalViewer.setTerminalLines(moveText);
      }
      outputTerminalViewer.setEditable(true);
      this._emitDidAppendViewer(newEmbeddedViewer);
      
      this._appendNewTerminalViewer();
      this._refocus();
      const activeTerminalViewer = this._terminalViewer;
      this._terminalCanvas.updateSize(activeTerminalViewer);
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
    if (text == null || text === "") {
      return;
    }

    if (this._mode === Mode.CURSOR) {
      for (const viewerElement of this._terminalCanvas.getViewerElements()) {
        if (viewerElement.hasFocus()) {
          if (SupportsClipboardPaste.isSupportsClipboardPaste(viewerElement) && viewerElement.canPaste()) {
            viewerElement.pasteText(text);
          }
          break;
        }
      }

    } else {
      // An Enter key for the terminal is \r, but line endings in text can be either CRLF or LF. Thus, conversion.
      const terminalText = text.replace(/[\r][\n]/g, "\r").replace(/[\n]/g, "\r");
      this.sendToPty(terminalText);
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
      this.sendToPty("#error\n");
      return;
    }

    const uploader = new BulkFileUploader(bulkFileHandle, this._pty);
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
      this._containerElement.removeChild(uploadProgressBar);
      inputFilterRegistration.dispose();
      doLater(() => {
        uploader.dispose();
      });
    });

    uploadProgressBar.hide();
    this._containerElement.appendChild(uploadProgressBar);
    uploadProgressBar.show(200);  // Show after delay

    uploader.upload();
  }

  private _handleShowFile(bulkFileHandle: BulkFileHandle): void {
    const isDownload = bulkFileHandle.getMetadata()["download"] === "true";
    const {mimeType, charset} = BulkFileUtils.guessMimetype(bulkFileHandle);
    this._appendMimeViewer(mimeType == null || isDownload ? "application/octet-stream" : mimeType,
      bulkFileHandle);
  }

  private _appendMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): ViewerElement {
    const mimeViewerElement = this._createMimeViewer(mimeType, bulkFileHandle);
    if (mimeViewerElement !== null) {
      this._closeLastEmbeddedViewer("0");
      const viewerElement = this._createEmbeddedViewerElement();
      viewerElement.setViewerElement(mimeViewerElement);
      this._appendViewerElement(viewerElement);

      if (this._configDatabase != null) {
        const config = this._configDatabase.getConfig(GENERAL_CONFIG);
        this._terminalCanvas.enforceScrollbackSize(config.scrollbackMaxLines, config.scrollbackMaxFrames);
      }
      this._emitDidAppendViewer(mimeViewerElement);
    }
    return mimeViewerElement;
  }

  private _emitDidAppendViewer(viewer: ViewerElement): void {
    const event = new CustomEvent(EtTerminal.EVENT_APPENDED_VIEWER, { detail: { viewer } });
    this.dispatchEvent(event);    
  }

  private _createMimeViewer(mimeType: string, bulkFileHandle: BulkFileHandle): ViewerElement {
    let tag: string = null;
    const candidates = this._findViewersForMimeType(mimeType);
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

  private _findViewersForMimeType(mimeType: string): SupportsMimeTypes[] {
    const candidates = this._findViewersForMimeTypeStrict(mimeType);
    if (candidates.length !== 0) {
      return candidates;
    }

    if (mimeType.startsWith("text/")) {
      const textCandidates = this._findViewersForMimeTypeStrict("text/plain");
      if (textCandidates.length !== 0) {
        return textCandidates;
      }
    }

    return this._findViewersForMimeTypeStrict("application/octet-stream");
  }

  private _findViewersForMimeTypeStrict(mimeType: string): SupportsMimeTypes[] {
    return viewerClasses.filter( viewerClass => viewerClass.supportsMimeType(mimeType) );
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

  appendElementToBorder(element: HTMLElement, borderSide: BorderSide): void {
    element.slot = borderSide;
    this._containerElement.appendChild(element);
  }

  removeElementFromBorder(element: HTMLElement): void {
    this._containerElement.removeChild(element);
  }
}

// interface ApplicationModeHandler {
//   getIdentifier(): string;
//   handleStart(parameters: string[]): TermApi.ApplicationModeResponse;
//   handleData(data: string): TermApi.ApplicationModeResponse;
//   handleEnd(): void;
// }

class TerminalEnvironmentImpl implements TerminalEnvironment {

  private _map = new Map<string, string>();

  onChange: Event<string[]>;
  _onChangeEventEmitter = new EventEmitter<string[]>();

  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
  }

  get(key: string): string {
    return this._map.get(key);
  }
  
  has(key: string): boolean {
    return this._map.has(key);
  }

  set(key: string, value: string): void {
    const oldValue = this._map.get(key);
    if (oldValue !== value) {
      this._map.set(key, value);
      this._onChangeEventEmitter.fire([key]);
    }
  }

  setList(list: {key: string, value: string}[]): void {
    const changeList = [];
    for (const pair of list) {
      const oldValue = this._map.get(pair.key);
      if (oldValue !== pair.value) {
        this._map.set(pair.key, pair.value);
        changeList.push(pair.key);
      }
    }

    if (changeList.length !== 0) {
      this._onChangeEventEmitter.fire(changeList);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this._map.entries();
  }

  entries(): IterableIterator<[string, string]> {
    return this._map.entries();
  }
}
