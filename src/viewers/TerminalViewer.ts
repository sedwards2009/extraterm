/**
 * Copyright 2015-2017 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';

import {ViewerElement} from '../ViewerElement';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as Util from '../gui/Util';
import * as DomUtils from '../DomUtils';
import * as CodeMirror from 'codemirror';
import * as CodeMirrorCommands from '../CodeMirrorCommands';
import * as CodeMirrorUtils from '../utils/CodeMirrorUtils';
import * as ViewerElementTypes from '../ViewerElementTypes';
import * as EtTerminalViewerTypes from './TerminalViewerTypes';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import * as Term from '../Term';
import * as VirtualScrollArea from '../VirtualScrollArea';
import Logger from '../Logger';
import log from '../LogDecorator';
import * as SourceDir from '../SourceDir';
import * as GeneralEvents from '../GeneralEvents';
import * as ThemeTypes from '../Theme';
import * as keybindingmanager from '../KeyBindingManager';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';

type KeyBindingManager = keybindingmanager.KeyBindingManager;

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type SetterState = VirtualScrollArea.SetterState;
type TextDecoration = EtTerminalViewerTypes.TextDecoration;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;
const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;
type BookmarkRef = EtTerminalViewerTypes.BookmarkRef;
type CommandPaletteRequest = CommandPaletteRequestTypes.CommandPaletteRequest;

const ID = "EtTerminalViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const ID_CSS_VARS = "ID_CSS_VARS";
const CLASS_HIDE_CURSOR = "hide-cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";
const OVERSIZE_CLASS_LIST = ["oversize"];

const KEYBINDINGS_CURSOR_MODE = "terminal-viewer";
const PALETTE_GROUP = "terminalviewer";
const COMMAND_TYPE_AND_CR_SELECTION = "typeSelectionAndCr";
const COMMAND_TYPE_SELECTION = "typeSelection";
const COMMAND_OPEN_COMMAND_PALETTE = CommandPaletteRequestTypes.COMMAND_OPEN_COMMAND_PALETTE;

const NON_CODEMIRROR_COMMANDS = [
  COMMAND_TYPE_AND_CR_SELECTION,
  COMMAND_TYPE_SELECTION
];

const NO_STYLE_HACK = "NO_STYLE_HACK";

const DEBUG_RESIZE = false;

let registered = false;
let cssText: string = null;

CodeMirrorCommands.init();

function getCssText(): string {
  return cssText;
}

export class TerminalViewer extends ViewerElement implements CommandPaletteRequestTypes.Commandable,
    keybindingmanager.AcceptsKeyBindingManager, SupportsClipboardPaste.SupportsClipboardPaste {

  static TAG_NAME = "ET-TERMINAL-VIEWER";
  
  static EVENT_KEYBOARD_ACTIVITY = "keyboard-activity";

  static init(): void {
    if (registered === false) {
      // Load the CSS resources now.
      cssText = fs.readFileSync(require.resolve('codemirror/lib/codemirror.css'), { encoding: 'utf8' })
        + fs.readFileSync(require.resolve('codemirror/addon/scroll/simplescrollbars.css'), { encoding: 'utf8' });

      window.customElements.define(TerminalViewer.TAG_NAME.toLowerCase(), TerminalViewer);
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is TerminalViewer {
    return node !== null && node !== undefined && node instanceof TerminalViewer;
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _keyBindingManager: KeyBindingManager;
  
  private _emulator: Term.Emulator;

  // The line number of the top row of the emulator screen (i.e. after the scrollback  part).
  private _terminalFirstRow: number;
  
  private _commandLine: string;
  private _returnCode: string;
  private _codeMirror: CodeMirror.Editor;
  private _height: number;
  private _isEmpty: boolean;
  private _mode: ViewerElementTypes.Mode;
  private _editable: boolean;
  private document: Document;
  private _useVPad: boolean;
  private _visualState: VisualState;

  private _mainStyleLoaded: boolean;
  private _resizePollHandle: DomUtils.LaterHandle;
  private _needEmulatorResize: boolean;
  
  private _operationRunning: boolean; // True if we are currently running an operation with the operation() method.
  private _operationEmitResize: boolean;  // True if a resize evnet shuld be emitted once the operation is finished.
  
  // Emulator dimensions
  private _rows: number;
  private _columns: number;
  private _realizedRows: number;

  private _lastCursorAnchorPosition: CodeMirror.Position;
  private _lastCursorHeadPosition: CodeMirror.Position;
  private _viewportHeight: number;  // Used to detect changes in the viewport size when in Cursor mode.
  private _fontUnitWidth: number;
  private _fontUnitHeight: number;

  // The current element height. This is a cached value used to prevent touching the DOM.  
  private _currentElementHeight: number;
  private _currentVPad: boolean;
  private _renderEventListener: Term.RenderEventHandler = this._handleRenderEvent.bind(this);

  private _bookmarkCounter: number;
  private _bookmarkIndex: Map<BookmarkRef, CodeMirror.TextMarker>;

  private _initProperties(): void {
    this._log = new Logger(TerminalViewer.TAG_NAME, this);
    this._keyBindingManager = null;
    this._emulator = null;
    this._terminalFirstRow = 0;
    this._commandLine = null;
    this._returnCode  =null;
    this._editable = false;
    this._codeMirror = null;
    this._height = 0;
    this._isEmpty = true;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
    this.document = document;
    this._useVPad = true;
    this._currentVPad = true;
    this._visualState = VisualState.AUTO;
    
    this._currentElementHeight = -1;

    this._fontUnitWidth = 10; // slightly bogus defaults
    this._fontUnitHeight = 10;
    
    this._mainStyleLoaded = false;
    this._resizePollHandle = null;
    this._needEmulatorResize = false;

    this._operationRunning = false;
    this._operationEmitResize = false;
    
    this._rows = -1;
    this._columns = -1;
    this._realizedRows = -1;
    this._lastCursorAnchorPosition = null;
    this._lastCursorHeadPosition = null;
    this._viewportHeight = -1;

    this._renderEventListener = null;

    this._bookmarkCounter = 0;
    this._bookmarkIndex = new Map<BookmarkRef, CodeMirror.TextMarker>();
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

  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void {
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.unregisterChangeListener(this);
    }
    
    this._keyBindingManager = newKeyBindingManager;
    if (this._keyBindingManager !== null) {
      this._keyBindingManager.registerChangeListener(this, () => {
        this._codeMirror.setOption("keyMap", this._codeMirrorKeyMap());
      });
    }
  }

  setCommandLine(commandLine: string): void {
    this._commandLine = commandLine;
  }
  
  setReturnCode(returnCode: string): void {
    this._returnCode = returnCode;
  }
  
  getTitle(): string {
    if (this._commandLine !== null) {
      return this._commandLine;
    } else {
      return "Terminal Command";
    }
  }
  
  getAwesomeIcon(): string {
    return "terminal";
  }
  
  getSelectionText(): string {    
    const doc = this._codeMirror.getDoc();
    const cursorAnchorPos = doc.getCursor("anchor");
    const cursorHeadPos = doc.getCursor("head");
    if (_.isEqual(cursorHeadPos, cursorAnchorPos)) {
      return null;
    }
    
    return doc.getSelection("\n");
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
    CodeMirrorUtils.pasteText(this._codeMirror.getDoc(), text);
  }

  focus(): void {
    this._codeMirror.focus();
  }

  hasFocus(): boolean {
    const hasFocus = this._codeMirror.getInputField() === DomUtils.getShadowRoot(this).activeElement;
    return hasFocus;
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
  
  getText(): string {
    return this._isEmpty ? "" : this._codeMirror.getDoc().getValue();
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
      this._codeMirror.setOption("readOnly", ! editable);
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
      const defaultTextHeight = this._codeMirror.defaultTextHeight();
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
    if (this._codeMirror !== null) {
      if (DEBUG_RESIZE) {
        this._log.debug("calling codeMirror.refresh()");
      }

      if (level === ResizeRefreshElementBase.RefreshLevel.RESIZE) {
        this._codeMirror.setSize(null, null);
      } else {
        this._codeMirror.refresh();
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
      this.resizeEmulatorToBox(viewportElement.clientWidth, viewportElement.clientHeight);
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
    
    const charHeight = this._codeMirror.defaultTextHeight();
    const charWidth = this._codeMirror.defaultCharWidth();

    const computedStyle = window.getComputedStyle(this);
    const width = widthPixels - px(computedStyle.marginLeft) - px(computedStyle.marginRight);
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
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return this._isEmpty ? 0 : doc.lineCount();
  }
  
  deleteScreen(): void {
    this._deleteScreen();
  }
  
  getCursorPosition(): CursorMoveDetail {
    const cursorPos = this._codeMirror.cursorCoords(true, "local");
    const scrollInfo = this._codeMirror.getScrollInfo();
    const detail: CursorMoveDetail = {
      left: cursorPos.left,
      top: cursorPos.top,
      bottom: cursorPos.bottom,
      viewPortTop: scrollInfo.top
    };
    return detail;
  }

  clearSelection(): void {
    const doc = this._codeMirror.getDoc();
    if ( ! doc.somethingSelected()) {
      return;
    }
    doc.setCursor(doc.getCursor());
  }
  
  setCursorPositionTop(ch: number): boolean {
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line: 0, ch: ch } );
    return true;
  }
  
  setCursorPositionBottom(ch: number): boolean {
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line: doc.lineCount()-1 , ch: ch } );
    return true;
  }

  /**
   * Delete the top n pixels from the scrollback.
   *
   * @param topPixels the number of lines to removed measured in pixels.
   */
  deleteTopPixels(topPixels: number): void {
    const defaultTextHeight = this._codeMirror.defaultTextHeight();
    const linesToDelete = Math.min(Math.floor(topPixels / defaultTextHeight), this.lineCount());
    
    const doc = this._codeMirror.getDoc();
    const pos = { line: 0, ch: 0 };
    const endPos = { line: linesToDelete, ch: 0 };
    doc.replaceRange("", pos, endPos);

    this._terminalFirstRow -= linesToDelete;
    VirtualScrollArea.emitResizeEvent(this);
  }
  
  deleteLines(startLineOrBookmark: number | BookmarkRef, endLineOrBookmark?: number | BookmarkRef): void {
    const doc = this._codeMirror.getDoc();
    
    let startLine = this._getLineNumberFromBookmark(startLineOrBookmark);
    
    let endLine = 0;
    if (endLineOrBookmark === undefined) {
      endLine = doc.lineCount()-1;
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

  getDecoratedLines(startLineOrBookmark: number | BookmarkRef): { text: string; decorations: TextDecoration[]; } {
    const startLine = this._getLineNumberFromBookmark(startLineOrBookmark);
    if (startLine < 0) {
      return null;
    }
    
    const doc = this._codeMirror.getDoc();
    const endLine = this.lineCount();
    const marks = doc.findMarks( { line: startLine, ch: 0}, { line: endLine, ch: 0 } );
    
    const decorations = this._codemirrorTextMarksToDecorations(marks);
    decorations.forEach( (d) => {
      d.line -= startLine;
    });
    
    const text = doc.getRange( { line: startLine, ch: 0 }, { line: endLine, ch: 0 } );
    return { text, decorations };
  }

  setDecoratedLines(text: string, decorations: TextDecoration[]): void {
    const startPos = { line: 0, ch: 0 };
    const endPos = { line: 0, ch: 0 };
    this._insertLinesAtPos(startPos, endPos, text, decorations);
    this._isEmpty = false;
    VirtualScrollArea.emitResizeEvent(this);
  }

  bookmarkLine(lineNumber: number): BookmarkRef {
    const doc = this._codeMirror.getDoc();
    const textBookmark = doc.setBookmark( {line: lineNumber, ch: 0 } );
    const bookmarkCounter = this._bookmarkCounter;
    this._bookmarkCounter++;
    
    const ref: BookmarkRef = {
      bookmarkRefId: bookmarkCounter
    };
    this._bookmarkIndex.set(ref, textBookmark);
    
    return ref;
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
  
  constructor() {
    super();
    this._initProperties();
    this._renderEventListener = this._handleRenderEvent.bind(this);
  }
  
  /**
   * Custom Element 'connected' life cycle hook.
   */
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

      const options = {
        value: "",
        readOnly: true,
        scrollbarStyle: "null",
        cursorScrollMargin: 0,
        showCursorWhenSelecting: true,
        mode: null,
        keyMap: this._codeMirrorKeyMap(),
        resetSelectionOnContextMenu: false
      };

      // Create the CodeMirror instance
      this._codeMirror = CodeMirror( (el: HTMLElement): void => {
        containerDiv.appendChild(el);
      }, <any>options);

      this._codeMirror.on("cursorActivity", () => {
        const effectiveFocus = this._visualState === ViewerElementTypes.VisualState.FOCUSED ||
                                (this._visualState === ViewerElementTypes.VisualState.AUTO && this.hasFocus());
        if (this._mode !== ViewerElementTypes.Mode.DEFAULT && effectiveFocus) {
          this._lastCursorHeadPosition = this._codeMirror.getDoc().getCursor("head");
          this._lastCursorAnchorPosition = this._codeMirror.getDoc().getCursor("anchor");
          
          const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
          this.dispatchEvent(event);
        }
      });
      
      this._codeMirror.on("scroll", () => {
        // Over-scroll bug/feature fix
        const scrollInfo = this._codeMirror.getScrollInfo();
        // this._log.debug("codemirror event scroll:", scrollInfo);
        
        const clientYScrollRange = this._getClientYScrollRange();
        if (scrollInfo.top > clientYScrollRange) {
          this._codeMirror.scrollTo(0, clientYScrollRange);
        }
      });
      
      this._codeMirror.on("focus", (instance: CodeMirror.Editor): void => {
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

      this._codeMirror.on("blur", (instance: CodeMirror.Editor): void => {
        if (this._emulator !== null) {
          this._emulator.blur();
        }
        
        if (this._visualState === VisualState.AUTO) {
          containerDiv.classList.add(CLASS_UNFOCUSED);
          containerDiv.classList.remove(CLASS_FOCUSED);
        }
      });
      
      this._codeMirror.on("beforeSelectionChange", (instance: CodeMirror.Editor, obj): void => {
          // obj: { ranges: {anchor: CodeMirror.Position; head: CodeMirror.Position; }[]; }
        if (obj.ranges.length === 0) {
          return;
        }
        
        if (obj.ranges.length === 1) {
          const pair = obj.ranges[0];
          if (_.isEqual(pair.anchor, pair.head)) {
            return;
          }
        }
        this._emitBeforeSelectionChangeEvent(obj.origin === "*mouse");
      });

      this._codeMirror.on("keyHandled", (instance: CodeMirror.Editor, name: string, event: KeyboardEvent): void => {
        const isUp = name === "PageUp" || name === "Up";
        const isDown = name === "PageDown" || name === "Down";
        if (isUp || isDown) {
          const cursorAnchorPos = this._codeMirror.getDoc().getCursor("anchor");
          const cursorHeadPos = this._codeMirror.getDoc().getCursor("head");
          
          if (this._lastCursorHeadPosition !== null && this._lastCursorAnchorPosition !== null
              && _.isEqual(this._lastCursorHeadPosition, this._lastCursorAnchorPosition)  // check for no selection
              && _.isEqual(cursorHeadPos, cursorAnchorPos)  // check for no selection
              && this._lastCursorHeadPosition.line === cursorHeadPos.line) {

            // The last action didn't move the cursor.
            const ch = this._lastCursorAnchorPosition.ch; // _lastCursorAnchorPosition can change before the code below runs.
            DomUtils.doLater( () => {
              const detail: ViewerElementTypes.CursorEdgeDetail = { edge: isUp
                                                                      ? ViewerElementTypes.Edge.TOP
                                                                      : ViewerElementTypes.Edge.BOTTOM,
                                                                    ch: ch };
              const event = new CustomEvent(ViewerElement.EVENT_CURSOR_EDGE, { bubbles: true, detail: detail });
              this.dispatchEvent(event);
            });
          }
        }
      });
      
      this._codeMirror.on('viewportChange', (instance: CodeMirror.Editor, from: number, to: number) => {
        if (this._mode !== ViewerElementTypes.Mode.CURSOR) {
          return;
        }
        
        const height = to - from;
        if (height !== this._viewportHeight) {
          this._viewportHeight = height;
          DomUtils.doLater( () => {
            VirtualScrollArea.emitResizeEvent(this);
          });
        }
      });
      
      // Filter the keyboard events before they reach CodeMirror.
      containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
      containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
      containerDiv.addEventListener('keypress', this._handleContainerKeyPressCapture.bind(this), true);
      containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
      containerDiv.addEventListener('contextmenu', this._handleContextMenuCapture.bind(this), true);

      const codeMirrorElement = this._codeMirror.getWrapperElement();
      codeMirrorElement.addEventListener("mousedown", this._handleMouseDownEvent.bind(this), true);
      codeMirrorElement.addEventListener("mouseup", this._handleMouseUpEvent.bind(this), true);
      codeMirrorElement.addEventListener("mousemove", this._handleMouseMoveEvent.bind(this), true);
      
      this._codeMirror.on("scrollCursorIntoView", (instance: CodeMirror.Editor, ev: Event): void => {
        ev.preventDefault();
      });
    }

    if (this._needEmulatorResize) {
      this._needEmulatorResize = false;
      this._resizePoll();
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TERMINAL_VIEWER];
  }

  /**
   * Quickly execute a function without intermediate on-screen updates.
   *
   * @param op the function to execute without updates.
   */
  operation(op: () => void): void {
    this._operationRunning = true;
    this._codeMirror.operation(op);
    this._operationRunning = false;
    
    if (this._operationEmitResize) {
      VirtualScrollArea.emitResizeEvent(this);
    }
    this._operationEmitResize = false;
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
  /**
   * 
   */
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
    const charHeight = this._codeMirror.defaultTextHeight();
    const charWidth = this._codeMirror.defaultCharWidth();
  
    this._fontUnitWidth = charWidth;
    this._fontUnitHeight = charHeight;
    const styleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);
    styleElement.textContent = this._getCssVarsRules();
  }

  private _enterCursorMode(): void {
    const containerDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.remove(CLASS_HIDE_CURSOR);

    const doc = this._codeMirror.getDoc();
    if (this._emulator !== null) {
      const dimensions = this._emulator.getDimensions();
      doc.setCursor( { line: dimensions.cursorY + this._terminalFirstRow, ch: dimensions.cursorX } );
    } else {
      doc.setCursor( { line: doc.lineCount()-1, ch: 0 } );
    }

    this._lastCursorHeadPosition = this._codeMirror.getDoc().getCursor("head");
    this._lastCursorAnchorPosition = this._codeMirror.getDoc().getCursor("anchor");
    if (this._editable) {
      this._codeMirror.setOption("readOnly", false);
    }
  }

  private _exitCursorMode(): void {
    if (this._codeMirror !== null) {
      this._codeMirror.setOption("readOnly", true);
    }

    const containerDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.add(CLASS_HIDE_CURSOR);
  }
  
  private _codemirrorTextMarksToDecorations(markers: CodeMirror.TextMarker[]): TextDecoration[] {
    const result = markers.map( (m) => {
      const loc = m.find();
      const td: TextDecoration = {
        line: loc.from.line,
        fromCh: loc.from.ch,
        toCh: loc.to.ch,
        classList: [m.className]
      };
      return td;
    });
    
    return result;
  }

  private _emitKeyboardActivityEvent(): void {
    const scrollInfo = this._codeMirror.getScrollInfo();    
    const event = new CustomEvent(TerminalViewer.EVENT_KEYBOARD_ACTIVITY, { bubbles: true });
    this.dispatchEvent(event);
  }

  private _emitBeforeSelectionChangeEvent(originMouse: boolean): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { detail: { originMouse: originMouse },
      bubbles: true });
    this.dispatchEvent(event);
  }

  private _getLineNumberFromBookmark(lineOrBookmark: number | BookmarkRef): number {
    let startLine = 0;
    if (typeof lineOrBookmark === 'number') {
      return lineOrBookmark;
    } else {
      const marker = this._bookmarkIndex.get(lineOrBookmark);
      if (marker === undefined) {
        return -1;
      }
      const position = marker.find();
      return position !== undefined && position.from !== undefined ? position.from.line : -1;
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

    this._codeMirror.scrollTo(xCoord, yCoord);
  }
  
  private _handleEmulatorMouseEvent(ev: MouseEvent, emulatorHandler: (opts: Term.MouseEventOptions) => void): void {
    // Ctrl click prevents the mouse being taken over by
    // the application and allows the user to select stuff.
    if (ev.ctrlKey) { 
      return;
    }
    const pos = this._codeMirror.coordsChar( { left: ev.clientX, top: ev.clientY } );
    if (pos === null) {
      return;
    }

    // FIXME use the 'buttons' API.
    const button = ev.button !== undefined ? ev.button : (ev.which !== undefined ? ev.which - 1 : null);

    // send the button
    const options: Term.MouseEventOptions = {
      leftButton: button === 0,
      middleButton: button === 1,
      rightButton: button === 2,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      row: pos.line - this._terminalFirstRow,
      column: pos.ch
    };
    
    if (emulatorHandler(options)) {
      // The emulator consumed the event. Stop CodeMirror from processing it too.
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
  
  private _codeMirrorKeyMap(): any {
    if (this._keyBindingManager === null || this._keyBindingManager.getKeyBindingContexts() === null) {
      return {};  // empty keymap
    }
    
    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_CURSOR_MODE);
    if (keyBindings === null) {
      return {};
    }

    const codeMirrorKeyMap = keyBindings.keyBindings
          .filter( (binding) => NON_CODEMIRROR_COMMANDS.indexOf(binding.command) === -1)
          .reduce( (accu, binding) => {
            accu[binding.normalizedShortcut] = binding.command;
            return accu;
          }, {});
    return codeMirrorKeyMap;
  }
  
  public dispatchEvent(ev: Event): boolean {
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
    }
  }
  
  private _scheduleSyntheticKeyDown(ev: KeyboardEvent): void {
    DomUtils.doLater( () => {
      const fakeKeyDownEvent = DomUtils.newKeyboardEvent('keydown', {
        bubbles: true,
        key: ev.key,        
        code: ev.code,
        location: ev.location,
        repeat: ev.repeat,
        keyCode: ev.keyCode,
        charCode: ev.charCode,
        which: ev.which,
        ctrlKey: ev.ctrlKey,
        shiftKey: ev.shiftKey,
        altKey: ev.altKey,
        metaKey: ev.metaKey
      });
      
      super.dispatchEvent(fakeKeyDownEvent);
    });
  }

  private _handleContainerKeyPressCapture(ev: KeyboardEvent): void {
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
    if (this._keyBindingManager !== null && this._keyBindingManager.getKeyBindingContexts() !== null) {
      const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_CURSOR_MODE);
      if (keyBindings !== null) {
        command = keyBindings.mapEventToCommand(ev);
        if (this._executeCommand(command)) {
          ev.stopPropagation();
          return;
        } else {
          if (this._mode ===ViewerElementTypes.Mode.CURSOR) {
            if (command !== null) {
              return;
            }
            if (ev.shiftKey) {
              const evWithoutShift: keybindingmanager.MinimalKeyboardEvent = {
                shiftKey: false,
                metaKey: ev.metaKey,
                altKey: ev.altKey,
                ctrlKey: ev.ctrlKey,
                key: ev.key,
                keyCode: ev.keyCode
              };
              command = keyBindings.mapEventToCommand(evWithoutShift);
              if (command !== null && command.startsWith("go")) {
                // CodeMirror will handle this key.
                return;
              }
            }
          }
        }
      }
    }
    
    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();

      if (this._emulator !== null && this._emulator.keyDown(ev)) {
       this._emitKeyboardActivityEvent();
      } else {
       // Emit a key down event which our parent elements can catch.
       this._scheduleSyntheticKeyDown(ev);
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
    // Prevent CodeMirror from seeing this event and messing with the hidden textarea and the focus.
    ev.stopImmediatePropagation();
    ev.preventDefault();

    this.executeCommand(CommandPaletteRequestTypes.COMMAND_OPEN_COMMAND_PALETTE);
  }

  private _commandPaletteEntries(): CommandPaletteRequestTypes.CommandEntry[] {
    let commandList: CommandPaletteRequestTypes.CommandEntry[] = [
      { id: COMMAND_TYPE_SELECTION, group: PALETTE_GROUP, iconRight: "terminal", label: "Type Selection", target: this },
      { id: COMMAND_TYPE_AND_CR_SELECTION, group: PALETTE_GROUP, iconRight: "terminal", label: "Type Selection & Execute", target: this }
    ];
    
    if (this._mode === ViewerElementTypes.Mode.CURSOR) {
      const cmCommandList: CommandPaletteRequestTypes.CommandEntry[] =
        CodeMirrorCommands.commandDescriptions(this._codeMirror).map( (desc) => {
          return { id: desc.command,
            group: PALETTE_GROUP,
            iconLeft: desc.iconLeft,
            iconRight: desc.iconRight,
            label: desc.label,
            target: this };
        });
      commandList = [...commandList, ...cmCommandList];
    }
    
    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_CURSOR_MODE);
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
        const text = this._codeMirror.getDoc().getSelection();
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
        const commandPaletteRequestDetail: CommandPaletteRequest = {
            srcElement: this,
            commandEntries: this._commandPaletteEntries(),
            contextElement: null
          };
        const commandPaletteRequestEvent = new CustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST,
          { detail: commandPaletteRequestDetail });
        commandPaletteRequestEvent.initCustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, true, true,
          commandPaletteRequestDetail);
        this.dispatchEvent(commandPaletteRequestEvent);
        break;
        
      default:
        if (this._mode === ViewerElementTypes.Mode.CURSOR && CodeMirrorCommands.isCommand(command)) {
          CodeMirrorCommands.executeCommand(this._codeMirror, command);
          return true;
        } else {
          return false;
        }
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
      this._resizePollHandle.cancel();
      this._resizePollHandle = null;
    }
  }

  private _handleStyleLoad(): void {
    if (this._mainStyleLoaded) {
      // Start polling the term for application of the font.
      this._resizePollHandle = DomUtils.doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  private _effectiveFontFamily(): string {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    const cs = window.getComputedStyle(containerDiv, null);
    return cs.getPropertyValue("font-family");
  }

  private _resizePoll(): void {
    if (this._mainStyleLoaded) {  // FIXME this font loading stuff needs to be replaced with resize canary.
      if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = DomUtils.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
        this._codeMirror.defaultTextHeight(); // tickle the DOM to maybe force CSS recalc.

        if (this.parentElement == null) {
          this._needEmulatorResize = true;  // Do it later.
        } else {
          window.setTimeout(() => {
            if (this.parentElement == null) {
              this._needEmulatorResize = true;  // Do it later.
            } else {
              this.resizeEmulatorToParentContainer();
            }
          }, 100);  // 100ms
        }
      }
    }
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

  private _handleRenderEvent(instance: Term.Emulator, event: Term.RenderEvent): void {
    let emitVirtualResizeEventFlag = false;
    
    const op = () => {
      emitVirtualResizeEventFlag = this._handleSizeEvent(event.rows, event.columns, event.realizedRows);

      // Refresh the active part of the screen.
      const startRow = event.refreshStartRow;
      if (startRow !== -1) {
        const endRow = event.refreshEndRow;
        const lines: Term.Line[] = [];
        for (let row = startRow; row < endRow; row++) {
          lines.push(this._emulator.lineAtRow(row));
        }
        this._insertLinesOnScreen(startRow, endRow, lines);
        
        // Update our realised rows var if needed.
        const doc = this._codeMirror.getDoc();
        const lineCount = doc.lineCount();
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
      this._codeMirror.operation(op);
      if (emitVirtualResizeEventFlag) {
        VirtualScrollArea.emitResizeEvent(this);
      }
    } else {
      op();
      this._operationEmitResize = emitVirtualResizeEventFlag;
    }
  }
  
  private _handleSizeEvent(newRows: number, newColumns: number, realizedRows: number): boolean {
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();
    const currentRealizedRows = lineCount - this._terminalFirstRow;
    if (this._rows === newRows && this._columns === newColumns && currentRealizedRows <= realizedRows) {
      return false; // Nothing to do.
    }
    
    if (currentRealizedRows > realizedRows) {
      // Trim off the extra lines.
      const startPos = this._terminalFirstRow + realizedRows === 0
        ? { line: this._terminalFirstRow + realizedRows, ch: 0 }
        : { line: this._terminalFirstRow + realizedRows -1, ch: doc.getLine(this._terminalFirstRow + realizedRows-1).length };
      const endPos = { line: lineCount-1, ch: doc.getLine(lineCount-1).length };
      doc.replaceRange("", startPos, endPos);

      this._realizedRows = realizedRows;
    }
    
    this._rows = newRows;
    this._columns = newColumns;
    return true;
  }

  private _handleScrollbackEvent(scrollbackLines: Term.Line[]): void {
    const pos: CodeMirror.Position = { line: this._terminalFirstRow, ch: 0 };
    const {text: text, decorations: decorations} = this._linesToTextStyles(scrollbackLines);
    this._codeMirror.operation( () => {
      this._insertLinesAtPos(pos ,pos, text + "\n", decorations);
    });
    this._terminalFirstRow = this._terminalFirstRow  + scrollbackLines.length;
  }

  private _insertLinesOnScreen(startRow: number, endRow: number,lines: Term.Line[]): void {
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();
    
    // Mark sure there are enough rows inside CodeMirror.
    if (lineCount < endRow + this._terminalFirstRow) {
      const pos = { line: this._terminalFirstRow + lineCount, ch: 0 };
      
      let emptyText = "";
      const extraCrCount = endRow + this._terminalFirstRow - lineCount;
      for (let j = 0; j < extraCrCount; j++) {
        emptyText += "\n";
      }
      doc.replaceRange(emptyText, pos, pos);
    }

    const {text: text, decorations: decorations} = this._linesToTextStyles(lines);
    const startPos = { line: this._terminalFirstRow + startRow, ch: 0 };
    const endPos = { line: this._terminalFirstRow + endRow -1, ch: doc.getLine(this._terminalFirstRow + endRow -1).length };
    this._insertLinesAtPos(startPos, endPos, text, decorations);
    this._isEmpty = false;
  }
  
  private _insertLinesAtPos(startPos: CodeMirror.Position, endPos: CodeMirror.Position, text: string,
      decorations: TextDecoration[]): void {

    const doc = this._codeMirror.getDoc();
    doc.replaceRange(text, startPos, endPos);

    if (decorations !== undefined && decorations.length !== 0) {
      // Apply the styles to the text.
      const len = decorations.length;
      const startRow = startPos.line;
      
      for (let i=0; i<len; i++) {
        const style = decorations[i];
        const from = { line: style.line + startRow, ch: style.fromCh };
        const to = { line: style.line + startRow, ch: style.toCh };
        const classList = style.classList;
        for (let j=0; j<classList.length; j++) {
          doc.markText( from, to, { className: classList[j] } );
        }
      }
    }    
  }
  
  private _deleteScreen(): void {
    this._realizedRows = -1;
    if (this._isEmpty) {
      return;
    }
    
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();
    this._deleteLines(this._terminalFirstRow, lineCount-1);
  }
  
  /**
   * Deletes the given inclusive range of lines.
   * 
   * @param {number} startLine [description]
   * @param {number} endLine   [description]
   */
  private _deleteLines(startLine: number, endLine: number): void {
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();
    const endPos = { line: endLine, ch: doc.getLine(endLine).length };
    if (startLine === 0) {
      const startPos = { line: startLine, ch: 0 };
      doc.replaceRange("", startPos, endPos);  
      this._isEmpty = lineCount-1 === endLine;
    } else {
      // Start deleting from the end of the row before the top of the terminal.
      const startPos = { line: startLine-1, ch: doc.getLine(startLine-1).length };
      doc.replaceRange("", startPos, endPos);
    }
  }
  
  private getVirtualTextHeight(): number {
    return this._isEmpty ? 0 : this._codeMirror.defaultTextHeight() * this.lineCount();
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
      
      const totalTextHeight = this.getVirtualTextHeight();
      let codeMirrorHeight;
      if (this._useVPad) {
        // Adjust the height of the code mirror such that a small gap is at the bottom to 'push'
        // the lines up and align them with the top of the viewport.
        codeMirrorHeight = elementHeight - (elementHeight % this._codeMirror.defaultTextHeight());
      } else {
        codeMirrorHeight = elementHeight;        
      }

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + codeMirrorHeight + "px";
      this._codeMirror.setSize("100%", "" + codeMirrorHeight + "px");
    }
  }
    
  _themeCssSet(): void {  
    // const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    // if (themeTag !== null) {
    //   themeTag.innerHTML = this.getThemeCss();
    // }
  }
  
  private _linesToTextStyles(lines: Term.Line[]): { text: string; decorations: TextDecoration[]; } {
    const allDecorations: TextDecoration[] = [];
    const allTextList: string[] = [];
    let cr = "";

    for (let i = 0; i < lines.length; i++) {
      const {text, decorations} = this._lineToStyleList(lines[i], i);
      allTextList.push(cr);
      allTextList.push(text);
      cr = "\n";
      
      allDecorations.push(...decorations);
    }
    return {text: allTextList.join(""), decorations: allDecorations};
  }

  private _lineToStyleList(line: Term.Line, lineNumber: number): {text: string, decorations: TextDecoration[] } {
    const defAttr = Term.Emulator.defAttr;
    let attr = defAttr;
    const attrs = line.attrs;
    const uint32Chars = line.chars;
    let lineLength = uint32Chars.length;
    const decorations: TextDecoration[] = [];
    const spaceCodePoint = ' '.codePointAt(0);

    // Trim off any unstyled whitespace to the right of the line.
    while (lineLength !==0 && attrs[lineLength-1] === defAttr && uint32Chars[lineLength-1] === spaceCodePoint) {
      lineLength--;
    }

    let currentDecoration: TextDecoration  = null;
    let column = 0;
    const text = lineLength !== uint32Chars.length ? String.fromCodePoint(...uint32Chars.slice(0,lineLength)) : String.fromCodePoint(...uint32Chars);
    const normalWidthCodePointCutOff = maxNormalWidthCodePoint();
    for (let i = 0; i < lineLength; i++, column++) {
      const data = attrs[i];
      
      const classList: string[] = [];
      const codePoint = uint32Chars[i];
      const dataOversize = codePoint > normalWidthCodePointCutOff && isCodePointNormalWidth(codePoint) === false;

      if (dataOversize) {
        if (codePoint >= 0x10000) {
          // UTF-16 surrogate pair, takes up two chars.
          decorations.push( { line: lineNumber, fromCh: column, toCh: column+2, classList: OVERSIZE_CLASS_LIST } );
          column++;
        } else {
          decorations.push( { line: lineNumber, fromCh: column, toCh: column+1, classList: OVERSIZE_CLASS_LIST } );
        }
      }

      if (data !== attr) {
        if (attr !== defAttr) {
          currentDecoration.toCh = column;
          decorations.push(currentDecoration);
          currentDecoration = null;
        }
        if (data !== defAttr) {
          if (data === 0xffffffff) {
            // Cursor itself
            classList.push("reverse-video");
            classList.push("terminal-cursor");
          } else {
          
            let bg = Term.backgroundFromCharAttr(data);
            let fg = Term.foregroundFromCharAttr(data);
            const flags = Term.flagsFromCharAttr(data);
            
            // bold
            if (flags & Term.BOLD_ATTR_FLAG) {
              classList.push('terminal-bold');

              // See: XTerm*boldColors
              if (fg < 8) {
                fg += 8;  // Use the bright version of the color.
              }
            }

            // italic
            if (flags & Term.ITALIC_ATTR_FLAG) {
              classList.push('terminal-italic');
            }
            
            // underline
            if (flags & Term.UNDERLINE_ATTR_FLAG) {
              classList.push('terminal-underline');
            }

            // strike through
            if (flags & Term.STRIKE_THROUGH_ATTR_FLAG) { 
              classList.push('terminal-strikethrough');
            }
            
            // inverse
            if (flags & Term.INVERSE_ATTR_FLAG) {
              let tmp = fg;
              fg = bg;
              bg = tmp;
              
              // Should inverse just be before the
              // above boldColors effect instead?
              if ((flags & Term.BOLD_ATTR_FLAG) && fg < 8) {
                fg += 8;  // Use the bright version of the color.
              }
            }

            // invisible
            if (flags & Term.INVISIBLE_ATTR_FLAG) {
              classList.push('terminal-invisible');
            }

            if (bg !== 256) {
              classList.push('terminal-background-' + bg);
            }

            if (flags & Term.FAINT_ATTR_FLAG) {
              classList.push('terminal-faint-' + fg);
            } else {
              if (fg !== 257) {
                classList.push('terminal-foreground-' + fg);
              }
            }
            
            if (flags & Term.BLINK_ATTR_FLAG) {
              classList.push("terminal-blink");
            }
          }
          
          if (classList.length !== 0) {
            currentDecoration = { line: lineNumber, fromCh: column, toCh: null, classList: classList };
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
