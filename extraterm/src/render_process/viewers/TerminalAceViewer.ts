/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import { BulkFileHandle, Disposable, FindOptions, ViewerMetadata, ViewerPosture, FindStartPosition, TerminalTheme } from 'extraterm-extension-api';
import * as XRegExp from "xregexp";

import {BlobBulkFileHandle} from '../bulk_file_handling/BlobBulkFileHandle';
import {doLater, doLaterFrame, DebouncedDoLater} from 'extraterm-later';
import * as DomUtils from '../DomUtils';
import { ExtraEditCommands } from './ExtraAceEditCommands';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';
import * as Term from '../emulator/Term';
import * as TermApi from 'term-api';
import { BookmarkRef } from './TerminalViewerTypes';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from './ViewerElement';
import { VisualState, Mode, Edge, CursorEdgeDetail, RefreshLevel, CursorMoveDetail } from './ViewerElementTypes';
import { emitResizeEvent, SetterState } from '../VirtualScrollArea';
import { TerminalCanvasAceEditor, TerminalDocument, TerminalCanvasEditSession, TerminalCanvasRenderer, CursorStyle } from "extraterm-ace-terminal-renderer";
import { Anchor, Command, DefaultCommands, Editor, MultiSelectCommands, Origin, Position, SelectionChangeEvent, UndoManager, TextMode } from "ace-ts";
import { TextEditor } from './TextEditorType';
import { dispatchContextMenuRequest } from '../command/CommandUtils';
import { SearchOptions } from 'ace-ts/build/SearchOptions';
import { TerminalVisualConfig, AcceptsTerminalVisualConfig } from '../TerminalVisualConfig';
import { Color } from '../gui/Util';
import { TerminalCanvasRendererConfig } from 'extraterm-ace-terminal-renderer';
import { ConfigCursorStyle } from '../../Config';

const ID = "EtTerminalAceViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const ID_CSS_VARS = "ID_CSS_VARS";
const CLASS_HIDE_CURSOR = "hide-cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";
const CLASS_HAS_TERMINAL = "CLASS_HAS_TERMINAL";

const NO_STYLE_HACK = "NO_STYLE_HACK";

const DEBUG_RESIZE = false;

let cssText: string = null;

function getCssText(): string {
  return cssText;
}


@WebComponent({tag: "et-terminal-ace-viewer"})
export class TerminalViewer extends ViewerElement implements SupportsClipboardPaste.SupportsClipboardPaste,
    TextEditor, AcceptsTerminalVisualConfig, Disposable {

  static TAG_NAME = "ET-TERMINAL-ACE-VIEWER";
  static EVENT_KEYBOARD_ACTIVITY = "keyboard-activity";

  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is TerminalViewer {
    return node !== null && node !== undefined && node instanceof TerminalViewer;
  }

  private _log: Logger;
  private _emulator: Term.Emulator = null;

  // The line number of the top row of the emulator screen (i.e. after the scrollback  part).
  private _terminalFirstRow = 0;
  private _metadataEventDoLater: DebouncedDoLater = null;
  private _commandLine: string = null;
  private _returnCode: string = null;

  private _aceEditor: TerminalCanvasAceEditor = null;
  private _aceEditSession: TerminalCanvasEditSession = null;
  private _aceRenderer: TerminalCanvasRenderer = null;
  private _aceHasUndoManager = false;

  private _height = 0;
  private _isEmpty = true;
  private _mode: Mode = Mode.DEFAULT;
  private _editable = false;
  private _useVPad = true;
  private _visualState: VisualState = VisualState.AUTO;
  private _terminalVisualConfig: TerminalVisualConfig = null;

  private _needEmulatorResize: boolean = false;
  
  // Emulator dimensions
  private _rows = -1;
  private _columns = -1;
  private _realizedRows = -1;
  private _cursorRow = 0;
  private _cursorColumn = 0;

  private _documentHeightRows= -1;  // Used to detect changes in the viewport size when in Cursor mode.
  private _fontUnitWidth = 10;  // slightly bogus defaults
  private _fontUnitHeight = 10;

  private _renderEventListener: TermApi.RenderEventHandler = this._handleRenderEvent.bind(this);

  private _bookmarkCounter = 0;
  private _bookmarkIndex = new Map<BookmarkRef, Anchor>();

  private _rerenderLater: DebouncedDoLater = null;
  private _checkDisconnectLater: DebouncedDoLater = null;

  constructor() {
    super();
    this._log = getLogger(TerminalViewer.TAG_NAME, this);
    this._checkDisconnectLater = new DebouncedDoLater(() => this._handleDelayedDisconnect());
    this._rerenderLater = new DebouncedDoLater(() => this._handleDelayedRerender());

    this._renderEventListener = this._handleRenderEvent.bind(this);
    
    this._metadataEventDoLater = new DebouncedDoLater(() => {
      const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
      this.dispatchEvent(event);
    });
  }

  dispose(): void {
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = this._commandLine !== null ? this._commandLine : "Terminal Command";
    metadata.icon = this._returnCode === "0" ? "fa fa-check" : "fa fa-times";

    switch(this._returnCode) {
      case null:
        metadata.posture = ViewerPosture.RUNNING;
        break;
      case "0":
        metadata.posture = ViewerPosture.SUCCESS;
        break;
      default:
        metadata.posture = ViewerPosture.FAILURE;
        break;
    }

    if (this._returnCode != null) {
      metadata.toolTip = `Return code: ${this._returnCode}`;
    }

    return metadata;
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) === null) {
      this.tabIndex = 0;
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
      const clone = this.createClone();
      shadow.appendChild(clone);
      
      this.installThemeCss();

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

      this.style.height = "0px";
      this._mode = Mode.DEFAULT;

      this._aceEditSession = new TerminalCanvasEditSession(new TerminalDocument(""), new TextModeWithWordSelect());

      this._aceRenderer = new TerminalCanvasRenderer(containerDiv, {
        cursorStyle: this._configCursorStyleToRendererCursorStyle(this._terminalVisualConfig.cursorStyle),
        palette: this._extractPalette(this._terminalVisualConfig),
        fontFamily: this._terminalVisualConfig.fontFamily,
        fontSizePx: this._terminalVisualConfig.fontSizePx,
        devicePixelRatio: this._terminalVisualConfig.devicePixelRatio,
      });
      this._aceRenderer.init();
      this._aceRenderer.setShowGutter(false);
      this._aceRenderer.setShowLineNumbers(false);
      this._aceRenderer.setDisplayIndentGuides(false);

      this._aceEditor = new TerminalCanvasAceEditor(this._aceRenderer, this._aceEditSession);
      this._aceEditor.setRelayInput(true);
      this._aceEditor.setReadOnly(true);
      this._aceEditor.setAutoscroll(false);
      this._aceEditor.setHighlightActiveLine(false);

      this.__addCommands(DefaultCommands);
      this.__addCommands(MultiSelectCommands);
      this.__addCommands(ExtraEditCommands);

      this.__updateHasTerminalClass();
      this._aceEditor.on("keyPress", ev => {
        if (this._emulator != null && this._mode == Mode.DEFAULT) {
          if (this._emulator.plainKeyPress(ev.text)) {
            this._emitKeyboardActivityEvent();
          }
        }
      });
      this._aceEditor.on("compositionStart", () => this._onCompositionStart());
      this._aceEditor.on("change", (data, editor) => {
        if (this._mode !== Mode.CURSOR) {
          return;
        }
        
        const heightRows = this._aceEditSession.getLength();
        if (heightRows !== this._documentHeightRows) {
          this._documentHeightRows = heightRows;
          doLater( () => {
            emitResizeEvent(this);
          });
        }
      });

      this._aceEditor.selection.on("changeCursor", () => {
        const effectiveFocus = this._visualState === VisualState.FOCUSED ||
                                (this._visualState === VisualState.AUTO && this.hasFocus());
        if (this._mode !== Mode.DEFAULT && effectiveFocus) {
          const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
          this.dispatchEvent(event);
        }
      });
      
      this._aceEditor.on("focus", () => {
        if (this._emulator !== null) {
          this._emulator.focus();
        }
        
        if (this._visualState === VisualState.AUTO) {
          const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
          containerDiv.classList.add(CLASS_FOCUSED);
          containerDiv.classList.remove(CLASS_UNFOCUSED);
        }

        super.focus();
      });

      this._aceEditor.on("blur", () => {
        if (this._emulator !== null) {
          this._emulator.blur();
        }
        
        if (this._visualState === VisualState.AUTO) {
          containerDiv.classList.add(CLASS_UNFOCUSED);
          containerDiv.classList.remove(CLASS_FOCUSED);
        }
      });
      
      this._aceEditor.on("changeSelection", (event: SelectionChangeEvent) => {
        this._emitBeforeSelectionChangeEvent(event.origin === Origin.USER_MOUSE);
      });

      this._aceEditor.onCursorTopHit((column: number) => {
        this._emitCursorEdgeEvent(Edge.TOP, column);
      });

      this._aceEditor.onCursorBottomHit((column: number) => {
        this._emitCursorEdgeEvent(Edge.BOTTOM, column);
      });

      this._exitCursorMode();
      
      // Filter the keyboard events before they reach Ace.
      containerDiv.addEventListener('keydown', ev => this._handleContainerKeyDownCapture(ev), true);

      const aceElement = this._aceEditor.renderer.scrollerElement;
      aceElement.addEventListener("mousedown", ev => this._handleMouseDownEvent(ev), true);
      aceElement.addEventListener("mouseup", ev => this._handleMouseUpEvent(ev), true);
      aceElement.addEventListener("mousemove", ev => this._handleMouseMoveEvent(ev), true);
      aceElement.addEventListener("wheel", ev => this._handleMouseWheelEvent(ev), true);
    }

    this._updateCssVars();
    
    if (this._needEmulatorResize) {
      this._needEmulatorResize = false;
    }
    this._rerenderLater.trigger();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._checkDisconnectLater.trigger();
  }

  private _handleDelayedDisconnect(): void {
    if (this.isConnected || this._aceRenderer == null) {
      return;
    }
    this._aceRenderer.reduceMemory();
  }

  private _handleDelayedRerender(): void {
    if ( ! this.isConnected || this._aceRenderer == null) {
      return;
    }
    this._aceRenderer.rerenderText();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL_VIEWER];
  }

  private _extractPalette(terminalVisualConfig: TerminalVisualConfig): number[] {
    const palette = terminalVisualConfig == null
                    ? this._fallbackPalette()
                    : this._extractPaletteFromTerminalVisualConfig(terminalVisualConfig);
    if (terminalVisualConfig.transparentBackground) {
      palette[256] = 0x00000000;
    }
    return palette;
  }

  private _fallbackPalette(): number[] {
    const result = [];
    // Very simple white on black palette.
    result[0] = 0x00000000;
    for (let i=1; i<256; i++) {
      result[i] = 0xffffffff;
    }
    result[256] = 0x00000000;
    result[257] = 0xf0f0f0ff;
    result[258] = 0xffaa00ff;
    return result;
  }

  private _extractPaletteFromTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): number[] {
    const result: number[] = [];
    const terminalTheme = terminalVisualConfig.terminalTheme;
    for (let i=0; i<256; i++) {
      result.push(cssHexColorToRGBA(terminalTheme[i]));
    }

    result.push(cssHexColorToRGBA(terminalTheme.backgroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.foregroundColor));
    result.push(cssHexColorToRGBA(terminalTheme.cursorBackgroundColor));

    return result;
  }
  
  private _configCursorStyleToRendererCursorStyle(configCursorStyle: ConfigCursorStyle): CursorStyle {
    switch (configCursorStyle) {
      case "block":
        return CursorStyle.BLOCK;
      case "underscore":
        return CursorStyle.UNDERLINE;
      case "beam":
        return CursorStyle.BEAM;
    }
  }

  private _configCursorStyleToHollowRendererCursorStyle(configCursorStyle: ConfigCursorStyle): CursorStyle {
    switch (configCursorStyle) {
      case "block":
        return CursorStyle.BLOCK_OUTLINE;
      case "underscore":
        return CursorStyle.UNDERLINE_OUTLINE;
      case "beam":
        return CursorStyle.BEAM_OUTLINE;
    }
  }

  private _emitCursorEdgeEvent(edge: Edge, column: number): void {
    doLater( () => {
      const detail: CursorEdgeDetail = { edge, ch: column };
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_EDGE, { bubbles: true, detail: detail });
      this.dispatchEvent(event);
    });
  }

  private __addCommands(commands: Command<Editor>[]): void {
    const commandsWithoutKeys: Command<Editor>[] = [];
    for (let cmd of commands) {
      commandsWithoutKeys.push({
        name:cmd.name,
        exec:cmd.exec,
        group:cmd.group,
        multiSelectAction:cmd.multiSelectAction,
        passEvent:cmd.passEvent,
        readOnly:cmd.readOnly,
        scrollIntoView:cmd.scrollIntoView,
        isAvailable:cmd.isAvailable,
      });  
    }
    this._aceEditor.commands.addCommands(commandsWithoutKeys);
  }

  setCommandLine(commandLine: string): void {
    this._commandLine = commandLine;
    this._metadataEventDoLater.trigger();
  }
  
  setReturnCode(returnCode: string): void {
    this._returnCode = returnCode;
    this._metadataEventDoLater.trigger();
  }

  getSelectionText(): string {    
    if (this._aceEditor.selection.isEmpty()) {
      return null;
    }

    const selection = this._aceEditSession.getSelection()
    if (selection.inMultiSelectMode) {
      return selection.getAllRanges().map(range => this._aceEditSession.getUnwrappedTextRange(range)).join("\n");
    } else {
      return this._aceEditSession.getUnwrappedTextRange(selection.getRange());
    }
  }

  // From SupportsClipboardPaste interface.
  canPaste(): boolean {
    return this._mode === Mode.CURSOR;
  }

  // From SupportsClipboardPaste interface.
  pasteText(text: string): void {
    if ( ! this.canPaste()) {
      return;
    }
    this._aceEditor.paste({text});
  }

  focus(): void {
    this._aceEditor.focus();
  }

  hasFocus(): boolean {
    return this._aceEditor.isFocused();
  }

  hasSelection(): boolean {
    const selection = this._aceEditor.getSelection();
    if (selection == null) {
      return false;
    }
    return ! selection.isEmpty();
  }

  setVisualState(newVisualState: VisualState): void {
    if (newVisualState !== this._visualState) {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      if (containerDiv !== null) {
        if (this._showAsFocussed(newVisualState)) {
          containerDiv.classList.add(CLASS_FOCUSED);
          containerDiv.classList.remove(CLASS_UNFOCUSED);

          this._aceRenderer.setRenderCursorStyle(this._configCursorStyleToRendererCursorStyle(this._terminalVisualConfig.cursorStyle));

          if (this._emulator != null && this._terminalVisualConfig != null) {
            this._emulator.setCursorBlink(this._terminalVisualConfig.cursorBlink);
          }

        } else {
          containerDiv.classList.add(CLASS_UNFOCUSED);
          containerDiv.classList.remove(CLASS_FOCUSED);

          this._aceRenderer.setRenderCursorStyle(this._configCursorStyleToHollowRendererCursorStyle(this._terminalVisualConfig.cursorStyle));

          if (this._emulator !== null && this._terminalVisualConfig != null) {
            this._emulator.setCursorBlink(false);
          }
        }
      }
      this._visualState = newVisualState;
    }
  }

  private _showAsFocussed(visualState: VisualState): boolean {
    return (visualState === VisualState.AUTO && this.hasFocus()) ||
      visualState === VisualState.FOCUSED;
  }

  getVisualState(): VisualState {
    return this._visualState;
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    const previousConfig = this._terminalVisualConfig;
    this._terminalVisualConfig = terminalVisualConfig;
    if (this._aceRenderer != null) {

      const cursorStyle = (this._showAsFocussed(this._visualState)
                            ? this._configCursorStyleToRendererCursorStyle(terminalVisualConfig.cursorStyle)
                            : this._configCursorStyleToHollowRendererCursorStyle(terminalVisualConfig.cursorStyle));

      const config: TerminalCanvasRendererConfig = {
        cursorStyle,
        palette: this._extractPalette(terminalVisualConfig),
        fontFamily: terminalVisualConfig.fontFamily,
        fontSizePx: terminalVisualConfig.fontSizePx,
        devicePixelRatio: terminalVisualConfig.devicePixelRatio,
      };

      let requestResize = false;
      if (previousConfig == null) {
        this._aceRenderer.setTerminalCanvasRendererConfig(config);
        requestResize = true;
      } else {

        const fontPropertiesChanged = previousConfig.fontFamily !== terminalVisualConfig.fontFamily ||
          previousConfig.fontSizePx !== terminalVisualConfig.fontSizePx ||
          previousConfig.devicePixelRatio !== terminalVisualConfig.devicePixelRatio;

        if (fontPropertiesChanged ||
            previousConfig.cursorStyle !== terminalVisualConfig.cursorStyle ||
            previousConfig.transparentBackground !== terminalVisualConfig.transparentBackground ||
            ! this._isTerminalThemeEqual(previousConfig.terminalTheme, terminalVisualConfig.terminalTheme)) {
          this._aceRenderer.setTerminalCanvasRendererConfig(config);
        }
        requestResize = fontPropertiesChanged;
      }

      if (requestResize) {
        window.queueMicrotask(() => {
          emitResizeEvent(this);
        });
      }
    }
  }

  private _isTerminalThemeEqual(themeA: TerminalTheme, themeB: TerminalTheme): boolean {
    for (let i=0; i<256; i++) {
      if (themeA[i] !== themeB[i]) {
        return false;
      }
    }

    const objectKeys: (keyof TerminalTheme)[] = [
      "foregroundColor",
      "backgroundColor",
      "cursorForegroundColor",
      "cursorBackgroundColor",
      "findHighlightBackgroundColor",
      "selectionBackgroundColor"
    ];

    for (const key in objectKeys) {
      if (themeA[key] !== themeB[key]) {
          return false;
      }
    }
    return true;
  }

  getBulkFileHandle(): BulkFileHandle {
    const text =  this._isEmpty ? "" : this._aceEditor.getValue();
    return new BlobBulkFileHandle(this.getMimeType()+";charset=utf8", {}, Buffer.from(text, 'utf8'));
  }
  
  isEmpty(): boolean {
    return this._isEmpty;
  }

  setEmulator(emulator: Term.Emulator): void {    
    if (this._emulator !== null) {
      // Disconnect the last emulator.
      this._emulator.removeRenderEventListener(this._renderEventListener);
      this._emulator = null;
    }
    
    if (emulator !== null) {
      emulator.addRenderEventListener(this._renderEventListener);
    }

    this._emulator = emulator;
    this.__updateHasTerminalClass();
  }

  getEmulator(): Term.Emulator {
    return this._emulator;
  }
  
  setMode(newMode: Mode): void {
    if (newMode !== this._mode) {
      this._mode = newMode;
      this._applyMode();
    }
  }
  
  getMode(): Mode {
    return this._mode;
  }
  
  setEditable(editable: boolean): void {
    this._editable = editable;

    this._applyMode();
  }
  
  getEditable(): boolean {
    return this._editable;
  }

  private _applyMode(): void {
    switch (this._mode) {
      case Mode.CURSOR:
        // Enter cursor mode.
        this._enterCursorMode();
        break;
        
      case Mode.DEFAULT:
        this._exitCursorMode();
        break;
    }
  }

  find(needle: string, options?: FindOptions): boolean {
    const result = this._aceEditor.find(needle, this._findOptionsToSearchOptions(options))
    if (result) {
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);
    }
    return result != null;
  }

  private _findOptionsToSearchOptions(findOptions?: FindOptions): SearchOptions {
    if (findOptions == null) {
      return {};
    }

    const searchOptions: SearchOptions = {preventScroll: true};
    if (findOptions.backwards !== undefined) {
      searchOptions.backwards = findOptions.backwards;
    }
    switch (findOptions.startPosition) {
      case FindStartPosition.CURSOR:
        break;

      case FindStartPosition.DOCUMENT_START:
        searchOptions.start = { start: {row: 0, column: 0}, end: {row: 0, column: 0}};
        break;

      case FindStartPosition.DOCUMENT_END: {
        const doc = this._aceEditor.getSession().doc;
        const row = doc.getLength() - 1;
        const column = doc.getLine(row).length;
        searchOptions.start = { start: {row, column}, end: {row, column}};
        }
        break;
    }

    return searchOptions;
  }

  findNext(needle: string): boolean {
    const result = this._aceEditor.findNext(needle) != null;
    if (result != null) {
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);
    }
    return result != null;
  }

  findPrevious(needle: string): boolean {
    const result = this._aceEditor.findPrevious(needle) != null;
    if (result != null) {
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);
    }
    return result != null;
  } 

  highlight(re: RegExp): void {
    this._aceEditor.highlight(re);
  }

  /**
   * Gets the height of this element.
   * 
   * @return {number} [description]
   */
  getHeight(): number {
    return this._height;
  }

  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (setterState.heightChanged || setterState.yOffsetChanged) {
      if (DEBUG_RESIZE) {
        this._log.debug(`setDimensionsAndScroll(height=${setterState.height}, heightChanged=${setterState.heightChanged}, yOffset=${setterState.yOffset}, yOffsetChanged=${setterState.yOffsetChanged})`);
      }
      this._adjustHeight(setterState.height);
      this.scrollTo(0, setterState.yOffset);
    }
  }
  
  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

  setUseVPad(use: boolean): void {
    this._useVPad = use;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    const result = this.getVirtualTextHeight();
    if (DEBUG_RESIZE) {
      this._log.debug("getVirtualHeight: ",result);
    }
    return result;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    let reserve = 0;
    if (this._useVPad) {
      if (this._aceEditor != null && this._aceEditor.renderer.layerConfig.charHeightPx !== 0) {
        const defaultTextHeight = this._aceEditor.renderer.layerConfig.charHeightPx;
        const vPad = containerHeight % defaultTextHeight;
        reserve = vPad;
      }
    }
    if (DEBUG_RESIZE) {
      this._log.debug("getReserveViewportHeight: ", reserve);
    }
    return reserve;
  }

  refresh(level: RefreshLevel): void {
    let resizeEventNeeded = false;

    if (this._aceEditSession != null) {
      if (DEBUG_RESIZE) {
        this._log.debug("calling aceEditor.resize()");
      }

      if (level === RefreshLevel.RESIZE) {
        if (this._aceEditor.resize(false)) {
          resizeEventNeeded = true;
        }
      } else {
        this._aceEditor.updateFontSize();
        if (this._aceEditor.resize(true)) {
          resizeEventNeeded = true;
        }
      }
    }

    if (resizeEventNeeded) {
      emitResizeEvent(this);
      this._updateCssVars();
    }

    if (this.getEmulator() !== null) {
      const newSize = this._computeTerminalSizeFromViewer();
      if (newSize != null) {
        const currentSize = this._emulator.size();
        if (newSize.rows !== currentSize.rows || newSize.columns !== currentSize.columns) {
          this._rows = newSize.rows;
          this._columns = newSize.columns;

          if (DEBUG_RESIZE) {
            this._log.debug("Resizing emulator to rows: ", newSize.rows, " columns: ", newSize.columns);
          }

          this.getEmulator().resize(newSize);
        }
      }
    }
  }

  private _getViewportElement(): HTMLElement {
    let viewportElement = this.parentElement;
    while (window.getComputedStyle(viewportElement).position === 'absolute') {
      viewportElement = viewportElement.parentElement;
    }
    return viewportElement;
  }

  private _computeTerminalSizeFromViewer(): TermApi.TerminalSize | null {
    if (this.clientWidth === 0) {
      return null;
    }

    const viewportElement = this._getViewportElement();
    const newSize = this._computeTerminalSizeFromPixels(this.clientWidth, viewportElement.clientHeight);
    if (newSize == null) {
      return null;
    }
    return newSize;
  }

  private _computeTerminalSizeFromPixels(widthPixels: number, heightPixels: number): TermApi.TerminalSize | null {
    const charHeight = this._aceEditor.renderer.layerConfig.charHeightPx;
    const charWidth = this._aceEditor.renderer.layerConfig.charWidthPx;

    if (charHeight === 0 || charWidth === 0) {
      return null;
    }

    const computedStyle = window.getComputedStyle(this);
    const width = widthPixels - px(computedStyle.marginLeft) - px(computedStyle.marginRight) - 4;
    const newCols = Math.floor(width / charWidth);
    const newRows = Math.max(2, Math.floor(heightPixels / charHeight));

    if (DEBUG_RESIZE) {
      this._log.debug("resizeEmulatorToBox() calculated charWidth: ",charWidth);    
      this._log.debug("resizeEmulatorToBox() calculated charHeight: ",charHeight);
      this._log.debug("resizeEmulatorToBox() element width: ",width);
    }

    return {rows: newRows, columns: newCols};
  }

  pixelHeightToRows(pixelHeight: number): number {
    const result = this._computeTerminalSizeFromPixels(1024, pixelHeight);
    return result == null ? 2 : result.rows;
  }

  lineCount(): number {
    return this._isEmpty ? 0 : this._aceEditSession.getLength();
  }
  
  deleteScreen(): void {
    this._deleteScreen();
  }
  
  getCursorPosition(): CursorMoveDetail {
    const cursorPos = this._aceEditor.getCursorPositionScreen();
    const charHeight = this._aceEditor.renderer.charHeightPx;
    const charWidth = this._aceEditor.renderer.charWidthPx;

    const detail: CursorMoveDetail = {
      left: cursorPos.column * charWidth,
      top: cursorPos.row * charHeight,
      bottom: (cursorPos.row + 1) * charHeight,
      viewPortTop: this._aceEditSession.getScrollTopPx()
    };
    return detail;
  }

  clearSelection(): void {
    this._aceEditor.clearSelection();
  }
  
  setCursorPositionTop(ch: number): boolean {
    this._aceEditor.moveCursorTo(0, ch, false);
    return true;
  }
  
  setCursorPositionBottom(ch: number): boolean {
    this._aceEditor.moveCursorTo(this._aceEditSession.getLength()-1 , ch, false);
    return true;
  }

  /**
   * Delete the top n pixels from the scrollback.
   *
   * @param topLines the number of lines to be removed.
   */
  deleteTopLines(topLines: number): void {
    const linesToDelete = Math.min(topLines, this.lineCount());

    const pos: Position = { row: 0, column: 0 };
    const endPos: Position = { row: linesToDelete, column: 0 };
    this._aceEditor.replaceRange({start: pos, end: endPos}, "");

    this._terminalFirstRow -= linesToDelete;
    emitResizeEvent(this);
  }
  
  deleteLines(startLineOrBookmark: number | BookmarkRef, endLineOrBookmark?: number | BookmarkRef): void {
    let startLine = this._getLineNumberFromBookmark(startLineOrBookmark);
    
    let endLine = 0;
    if (endLineOrBookmark === undefined) {
      endLine = this.lineCount()-1;
    } else {
      endLine = this._getLineNumberFromBookmark(endLineOrBookmark);
    }
    
    if (startLine < 0 || endLine < 0) {
      this._log.warn(`Invalid arguments to deleteLines(). Resolved startLine=${startLine}, endLine=${endLine}.`);
      return;
    }
    
    this._deleteLines(startLine, endLine);
    emitResizeEvent(this);
  }

  getTerminalLinesToEnd(startLineOrBookmark: number | BookmarkRef): TermApi.Line[] {
    const startRow = this._getLineNumberFromBookmark(startLineOrBookmark);
    if (startRow < 0) {
      return null;
    }

    const result: TermApi.Line[] = [];
    const endRow = this.lineCount();
    for (let i = startRow; i < endRow; i++) {
      result.push(this._aceEditor.getTerminalLine(i));
    }

    return result;
  }

  setTerminalLines(lines: TermApi.Line[]): void {
    this._aceEditor.setTerminalLines(0, lines);
    this._isEmpty = false;
    emitResizeEvent(this);
  }

  bookmarkLine(lineNumber: number): BookmarkRef {
    const textBookmark = new Anchor(this._aceEditor.getSession().doc, lineNumber, 0);
    const bookmarkCounter = this._bookmarkCounter;
    this._bookmarkCounter++;
    
    const ref: BookmarkRef = {
      bookmarkRefId: bookmarkCounter,
      backupRow: 0,
    };
    this._bookmarkIndex.set(ref, textBookmark);
    
    return ref;
  }

  private __updateHasTerminalClass(): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    if (containerDiv != null) {
      if (this._emulator == null) {
        containerDiv.classList.remove(CLASS_HAS_TERMINAL);
      } else {
        containerDiv.classList.add(CLASS_HAS_TERMINAL);
      }
    }
  }

  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        
        /* The idea is that this rule will be quickly applied. We can then monitor
           the computed style to see when the proper theme font is applied and
           NO_STYLE_HACK disappears from the reported computed style. */
        .terminal {
          font-family: sans-serif, ${NO_STYLE_HACK};
        }
        
        ${getCssText()}
        </style>
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal ${CLASS_UNFOCUSED}"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  private _getCssVarsRules(): string {
    return `#${ID_CONTAINER} {
      ${this._getCssFontUnitSizeRule()}
}`;
  }

  private _getCssFontUnitSizeRule(): string {
    return `
  --terminal-font-unit-width: ${this._fontUnitWidth}px;
  --terminal-font-unit-height: ${this._fontUnitHeight}px;
`;
  }

  private _updateCssVars():  void {
    this._fontUnitWidth = this._aceEditor.renderer.layerConfig.charWidthPx;
    this._fontUnitHeight = this._aceEditor.renderer.layerConfig.charHeightPx;
    const styleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);
    styleElement.textContent = this._getCssVarsRules();
  }

  private _enterCursorMode(): void {
    const containerDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.remove(CLASS_HIDE_CURSOR);

    this._aceEditor.clearSelection();
    if (this._emulator !== null) {
      const dimensions = this._emulator.getDimensions();
      this._aceEditor.selection.moveCursorToPosition(
        { row: dimensions.cursorY + this._terminalFirstRow, column: dimensions.cursorX });

    } else {
      this._aceEditor.selection.moveCursorToPosition({ row: this._aceEditSession.getLength()-1, column: 0 });
    }
    if (this._editable) {
      if ( ! this._aceHasUndoManager) {
        this._aceEditSession.setUndoManager(new UndoManager());
        this._aceHasUndoManager = true;
      }

      this._aceEditor.setReadOnly(false);
    } else {
      this._aceEditor.setRelayInput(false);
    }
  }

  private _exitCursorMode(): void {
    if (this._aceEditor == null) {
      return;
    }
    
    this._aceEditor.setReadOnly(true);
    this._aceEditor.setRelayInput(this._emulator != null);

    const containerDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.add(CLASS_HIDE_CURSOR);
  }
  
  private _emitKeyboardActivityEvent(): void {
    const event = new CustomEvent(TerminalViewer.EVENT_KEYBOARD_ACTIVITY, { bubbles: true });
    this.dispatchEvent(event);
  }

  private _emitBeforeSelectionChangeEvent(originMouse: boolean): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { detail: { originMouse: originMouse },
      bubbles: true });
    this.dispatchEvent(event);
  }

  private _getLineNumberFromBookmark(lineOrBookmark: number | BookmarkRef): number {
    if (typeof lineOrBookmark === 'number') {
      return lineOrBookmark;
    } else {
      const anchor = this._bookmarkIndex.get(lineOrBookmark);
      if (anchor === undefined) {
        return -1;
      }
      const position = anchor.getPosition();
      return position.row;
    }
  }

  scrollTo(optionsOrX: ScrollToOptions | number, y?: number): void {
    if (this._aceEditSession == null) {
      return;
    }
    
    let xCoord = 0;
    let yCoord = 0;

    if (typeof optionsOrX === "number") {
      xCoord = optionsOrX;
      if (y !== undefined) {
        yCoord = y;
      }
    } else {
      xCoord = optionsOrX.left;
      yCoord = optionsOrX.top;
    }

    this._aceEditSession.setScrollLeftPx(xCoord);
    this._aceEditSession.setScrollTopPx(yCoord);
  }
  
  private _handleEmulatorMouseEvent(ev: MouseEvent, emulatorHandler: (opts: TermApi.MouseEventOptions) => boolean): boolean {
    // Ctrl click prevents the mouse being taken over by
    // the application and allows the user to select stuff.
    if (ev.ctrlKey) { 
      return false;
    }
    const pos = this._aceEditor.renderer.screenToTextCoordinates(ev.clientX, ev.clientY);
    if (pos === null) {
      return false;
    }
    if (pos.row - this._terminalFirstRow < 0) {
      // Don't send mouse events for stuff which happens in the scrollback area.
      return false;
    }

    // send the buttons
    const options: TermApi.MouseEventOptions = {
      leftButton: (ev.buttons & 1) !== 0,
      middleButton: (ev.buttons & 4) !== 0,
      rightButton: (ev.buttons & 2) !== 0,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.row - this._terminalFirstRow,
      column: pos.column
    };
    
    if (emulatorHandler(options)) {
      // The emulator consumed the event. Stop Ace from processing it too.
      ev.stopPropagation();
      ev.preventDefault();
      return true;
    }
    return false;
  }
  
  private _handleMouseDownEvent(ev: MouseEvent): void {
    const isRightMouseButton = (ev.buttons & 2) !== 0;
    if (isRightMouseButton) {
      ev.preventDefault();
      ev.stopPropagation();
    }

    if (this._emulator === null) {
      return;
    }
    if ( ! this.hasFocus()) {
      this.focus();
    }
    if (this._handleEmulatorMouseEvent(ev, this._emulator.mouseDown.bind(this._emulator))) {
      return;
    }

    if (isRightMouseButton) {
      this._handleContextMenu(ev);
    }
  }
  
  private _handleMouseUpEvent(ev: MouseEvent): void {
    const isRightMouseButton = (ev.buttons & 2) !== 0;
    if (isRightMouseButton) {
      ev.preventDefault();
      ev.stopPropagation();
    }

    if (this._emulator === null) {
      return;
    }
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseUp.bind(this._emulator));
  }
  
  private _handleMouseMoveEvent(ev: MouseEvent): void {
    if (this._emulator === null) {
      return;
    }
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseMove.bind(this._emulator));
  }

  private _handleMouseWheelEvent(ev: WheelEvent): void {
    ev.stopPropagation();
    ev.preventDefault();

    if (this._processMouseWheelEvent(ev)) {
      return;
    }

    const syntheticWheelEventDetail = {
      "deltaX": ev.deltaX,
      "deltaY": ev.deltaY,
      "deltaZ": ev.deltaZ,
      "deltaMode": ev.deltaMode
    };

    // Send a synthetic-wheel event. This is needed so that we can get the wheel event info
    // to TerminalCanvas above this element but without allowing the real wheel event from
    // touching the Ace instance. If the Ace instance gets the wheel event it will scroll
    // and screw up the display, but at the same time when we cancel the wheel event it
    // stops it from reaching TerminalCanvas. The work around is this custom event.
    window.queueMicrotask( () => {
      const syntheticWheelEvent = new CustomEvent("synthetic-wheel",
        { bubbles: true, detail: syntheticWheelEventDetail });
      this.dispatchEvent(syntheticWheelEvent);
    });
  }

  // Returns true if wheel event was consumed by the emulator.
  private _processMouseWheelEvent(ev: WheelEvent): boolean {
    // Stop Ace from processing this even by itself.
    ev.stopPropagation();
    ev.preventDefault();

    if (this._emulator === null) {
      return false;
    }

    if (ev.ctrlKey) { 
      return false;
    }
    const pos = this._aceEditor.renderer.screenToTextCoordinates(ev.clientX, ev.clientY);
    if (pos === null) {
      return false;
    }
    if (pos.row - this._terminalFirstRow < 0) {
      // Don't send mouse events for stuff which happens in the scrollback area.
      return false;
    }

    // send the buttons
    const options: TermApi.MouseEventOptions = {
      leftButton: false,
      middleButton: false,
      rightButton: false,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.row - this._terminalFirstRow,
      column: pos.column
    };

    return ev.deltaY < 0 ? this._emulator.mouseWheelUp(options) : this._emulator.mouseWheelDown(options);
  }

  executeAceCommand(command: string): void {
    const aceCommand = this._aceEditor.commands.getCommandByName(command);
    if (aceCommand == null) {
      this._log.warn(`executeAceCommand() couldn't find Ace command '${command}'.`);
      return;
    }
    this._aceEditor.commands.exec(aceCommand, this._aceEditor);
  }
  
  private _handleContainerKeyDownCapture(ev: KeyboardEvent): void {
    if (this._mode === Mode.DEFAULT) {
      if (this._emulator !== null && this._emulator.keyDown(ev)) {
        ev.stopPropagation();
        this._emitKeyboardActivityEvent();
        return;
      }
    }
  }

  private _handleContextMenu(ev: MouseEvent): void {
    // Prevent Ace from seeing this event and messing with the hidden textarea and the focus.
    ev.stopImmediatePropagation();
    ev.preventDefault();
    dispatchContextMenuRequest(this, ev.clientX, ev.clientY);
  }
  
  private _handleRenderEvent(instance: Term.Emulator, event: TermApi.RenderEvent): void {
    const sizeResized = this._handleSizeEvent(event.rows, event.columns, event.realizedRows);
    const refreshResized = this._refreshScreen(event.refreshStartRow, event.refreshEndRow);
    const scrollbackResized = this._insertScrollbackLines(event.scrollbackLines);
    if (sizeResized || refreshResized || scrollbackResized) {
      emitResizeEvent(this);
    }

    this._cursorRow = event.cursorRow;
    this._cursorColumn = event.cursorColumn;
  }

  private _onCompositionStart(): void {
    if (this._mode == Mode.DEFAULT) {
      this._aceEditor.selection.setSelectionRange({
        start: {row: this._cursorRow + this._terminalFirstRow, column: this._cursorColumn},
        end: {row: this._cursorRow + this._terminalFirstRow, column: this._cursorColumn}
      });
    }
  }

  private _handleSizeEvent(newRows: number, newColumns: number, realizedRows: number): boolean {
    const lineCount = this._aceEditSession.getLength();
    const currentRealizedRows = lineCount - this._terminalFirstRow;
    if (this._rows === newRows && this._columns === newColumns && currentRealizedRows <= realizedRows) {
      return false; // Nothing to do.
    }
    
    if (currentRealizedRows > realizedRows) {
      // Trim off the extra lines.
      const startPos = this._terminalFirstRow + realizedRows === 0
        ? { row: this._terminalFirstRow + realizedRows, column: 0 }
        : { row: this._terminalFirstRow + realizedRows -1, column: this._aceEditSession.getLine(this._terminalFirstRow + realizedRows-1).length };
      const endPos = { row: lineCount-1, column: this._aceEditSession.getLine(lineCount-1).length };
      this._aceEditSession.replace({start: startPos, end: endPos}, "");

      this._realizedRows = realizedRows;
    }
    
    this._rows = newRows;
    this._columns = newColumns;
    return true;
  }

  /**
   * @returns true if a resize has occurred
   */
  private _refreshScreen(refreshStartRow: number, refreshEndRow: number): boolean {
    if (refreshStartRow === -1) {
      return false;
    }

    let emitVirtualResizeEventFlag = false;

    const endRow = refreshEndRow;
    const lines: TermApi.Line[] = [];
    for (let row = refreshStartRow; row < endRow; row++) {
      lines.push(this._emulator.lineAtRow(row));
    }

    this._saveBookmarks();
    this._insertLinesOnScreen(refreshStartRow, endRow, lines);
    this._restoreBookmarks();
    
    // Update our realised rows var if needed.
    const lineCount = this._aceEditSession.getLength();
    const currentRealizedRows = lineCount - this._terminalFirstRow;
    if (currentRealizedRows !== this._realizedRows) {
      this._realizedRows = currentRealizedRows;
      emitVirtualResizeEventFlag = true;
    }
    return emitVirtualResizeEventFlag;
  }

  /**
   * @returns true if a resize has occurred
   */
  private _insertScrollbackLines(scrollbackLines: TermApi.Line[]): boolean {
    if (scrollbackLines == null || scrollbackLines.length === 0) {
      return false;
    }

    this._saveBookmarks();
    this._aceEditSession.insertTerminalLines(this._terminalFirstRow, scrollbackLines);
    this._restoreBookmarks();

    this._terminalFirstRow = this._terminalFirstRow  + scrollbackLines.length;
    return true;
  }

  private _saveBookmarks(): void {
    for (const [bookmarkRef, anchor] of this._bookmarkIndex) {
      const pos = anchor.getPosition();
      bookmarkRef.backupRow = pos.row;
    }
  }

  private _restoreBookmarks(): void {
    for (const [bookmarkRef, anchor] of this._bookmarkIndex) {
      const pos = anchor.getPosition();
      anchor.setPosition(bookmarkRef.backupRow, pos.column);
    }
  }

  private _insertLinesOnScreen(startRow: number, endRow: number, lines: TermApi.Line[]): void {
    const lineCount = this._aceEditSession.getLength();

    // Mark sure there are enough rows inside Ace.
    if (lineCount < endRow + this._terminalFirstRow) {
      const pos = { row: this._terminalFirstRow + lineCount, column: 0 };
      
      let emptyText = "";
      const extraCrCount = endRow + this._terminalFirstRow - lineCount;
      for (let j = 0; j < extraCrCount; j++) {
        emptyText += "\n";
      }
      this._aceEditSession.insert(pos, emptyText);
    }

    this._aceEditor.setTerminalLines(startRow + this._terminalFirstRow, lines);
    this._isEmpty = false;
  }
  
  private _deleteScreen(): void {
    this._realizedRows = -1;
    if (this._isEmpty) {
      return;
    }
    
    const lineCount = this._aceEditSession.getLength();
    this._deleteLines(this._terminalFirstRow, lineCount-1);
  }
  
  /**
   * Deletes the given inclusive range of lines.
   * 
   * @param {number} startLine [description]
   * @param {number} endLine   [description]
   */
  private _deleteLines(startLine: number, endLine: number): void {
    const lineCount = this._aceEditSession.getLength();
    const doc = this._aceEditSession.getDocument();
    const endPos = { row: endLine, column: doc.getLine(endLine).length };

    if (startLine === 0) {
      const startPos = { row: startLine, column: 0 };
      this._aceEditSession.replace({start: startPos, end: endPos}, "")
      this._isEmpty = lineCount-1 === endLine;
    } else {
      // Start deleting from the end of the row before the top of the terminal.
      const startPos = { row: startLine-1, column: doc.getLine(startLine-1).length };
      doc.replace({start: startPos, end: endPos}, "");
    }
  }
  
  private getVirtualTextHeight(): number {
    return this._isEmpty ? 0 : this._aceEditor.renderer.layerConfig.charHeightPx * this.lineCount();
  }
  
  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || this._aceEditor == null) {
      return;
    }

    const elementHeight = this.getHeight();
    let aceEditorHeight: number;
    if (this._useVPad) {
      // Adjust the height of the Ace editor such that a small gap is at the bottom to 'push'
      // the lines up and align them with the top of the viewport.
      aceEditorHeight = elementHeight - (elementHeight % this._aceEditor.renderer.layerConfig.charHeightPx);
    } else {
      aceEditorHeight = elementHeight;        
    }
    const reserveHeight = this.getReserveViewportHeight(elementHeight);

    this.style.height = "" + elementHeight + "px";

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.style.height = "" + (aceEditorHeight-reserveHeight) + "px";
    this._aceEditor.resize(false);
    containerDiv.style.height = "" + aceEditorHeight + "px";
  }
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}

// Expand the list of character to be considered part of words, i.e. when double clipping.
class TextModeWithWordSelect extends TextMode {
  tokenRe = XRegExp("^[\\p{L}\\p{Mn}\\p{Mc}\\p{Nd}\\p{Pc}\\$_@~?&=%#/:\\\\.-]+", "g");
  nonTokenRe = XRegExp("^(?:[^\\p{L}\\p{Mn}\\p{Mc}\\p{Nd}\\p{Pc}\\$_@~?&=%#/:\\\\.-]|\\s])+", "g");
}

function cssHexColorToRGBA(cssColor: string): number {
  const color = new Color(cssColor);
  return color.toRGBA();
}
