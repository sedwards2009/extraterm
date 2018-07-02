/**
 * Copyright 2015-2018 Simon Edwards <simon@simonzone.com>
 */

import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import {WebComponent} from 'extraterm-web-component-decorators';
import {BulkFileHandle, ViewerMetadata, ViewerPosture} from 'extraterm-extension-api';

import {BlobBulkFileHandle} from '../bulk_file_handling/BlobBulkFileHandle';
import {Commandable, CommandEntry, COMMAND_OPEN_COMMAND_PALETTE, dispatchCommandPaletteRequest}
from '../CommandPaletteRequestTypes';
import {doLater, doLaterFrame, DebouncedDoLater} from '../../utils/DoLater';
import * as DomUtils from '../DomUtils';
import { ExtraEditCommands } from './ExtraAceEditCommands';
import * as GeneralEvents from '../GeneralEvents';
import * as keybindingmanager from '../keybindings/KeyBindingsManager';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as SourceDir from '../../SourceDir';
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';
import * as Term from '../emulator/Term';
import * as TermApi from 'term-api';
import { BookmarkRef } from './TerminalViewerTypes';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as Util from '../gui/Util';
import {ViewerElement} from './ViewerElement';
import * as ViewerElementTypes from './ViewerElementTypes';
import * as VirtualScrollArea from '../VirtualScrollArea';
import { Disposable } from 'extraterm-extension-api';

import { TerminalAceEditor, TerminalDocument, TerminalEditSession, TerminalRenderer } from "extraterm-ace-terminal-renderer";
import { Anchor, Command, DefaultCommands, Editor, MultiSelectCommands, Renderer, Position, UndoManager } from "ace-ts";


type KeyBindingManager = keybindingmanager.KeyBindingsManager;

type SetterState = VirtualScrollArea.SetterState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;
const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;

const ID = "EtTerminalAceViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const ID_CSS_VARS = "ID_CSS_VARS";
const CLASS_HIDE_CURSOR = "hide-cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";
const CLASS_HAS_TERMINAL = "CLASS_HAS_TERMINAL";

const OVERSIZE_CLASS_LIST = ["oversize"];

const KEYBINDINGS_TERMINAL_VIEWER = "terminal-viewer";
const PALETTE_GROUP = "terminalviewer";
const COMMAND_TYPE_AND_CR_SELECTION = "typeSelectionAndCr";
const COMMAND_TYPE_SELECTION = "typeSelection";

const NO_STYLE_HACK = "NO_STYLE_HACK";

const DEBUG_RESIZE = false;

let classInitialized = false;
let cssText: string = null;

function getCssText(): string {
  return cssText;
}


@WebComponent({tag: "et-terminal-ace-viewer"})
export class TerminalViewer extends ViewerElement implements Commandable, keybindingmanager.AcceptsKeyBindingsManager,
    SupportsClipboardPaste.SupportsClipboardPaste, Disposable {

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
  private _keyBindingManager: KeyBindingManager = null;
  private _emulator: Term.Emulator = null;

  // The line number of the top row of the emulator screen (i.e. after the scrollback  part).
  private _terminalFirstRow = 0;
  private _metadataEventDoLater: DebouncedDoLater = null;
  private _commandLine: string = null;
  private _returnCode: string = null;

  private _aceEditor: TerminalAceEditor = null;
  private _aceEditSession: TerminalEditSession = null;
  private _height = 0;
  private _isEmpty = true;
  private _mode: ViewerElementTypes.Mode = ViewerElementTypes.Mode.DEFAULT;
  private _editable = false;
  private _useVPad = true;
  private _visualState: VisualState = VisualState.AUTO;

  private _mainStyleLoaded: boolean = false;
  private _resizePollHandle: Disposable = null;
  private _needEmulatorResize: boolean = false;
  
  private _operationRunning = false; // True if we are currently running an operation with the operation() method.
  private _operationEmitResize = false;  // True if a resize evnet shuld be emitted once the operation is finished.
  
  // Emulator dimensions
  private _rows = -1;
  private _columns = -1;
  private _realizedRows = -1;

  private _documentHeightRows= -1;  // Used to detect changes in the viewport size when in Cursor mode.
  private _fontUnitWidth = 10;  // slightly bogus defaults
  private _fontUnitHeight = 10;

  // The current element height. This is a cached value used to prevent touching the DOM.  
  private _currentElementHeight = -1;
  private _currentVPad = true;
  private _renderEventListener: TermApi.RenderEventHandler = this._handleRenderEvent.bind(this);

  private _bookmarkCounter = 0;
  private _bookmarkIndex = new Map<BookmarkRef, Anchor>();

  constructor() {
    super();
    this._log = getLogger(TerminalViewer.TAG_NAME, this);
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
      
      this._initFontLoading();
      this.installThemeCss();

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

      this.style.height = "0px";
      this._exitCursorMode();
      this._mode = ViewerElementTypes.Mode.DEFAULT;

      this._aceEditSession = new TerminalEditSession(new TerminalDocument(""));
      this._aceEditSession.setUndoManager(new UndoManager());

      const aceRenderer = new TerminalRenderer(containerDiv);
      aceRenderer.setShowGutter(false);
      aceRenderer.setShowLineNumbers(false);

      this._aceEditor = new TerminalAceEditor(aceRenderer, this._aceEditSession);
      this._aceEditor.setReadOnly(true);

      this.__addCommands(DefaultCommands);
      this.__addCommands(MultiSelectCommands);
      this.__addCommands(ExtraEditCommands);

      this.__updateHasTerminalClass();

      this._aceEditor.on("change", (data, editor) => {
        if (this._mode !== ViewerElementTypes.Mode.CURSOR) {
          return;
        }
        
        const heightRows = this._aceEditSession.getLength();
        if (heightRows !== this._documentHeightRows) {
          this._documentHeightRows = heightRows;
          doLater( () => {
            VirtualScrollArea.emitResizeEvent(this);
          });
        }
      });

      this._aceEditor.selection.on("changeCursor", () => {
        const effectiveFocus = this._visualState === ViewerElementTypes.VisualState.FOCUSED ||
                                (this._visualState === ViewerElementTypes.VisualState.AUTO && this.hasFocus());
        if (this._mode !== ViewerElementTypes.Mode.DEFAULT && effectiveFocus) {
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
      
      this._aceEditor.on("changeSelection", () => {
        this._emitBeforeSelectionChangeEvent(true);
      });

      this._aceEditor.onCursorTopHit((column: number) => {
        this._emitCursorEdgeEvent(ViewerElementTypes.Edge.TOP, column);
      });

      this._aceEditor.onCursorBottomHit((column: number) => {
        this._emitCursorEdgeEvent(ViewerElementTypes.Edge.BOTTOM, column);
      });
      
      // Filter the keyboard events before they reach Ace.
      containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
      containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
      containerDiv.addEventListener('keypress', this._handleContainerKeyPressCapture.bind(this), true);
      containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
      containerDiv.addEventListener('contextmenu', this._handleContextMenuCapture.bind(this), true);

      const aceElement = this._aceEditor.renderer.scroller;
      aceElement.addEventListener("mousedown", this._handleMouseDownEvent.bind(this), true);
      aceElement.addEventListener("mouseup", this._handleMouseUpEvent.bind(this), true);
      aceElement.addEventListener("mousemove", this._handleMouseMoveEvent.bind(this), true);
    }

    this._updateCssVars();
    
    if (this._needEmulatorResize) {
      this._needEmulatorResize = false;
      this._resizePoll();
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL_VIEWER];
  }

  private _emitCursorEdgeEvent(edge: ViewerElementTypes.Edge, column: number): void {
    doLater( () => {
      const detail: ViewerElementTypes.CursorEdgeDetail = { edge, ch: column };
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

  setKeyBindingsManager(newKeyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = newKeyBindingManager;
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
    return this._aceEditor.getSelectedText();
  }

  // From SupportsClipboardPaste interface.
  canPaste(): boolean {
    return this._mode === ViewerElementTypes.Mode.CURSOR;
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

  setVisualState(newVisualState: VisualState): void {
    if (newVisualState !== this._visualState) {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      if (containerDiv !== null) {
        if ((newVisualState === VisualState.AUTO && this.hasFocus()) ||
            newVisualState === VisualState.FOCUSED) {

          containerDiv.classList.add(CLASS_FOCUSED);
          containerDiv.classList.remove(CLASS_UNFOCUSED);
        } else {
          containerDiv.classList.add(CLASS_UNFOCUSED);
          containerDiv.classList.remove(CLASS_FOCUSED);
        }
      }
      this._visualState = newVisualState;
    }
  }
  
  getVisualState(): VisualState {
    return this._visualState;
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
  
  setMode(newMode: ViewerElementTypes.Mode): void {
    if (newMode !== this._mode) {
      switch (newMode) {
        case ViewerElementTypes.Mode.CURSOR:
          // Enter cursor mode.
          this._enterCursorMode();
          break;
          
        case ViewerElementTypes.Mode.DEFAULT:
          this._exitCursorMode();
          break;
      }
      this._mode = newMode;
    }
  }
  
  getMode(): ViewerElementTypes.Mode {
    return this._mode;
  }
  
  setEditable(editable: boolean): void {
    this._editable = editable;
    if (this._mode === ViewerElementTypes.Mode.CURSOR) {
      this._aceEditor.setReadOnly(! editable);
    }
  }
  
  getEditable(): boolean {
    return this._editable;
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
    const textHeight = this.getVirtualTextHeight();
    if (this._useVPad) {
      const defaultTextHeight = this._aceEditor.renderer.lineHeight;
      const vPad = containerHeight % defaultTextHeight;
      if (DEBUG_RESIZE) {
        this._log.debug("getReserveViewportHeight: ", vPad);
      }
      return vPad;
    } else {
      if (DEBUG_RESIZE) {
        this._log.debug("getReserveViewportHeight: ", 0);
      }
      return 0;
    }
  }

  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    if (this._aceEditSession !== null) {
      if (DEBUG_RESIZE) {
        this._log.debug("calling aceEditor.resize()");
      }

      if (level === ResizeRefreshElementBase.RefreshLevel.RESIZE) {
        this._aceEditor.resize(false);
      } else {
        this._aceEditor.updateFontSize();
        this._aceEditor.resize(true);
      }
    }

    VirtualScrollArea.emitResizeEvent(this);
    this.resizeEmulatorToParentContainer();
  }

  resizeEmulatorToParentContainer(): void {
    if (DEBUG_RESIZE) {
      this._log.debug("resizeEmulatorToParentContainer: ", this._emulator === null ? "(no emulator)" : "(have emulator)");
    }
    if (this._emulator !== null) {
      let viewportElement = this.parentElement;
      while (window.getComputedStyle(viewportElement).position === 'absolute') {
        viewportElement = viewportElement.parentElement;
      }
      this.resizeEmulatorToBox(this.clientWidth, viewportElement.clientHeight);
    }
    this._updateCssVars();
  }

  /**
   * Resize the terminal to fill a given pixel box size.
   * 
   * @returns Object with the new colums (cols field) and rows (rows field) information.
   */
  resizeEmulatorToBox(widthPixels: number, heightPixels: number): {cols: number; rows: number;} {
    const {columns: cols, rows: rows} = this.getEmulator().size();
    
    if (DEBUG_RESIZE) {
      this._log.debug("resizeEmulatorToBox() this.effectiveFontFamily(): " + this._effectiveFontFamily());
      this._log.debug("resizeEmulatorToBox() heightPixels: " + heightPixels);
    }
    
    if ( ! this.isFontLoaded()) {
      // Styles have not been applied yet.
      if (DEBUG_RESIZE) {
        this._log.debug("resizeEmulatorToBox() styles have not been applied yet.");
      }
      return {cols: cols, rows: rows};
    }
    
    const charHeight = this._aceEditor.renderer.lineHeight;
    const charWidth = this._aceEditor.renderer.characterWidth;
    const computedStyle = window.getComputedStyle(this);
    const width = widthPixels - px(computedStyle.marginLeft) - px(computedStyle.marginRight) - 4;
    const newCols = Math.floor(width / charWidth);
    const newRows = Math.max(2, Math.floor(heightPixels / charHeight));
    
    if (newCols !== cols || newRows !== rows) {
      this.getEmulator().resize( { rows: newRows, columns: newCols } );
    }
    
    if (DEBUG_RESIZE) {
      this._log.debug("resizeEmulatorToBox() old cols: ",cols);
      this._log.debug("resizeEmulatorToBox() calculated charWidth: ",charWidth);    
      this._log.debug("resizeEmulatorToBox() calculated charHeight: ",charHeight);
      this._log.debug("resizeEmulatorToBox() element width: ",width);
      // this._log.debug("resizeEmulatorToBox() element height: ",this.element.clientHeight);
      this._log.debug("resizeEmulatorToBox() new cols: ",newCols);
      this._log.debug("resizeEmulatorToBox() new rows: ",newRows);
    }
    return {cols: newCols, rows: newRows};
  }

  private __applyRoundingErrorCompensation(width: number): number {
    return Math.floor(width) !== width ? width * (1.005): width;
  }
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  lineCount(): number {
    return this._isEmpty ? 0 : this._aceEditSession.getLength();
  }
  
  deleteScreen(): void {
    this._deleteScreen();
  }
  
  getCursorPosition(): CursorMoveDetail {
    const cursorPos = this._aceEditor.getCursorPositionScreen();
    const charHeight = this._aceEditor.renderer.lineHeight;
    const charWidth = this._aceEditor.renderer.characterWidth;

    const detail: CursorMoveDetail = {
      left: cursorPos.column * charWidth,
      top: cursorPos.row * charHeight,
      bottom: (cursorPos.row + 1) * charHeight,
      viewPortTop: this._aceEditSession.getScrollTop()
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
    VirtualScrollArea.emitResizeEvent(this);
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
    VirtualScrollArea.emitResizeEvent(this);
  }

  getTerminalLines(startLineOrBookmark: number | BookmarkRef): TermApi.Line[] {
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
    for (let i=0; i<lines.length; i++) {
      this._aceEditor.setTerminalLine(i, lines[i]);
    }
    this._isEmpty = false;
    VirtualScrollArea.emitResizeEvent(this);
  }

  bookmarkLine(lineNumber: number): BookmarkRef {
    const textBookmark = new Anchor(this._aceEditor.getSession().doc, lineNumber, 0);
    const bookmarkCounter = this._bookmarkCounter;
    this._bookmarkCounter++;
    
    const ref: BookmarkRef = {
      bookmarkRefId: bookmarkCounter
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
    this._fontUnitWidth = this._aceEditor.renderer.characterWidth;
    this._fontUnitHeight = this._aceEditor.renderer.lineHeight;
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
      this._aceEditor.setReadOnly(false);
    }
  }

  private _exitCursorMode(): void {
    if (this._aceEditor !== null) {
      this._aceEditor.setReadOnly(true);
    }

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

    this._aceEditSession.setScrollLeft(xCoord);
    this._aceEditSession.setScrollTop(yCoord);
  }
  
  private _handleEmulatorMouseEvent(ev: MouseEvent, emulatorHandler: (opts: TermApi.MouseEventOptions) => void): void {
    // Ctrl click prevents the mouse being taken over by
    // the application and allows the user to select stuff.
    if (ev.ctrlKey) { 
      return;
    }
    const pos = this._aceEditor.renderer.screenToTextCoordinates(ev.clientX, ev.clientY);
    if (pos === null) {
      return;
    }

    // FIXME use the 'buttons' API.
    const button = ev.button !== undefined ? ev.button : (ev.which !== undefined ? ev.which - 1 : null);

    // send the button
    const options: TermApi.MouseEventOptions = {
      leftButton: button === 0,
      middleButton: button === 1,
      rightButton: button === 2,
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
    }
  }
  
  private _handleMouseDownEvent(ev: MouseEvent): void {
    if (this._emulator === null) {
      return;
    }
    if ( ! this.hasFocus()) {
      this.focus();
    }
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseDown.bind(this._emulator));
  }
  
  private _handleMouseUpEvent(ev: MouseEvent): void {
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

  private _handleContainerKeyPressCapture(ev: KeyboardEvent): void {
    if (this._keyBindingManager == null || this._keyBindingManager.getKeyBindingsContexts() == null) {
      return;
    }

    const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_TERMINAL_VIEWER);
    if (keyBindings !== null) {
      const command = keyBindings.mapEventToCommand(ev);
      if (command != null) {
        ev.stopPropagation();
        return;
      }
    }

    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
      if (this._emulator !== null) {
        this._emulator.keyPress(ev);
      }
      this._emitKeyboardActivityEvent();
    }
  }
  
  private _handleContainerKeyDown(ev: KeyboardEvent): void {
    if (this._mode !== ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
    }
  }

  private _handleContainerKeyDownCapture(ev: KeyboardEvent): void {
    let command: string = null;
    
    if (this._keyBindingManager !== null && this._keyBindingManager.getKeyBindingsContexts() !== null) {
      const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_TERMINAL_VIEWER);
      if (keyBindings !== null) {
        command = keyBindings.mapEventToCommand(ev);
this._log.debug(`Got command ${command}`);        
        if (this._executeCommand(command)) {
          ev.stopPropagation();
          ev.preventDefault();
          return;
        } else {
          if (this._mode === ViewerElementTypes.Mode.CURSOR) {
            if (command == null) {
              return;
            }
            const aceCommand = this._aceEditor.commands.getCommandByName(command);
            if (aceCommand != null) {
              this._aceEditor.commands.exec(aceCommand, this._aceEditor);
              ev.stopPropagation();
              ev.preventDefault();
              return;
            } else {
              this._log.warn(`Unable to find command '${command}'.`);
            }
          }
        }
      }
    }
    
    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
      if (this._emulator !== null && this._emulator.keyDown(ev)) {
        this._emitKeyboardActivityEvent();
      }
    }
  }

  private _handleContainerKeyUpCapture(ev: KeyboardEvent): void {
    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
      ev.preventDefault();
    }      
  }

  private _handleContextMenuCapture(ev: MouseEvent): void {
    // Prevent Ace from seeing this event and messing with the hidden textarea and the focus.
    ev.stopImmediatePropagation();
    ev.preventDefault();

    this.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
  }

  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
    let commandList: CommandEntry[] = [
      { id: COMMAND_TYPE_SELECTION, group: PALETTE_GROUP, iconRight: "fa fa-terminal", label: "Type Selection", commandExecutor: this },
      { id: COMMAND_TYPE_AND_CR_SELECTION, group: PALETTE_GROUP, iconRight: "fa fa-terminal", label: "Type Selection & Execute", commandExecutor: this }
    ];
    
    const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_TERMINAL_VIEWER);
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
  
  private _executeCommand(command): boolean {
    switch (command) {
      case COMMAND_TYPE_AND_CR_SELECTION:
      case COMMAND_TYPE_SELECTION:
        const text = this._aceEditor.getSelectedText();
        if (text !== "") {
          if (command === COMMAND_TYPE_AND_CR_SELECTION) {
            // Exit selection mode.
            const setModeDetail: GeneralEvents.SetModeEventDetail = { mode: ViewerElementTypes.Mode.DEFAULT };
            const setModeEvent = new CustomEvent(GeneralEvents.EVENT_SET_MODE, { detail: setModeDetail });
            setModeEvent.initCustomEvent(GeneralEvents.EVENT_SET_MODE, true, true, setModeDetail);
            this.dispatchEvent(setModeEvent);
          }              
          const typeTextDetail: GeneralEvents.TypeTextEventDetail =
                                  { text: text + (command === COMMAND_TYPE_AND_CR_SELECTION ? "\n" : "") };
          const typeTextEvent = new CustomEvent(GeneralEvents.EVENT_TYPE_TEXT, { detail: typeTextDetail });
          typeTextEvent.initCustomEvent(GeneralEvents.EVENT_TYPE_TEXT, true, true, typeTextDetail);
          this.dispatchEvent(typeTextEvent);
        }            
        break;
        
      case COMMAND_OPEN_COMMAND_PALETTE:
        dispatchCommandPaletteRequest(this);
        break;
        
      default:
        return false;
    }
    return true;
  }
  
  //-----------------------------------------------------------------------
  //
  // #######                        #                                            
  // #        ####  #    # #####    #        ####    ##   #####  # #    #  ####  
  // #       #    # ##   #   #      #       #    #  #  #  #    # # ##   # #    # 
  // #####   #    # # #  #   #      #       #    # #    # #    # # # #  # #      
  // #       #    # #  # #   #      #       #    # ###### #    # # #  # # #  ### 
  // #       #    # #   ##   #      #       #    # #    # #    # # #   ## #    # 
  // #        ####  #    #   #      #######  ####  #    # #####  # #    #  ####  
  //
  //-----------------------------------------------------------------------

  private _initFontLoading(): void {
    this._mainStyleLoaded = false;
    
    DomUtils.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
      this._mainStyleLoaded = true;
      this._handleStyleLoad();
    });
  }
  
  private _cleanUpFontLoading(): void {
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.dispose();
      this._resizePollHandle = null;
    }
  }

  private _handleStyleLoad(): void {
    if (this._mainStyleLoaded) {
      // Start polling the term for application of the font.
      this._resizePollHandle = doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  private _effectiveFontFamily(): string {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    const cs = window.getComputedStyle(containerDiv, null);
    return cs.getPropertyValue("font-family");
  }

  private _resizePoll(): void {
    // if (this._mainStyleLoaded) {  // FIXME this font loading stuff needs to be replaced with resize canary.
    //   if ( ! this.isFontLoaded()) {
    //     // Font has not been correctly applied yet.
    //     this._resizePollHandle = doLaterFrame(this._resizePoll.bind(this));
    //   } else {
    //     // Yay! the font is correct. Resize the term soon.
    //     this._codeMirror.defaultTextHeight(); // tickle the DOM to maybe force CSS recalc.

    //     if (this.parentElement == null) {
    //       this._needEmulatorResize = true;  // Do it later.
    //     } else {
    //       window.setTimeout(() => {
    //         if (this.parentElement == null) {
    //           this._needEmulatorResize = true;  // Do it later.
    //         } else {
    //           this.resizeEmulatorToParentContainer();
    //         }
    //       }, 100);  // 100ms
    //     }
    //   }
    // }
  }
  
  //-----------------------------------------------------------------------
  //
  // ######                                     
  // #     # ###### #    # #####  ###### #####  
  // #     # #      ##   # #    # #      #    # 
  // ######  #####  # #  # #    # #####  #    # 
  // #   #   #      #  # # #    # #      #####  
  // #    #  #      #   ## #    # #      #   #  
  // #     # ###### #    # #####  ###### #    # 
  //                                            
  //-----------------------------------------------------------------------
  private _handleRenderEvent(instance: Term.Emulator, event: TermApi.RenderEvent): void {
    let emitVirtualResizeEventFlag = false;
    
    const op = () => {
      emitVirtualResizeEventFlag = this._handleSizeEvent(event.rows, event.columns, event.realizedRows);

      // Refresh the active part of the screen.
      const startRow = event.refreshStartRow;
      if (startRow !== -1) {
        const endRow = event.refreshEndRow;
        const lines: TermApi.Line[] = [];
        for (let row = startRow; row < endRow; row++) {
          lines.push(this._emulator.lineAtRow(row));
        }
        this._insertLinesOnScreen(startRow, endRow, lines);
        
        // Update our realised rows var if needed.
        const lineCount = this._aceEditSession.getLength();
        const currentRealizedRows = lineCount - this._terminalFirstRow;
        if (currentRealizedRows !== this._realizedRows) {
          this._realizedRows = currentRealizedRows;
          emitVirtualResizeEventFlag = true;
        }
      }
      
      if (event.scrollbackLines !== null && event.scrollbackLines.length !== 0) {
        this._handleScrollbackEvent(event.scrollbackLines);
        emitVirtualResizeEventFlag = true;
      }
    };
    
    if ( ! this._operationRunning) {
      op();
      if (emitVirtualResizeEventFlag) {
        VirtualScrollArea.emitResizeEvent(this);
      }
    } else {
      op();
      this._operationEmitResize = emitVirtualResizeEventFlag;
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

  private _handleScrollbackEvent(scrollbackLines: TermApi.Line[]): void {
    for (let i=0; i<scrollbackLines.length; i++) {
      const line = scrollbackLines[i];
      this._aceEditSession.insertTerminalLine(this._terminalFirstRow + i, line);
    }

    this._terminalFirstRow = this._terminalFirstRow  + scrollbackLines.length;
  }

  private _insertLinesOnScreen(startRow: number, endRow: number, lines: TermApi.Line[]): void {
    const lineCount = this._aceEditSession.getLength();

    // Mark sure there are enough rows inside CodeMirror.
    if (lineCount < endRow + this._terminalFirstRow) {
      const pos = { row: this._terminalFirstRow + lineCount, column: 0 };
      
      let emptyText = "";
      const extraCrCount = endRow + this._terminalFirstRow - lineCount;
      for (let j = 0; j < extraCrCount; j++) {
        emptyText += "\n";
      }
      this._aceEditSession.insert(pos, emptyText);

    }

    for (let i=0; i<lines.length; i++) {
      this._aceEditor.setTerminalLine(startRow + i + this._terminalFirstRow, lines[i]);
    }

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
    return this._isEmpty ? 0 : this._aceEditor.renderer.lineHeight * this.lineCount();
  }
  
  private _getClientYScrollRange(): number {
    return Math.max(0, this.getVirtualHeight(this.getHeight()) - this.getHeight() + this.getReserveViewportHeight(this.getHeight()));
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null) {
      return;
    }
    const elementHeight = this.getHeight();
    if (elementHeight !== this._currentElementHeight || this._useVPad !== this._currentVPad) {
      this._currentElementHeight = elementHeight;
      this._currentVPad = this._useVPad;
      this.style.height = "" + elementHeight + "px";
      
      let aceEditorHeight;
      if (this._useVPad) {
        // Adjust the height of the code mirror such that a small gap is at the bottom to 'push'
        // the lines up and align them with the top of the viewport.
        aceEditorHeight = elementHeight - (elementHeight % this._aceEditor.renderer.lineHeight);
      } else {
        aceEditorHeight = elementHeight;        
      }

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + aceEditorHeight + "px";
      this._aceEditor.resize(true);
    }
  }
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}

function maxNormalWidthCodePoint(): number {
  return 0x01c3;  // Last char before the Croatian digraphs. DejaVuSansMono has some extra wide chars after this.
}

/**
 * Return true if a code point has a normal monospace width of one cell.
 * 
 * @param the unicode code point to test
 * @return true if the code point has a normal monospace width of one cell.
 */
function isCodePointNormalWidth(codePoint: number): boolean {
  if (codePoint < 0x01c4) { // Latin up to the Croatian digraphs.
    return true;
  }

  if (codePoint <= 0x1cc) {// Croatian digraphs can be a problem.
    return false; 
  }

  if (codePoint < 0x1f1) {  // Up to Latin leter DZ.
    return true;
  }
  if (codePoint <= 0x1f3) { // Latin letter DZ.
    return false;
  }

  return false;
}
