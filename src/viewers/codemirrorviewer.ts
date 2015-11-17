/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");
import CodeMirror = require('codemirror');
import EtCodeMirrorViewerTypes = require('./codemirrorviewertypes');
import termjs = require('../term');
import virtualscrollarea = require('../virtualscrollarea');

type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type CursorMoveDetail = EtCodeMirrorViewerTypes.CursorMoveDetail;
type ResizeDetail = EtCodeMirrorViewerTypes.ResizeDetail;
type VirtualScrollable = virtualscrollarea.VirtualScrollable;

const ID = "CbCodeMirrorViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";
const ID_IMPORT_STYLE = "import_style";

const NO_STYLE_HACK = "NO_STYLE_HACK";

const CLASS_HIDE_CURSOR = "hide_cursor";

const DEBUG_RESIZE = false;

enum Mode {
  TERMINAL,
  SELECTION
}

let registered = false;

let instanceIdCounter = 0;

class EtCodeMirrorViewer extends ViewerElement implements VirtualScrollable {

  static TAG_NAME = "et-codemirror-viewer";
  
  static EVENT_CURSOR_MOVE = "cursor-move";

  static EVENT_RESIZE = "resize";

  static EVENT_KEYBOARD_ACTIVITY = "keyboard-activity";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(EtCodeMirrorViewer.TAG_NAME, {prototype: EtCodeMirrorViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtCodeMirrorViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtCodeMirrorViewer.
   */
  static is(node: Node): node is EtCodeMirrorViewer {
    return node !== null && node !== undefined && node instanceof EtCodeMirrorViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _emulator: termjs.Emulator;
  private _instanceId: number;

  // The line number of the top row of the emulator screen (i.e. after the scrollback  part).
  private _terminalFirstRow: number;
  
  private _mutationObserver: MutationObserver;
  private _commandLine: string;
  private _returnCode: string;
  private _focusable: boolean;
  private _codeMirror: CodeMirror.Editor;
  private _height: number;
  private _isEmpty: boolean;
  private _mode: Mode;
  private document: Document;
  private _useVPad: boolean;

  private _mainStyleLoaded: boolean;
  private _importStyleLoaded: boolean;
  private _resizePollHandle: util.LaterHandle;
  
  // Emulator dimensions
  private _rows = -1;
  private _columns = -1;
  private _realizedRows = -1;
  
  // The current element height. This is a cached value used to prevent touching the DOM.  
  private _currentElementHeight: number;
  
  private _initProperties(): void {
    this._emulator = null;
    this._terminalFirstRow = 0;
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
    this._focusable = false;
    this._codeMirror = null;
    this._height = 0;
    this._isEmpty = true;
    this._mode = Mode.TERMINAL;
    this.document = document;
    this._useVPad = true;
    
    this._currentElementHeight = -1;
    
    this._mainStyleLoaded = false;
    this._importStyleLoaded = false;
    this._resizePollHandle = null;
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

  set commandLine(commandLine: string) {
    this._commandLine = commandLine;
  }
  
  set returnCode(returnCode: string) {
    this._returnCode = returnCode;
  }
  
  get title(): string {
    if (this._commandLine !== null) {
      return this._commandLine;
    } else {
      return "Terminal Command";
    }
  }
  
  get awesomeIcon(): string {
    return "terminal";
  }
  
  getSelectionText(): string {
    return this._codeMirror.getDoc().getSelection("\n");
  }

  focus(): void {
    this._codeMirror.focus();
  }

  hasFocus(): boolean {
    const hasFocus = this._codeMirror.getInputField() === util.getShadowRoot(this).activeElement;
    return hasFocus;
  }

  set emulator(emulator: termjs.Emulator) {
    if (this._emulator !== null) {
      // Disconnect the last emulator.
      // FIXME
    }
    
    if (emulator !== null) {
      emulator.addRenderEventListener(this._handleRenderEvent.bind(this));
    }
    
    this._emulator = emulator;
  }

  get emulator(): termjs.Emulator {
    return this._emulator;
  }
  
  // get focusable(): boolean {
  //   return this._focusable;
  // }
  // 
  // set focusable(value: boolean) {
  //   this._focusable = value;
  //   this._updateFocusable(value);
  // }

  /**
   * Gets the height of this element.
   * 
   * @return {number} [description]
   */
  getHeight(): number {
    return this._height;
  }

  // VirtualScrollable
  setHeight(newHeight: number): void {
    this._adjustHeight(newHeight);
  }

  getMinHeight(): number {
    return 0;
  }

  setUseVPad(use: boolean): void {
    this._useVPad = use;
  }

  /**
   * Gets the height of the scrollable contents on this element.
   *
   * @return {number} [description]
   */
  getVirtualHeight(containerHeight: number): number {
    if (this._isEmpty) {
      return 0;
    }
    const defaultTextHeight = this._codeMirror.defaultTextHeight();
    const textHeight = defaultTextHeight * this.lineCount();
    if (this._useVPad && textHeight > containerHeight) {
      const vPad = containerHeight % defaultTextHeight;
      return vPad + textHeight;
    } else {
      return textHeight;
    }
  }
  
  resizeEmulatorToParentContainer(): void {
    this.resizeEmulatorToBox(this.parentElement.clientWidth, this.parentElement.clientHeight);
  }

  /**
   * Resize the terminal to fill a given pixel box size.
   * 
   * @returns Object with the new colums (cols field) and rows (rows field) information.
   */
  resizeEmulatorToBox(widthPixels: number, heightPixels: number): {cols: number; rows: number;} {
    const {columns: cols, rows: rows} = this.emulator.size();
    
    if (DEBUG_RESIZE) {
      this.log("resizeEmulatorToBox() this.effectiveFontFamily(): " + this._effectiveFontFamily());
      this.log("resizeEmulatorToBox() heightPixels: " + heightPixels);
    }
    
    if ( ! this.isFontLoaded()) {
     // Styles have not been applied yet.
     if (DEBUG_RESIZE) {
       this.log("resizeEmulatorToBox() styles have not been applied yet.");
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
      this.emulator.resize( { rows: newRows, columns: newCols } );
    }
    
    if (DEBUG_RESIZE) {
      this.log("resizeEmulatorToBox() old cols: ",cols);
      this.log("resizeEmulatorToBox() calculated charWidth: ",charWidth);    
      this.log("resizeEmulatorToBox() calculated charHeight: ",charHeight);
      this.log("resizeEmulatorToBox() element width: ",width);
      // this.log("resizeEmulatorToBox() element height: ",this.element.clientHeight);
      this.log("resizeEmulatorToBox() new cols: ",newCols);
      this.log("resizeEmulatorToBox() new rows: ",newRows);
    }
    return {cols: newCols, rows: newRows};
  }
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  private scrollTo(x: number, y: number): void {
    this._codeMirror.scrollTo(x, y);
  }
  
  // VirtualScrollable
  setScrollOffset(y: number): void {
// this.log("setScrollOffset(" + y + ")");
    this.scrollTo(0, y);
// this.log("this._codeMirror.getScrollInfo(): " , this._codeMirror.getScrollInfo());
  }
  
  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return this._isEmpty ? 0 : doc.lineCount();
  }
  
  refresh(): void {
    this._codeMirror.refresh();
    this._scrollBugFix();
  }
  
  createdCallback(): void {
    this._initProperties();
    this._instanceId = instanceIdCounter;
    instanceIdCounter++;
  }
  
  attachedCallback(): void {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this._initFontLoading();
    
    const containerDiv = util.getShadowId(this, ID_CONTAINER);

    this.style.height = "0px";
    this._updateFocusable(this._focusable);
    this._exitSelectionMode();

    // Create the CodeMirror instance
    this._codeMirror = CodeMirror( (el: HTMLElement): void => {
      containerDiv.appendChild(el);
    }, {value: "", readOnly: true,  scrollbarStyle: "null", cursorScrollMargin: 0, showCursorWhenSelecting: true});

    this._codeMirror.on("cursorActivity", () => {
      const event = new CustomEvent(EtCodeMirrorViewer.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);
    });
    
    this._codeMirror.on("scroll", () => {
      // Over-scroll bug/feature fix
      const scrollInfo = this._codeMirror.getScrollInfo();
      // console.log("codemirror event scroll:", scrollInfo);
      
      const clientYScrollRange = this._getClientYScrollRange();
      if (scrollInfo.top > clientYScrollRange) {
        this._codeMirror.scrollTo(0, clientYScrollRange);
      }
      util.doLater( this._scrollBugFix.bind(this));
    });
    
    this._codeMirror.on("focus", (instance: CodeMirror.Editor): void => {
      this._emulator.focus();
    });

    this._codeMirror.on("blur", (instance: CodeMirror.Editor): void => {
      this._emulator.blur();
    });

    this._codeMirror.on("keydown", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if (this._mode === Mode.TERMINAL) {
        if (ev.keyCode === 32 && ev.ctrlKey) {
          // Enter selection mode.
          this._enterSelectionMode();
          (<any> ev).codemirrorIgnore = true;
          return;
        }
        
        if (this._isKeyDownForEmulator(ev)) {
          this._emulator.keyDown(ev);
          this._emitKeyboardActivityEvent();
        }  
        
        (<any> ev).codemirrorIgnore = true;
      } else {
        // Selection mode.
        if (ev.keyCode === 27) {
          this._exitSelectionMode();
          (<any> ev).codemirrorIgnore = true;
        }
      }
    });
    
    this._codeMirror.on("keypress", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if (this._mode === Mode.TERMINAL) {
        this._emulator.keyPress(ev);
        (<any> ev).codemirrorIgnore = true;
        this._emitKeyboardActivityEvent();
      }
    });
    
    this._codeMirror.on("keyup", (instance: CodeMirror.Editor, ev: KeyboardEvent): void => {
      if (this._mode === Mode.TERMINAL) {
        // this._emulator.keyUp(ev);
        (<any> ev).codemirrorIgnore = true;
      }
    });
    
    const codeMirrorElement = this._codeMirror.getWrapperElement();
    codeMirrorElement.addEventListener("mousedown", this._handleMouseDownEvent.bind(this), true);
    codeMirrorElement.addEventListener("mouseup", this._handleMouseUpEvent.bind(this), true);
    codeMirrorElement.addEventListener("mousemove", this._handleMouseMoveEvent.bind(this), true);
    
    this._codeMirror.on("scrollCursorIntoView", (instance: CodeMirror.Editor, ev: Event): void => {
      ev.preventDefault();
    });
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
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
          width: 100%;
          white-space: normal;
        }
        
        #${ID_CONTAINER} {
/*          height: 100%; */
          width: 100%;
          overflow: hidden;
        }
        
        /* The idea is that this rule will be quickly applied. We can then monitor
           the computed style to see when the proper theme font is applied and
           NO_STYLE_HACK disappears from the reported computed style. */
        .terminal {
          font-family: sans-serif, ${NO_STYLE_HACK};
        }
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        
        #${ID_CONTAINER}.${CLASS_HIDE_CURSOR} .CodeMirror-cursors {
            display: none !important;
        }
        
        #${ID_CONTAINER}.${CLASS_HIDE_CURSOR} .CodeMirror-lines {
          cursor: default;
        }
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <style id="${ID_IMPORT_STYLE}">
        @import url('node_modules/codemirror/lib/codemirror.css');
        @import url('node_modules/codemirror/addon/scroll/simplescrollbars.css');
        @import url('themes/default/theme.css');
        </style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _enterSelectionMode(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.remove(CLASS_HIDE_CURSOR);
    
    const dimensions = this._emulator.getDimensions();
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line: dimensions.cursorY + this._terminalFirstRow, ch: dimensions.cursorX } );

    this._mode = Mode.SELECTION;
  }

  private _exitSelectionMode(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.add(CLASS_HIDE_CURSOR);
    this._mode = Mode.TERMINAL;
  }
  
  private _emitVirtualResizeEvent(): void {
    const scrollInfo = this._codeMirror.getScrollInfo();    
    const detail: ResizeDetail = { height: scrollInfo.height };
    const event = new CustomEvent(EtCodeMirrorViewer.EVENT_RESIZE, { detail: detail });
    this.dispatchEvent(event);
  }
  
  private _emitKeyboardActivityEvent(): void {
    const scrollInfo = this._codeMirror.getScrollInfo();    
    const event = new CustomEvent(EtCodeMirrorViewer.EVENT_KEYBOARD_ACTIVITY, { });
    this.dispatchEvent(event);
  }
  
  private _isKeyDownForEmulator(ev: KeyboardEvent): boolean {
    if (ev.keyCode === 16                                   // Shift key
        || ev.keyCode === 17                                // Ctrl key
        || ev.keyCode === 33 && ev.shiftKey                 // Page up
        || ev.keyCode === 34 && ev.shiftKey                 // Page down
        || ev.keyCode === 67 && ev.ctrlKey && ev.shiftKey   // Shift+Ctrl+C
        || ev.keyCode === 86 && ev.ctrlKey && ev.shiftKey) {// Shift+Ctrl+V
      return false;
    }
    return true;
  }

  private _handleEmulatorMouseEvent(ev: MouseEvent, emulatorHandler: (opts: termjs.MouseEventOptions) => void): void {
    
    if ( ! this.hasFocus()) {
      this.focus();
    }
    
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
    const options: termjs.MouseEventOptions = {
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
    }
  }
  
  private _handleMouseDownEvent(ev: MouseEvent): void {
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseDown.bind(this._emulator));
  }
  
  private _handleMouseUpEvent(ev: MouseEvent): void {
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseUp.bind(this._emulator));
  }
  
  private _handleMouseMoveEvent(ev: MouseEvent): void {
    this._handleEmulatorMouseEvent(ev, this._emulator.mouseMove.bind(this._emulator));
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
    this._importStyleLoaded = false;
    
    util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
      this._mainStyleLoaded = true;
      this._handleStyleLoad();
    });

    util.getShadowId(this, ID_IMPORT_STYLE).addEventListener('load', () => {
      this._importStyleLoaded = true;
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
    if (this._mainStyleLoaded && this._importStyleLoaded) {
      // Start polling the term for application of the font.
      this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  private _effectiveFontFamily(): string {
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    const cs = window.getComputedStyle(containerDiv, null);
    return cs.getPropertyValue("font-family");
  }

  private _resizePoll(): void {
    if (this._mainStyleLoaded && this._importStyleLoaded) {
      if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
        this._codeMirror.defaultTextHeight(); // tickle the DOM to maybe force CSS recalc.
        window.setTimeout(this.resizeEmulatorToParentContainer.bind(this), 100);  // 100ms
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

  private _handleRenderEvent(instance: termjs.Emulator, event: termjs.RenderEvent): void {
    let emitVirtualResizeEventFlag = false;
    
    this._codeMirror.operation( () => {
      emitVirtualResizeEventFlag = this._handleSizeEvent(event.rows, event.columns, event.realizedRows);

      // Refresh the active part of the screen.
      const startRow = event.refreshStartRow;
      if (startRow !== -1) {
        const endRow = event.refreshEndRow;
        const lines: termjs.Line[] = [];
        for (let row = startRow; row < endRow; row++) {
          lines.push(this._emulator.lineAtRow(row));
        }
        this._insertLinesOnScreen(startRow, endRow, lines);
      }
      
      if (event.scrollbackLines !== null && event.scrollbackLines.length !== 0) {
        this._handleScrollbackEvent(event.scrollbackLines);
        emitVirtualResizeEventFlag = true;
      }
    });
    
    if (emitVirtualResizeEventFlag) {
      this._emitVirtualResizeEvent();
    }
  }
  
  private _handleSizeEvent(newRows: number, newColumns: number, realizedRows: number): boolean {
    if (this._rows === newRows && this._columns === newColumns && this._realizedRows === realizedRows) {
      return false; // Nothing to do.
    }
    
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();

    if (lineCount - this._terminalFirstRow > newRows) {
      // Trim off the extra lines.
      const startPos = this._terminalFirstRow === 0 ? { line: this._terminalFirstRow + newRows, ch: 0 }
        : { line: this._terminalFirstRow + newRows -1, ch: doc.getLine(this._terminalFirstRow + newRows-1).length };
      const endPos = { line: lineCount-1, ch: doc.getLine(lineCount-1).length };
      doc.replaceRange("", startPos, endPos);
    }
    
    this._rows = newRows;
    this._columns = newColumns;
    this._realizedRows = realizedRows;
    
    return true;
  }

  private _handleScrollbackEvent(scrollbackLines: termjs.Line[]): void {
    const pos: CodeMirror.Position = { line: this._terminalFirstRow, ch: 0 };
    const {text: text, decorations: decorations} = this._linesToTextStyles(scrollbackLines);
    this._codeMirror.operation( () => {
      this._insertLinesAtPos(pos ,pos, text + "\n", decorations);
    });
    this._terminalFirstRow = this._terminalFirstRow  + scrollbackLines.length;
  }

  private _insertLinesOnScreen(startRow: number, endRow: number,lines: termjs.Line[]): void {
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
      this._isEmpty = false;
    }

    const {text: text, decorations: decorations} = this._linesToTextStyles(lines);
    const startPos = { line: this._terminalFirstRow + startRow, ch: 0 };
    const endPos = { line: this._terminalFirstRow + endRow -1, ch: doc.getLine(this._terminalFirstRow + endRow -1).length };
    this._insertLinesAtPos(startPos, endPos, text, decorations);
  }
  
  private _insertLinesAtPos(startPos: CodeMirror.Position, endPos: CodeMirror.Position, text: string,
      decorations: TextDecoration[]): void {
// console.log("_insertLinesAtPos: startPos: ",startPos, " endPos: ", endPos, " text: |"+text+"|");

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
    
    // console.log("lineCount: " + doc.lineCount());
    // console.log("______________________________________");
    // console.log(doc.getValue());
    // console.log("______________________________________");    
  }
  
  private _updateFocusable(focusable: boolean): void {
    // const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
  }

  private _scrollBugFix(): void {
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    containerDiv.scrollTop = 0;
  }

  private getVirtualTextHeight(): number {
    return this._isEmpty ? 0 : this._codeMirror.defaultTextHeight() * this.lineCount();
  }
  
  private _getClientYScrollRange(): number {
    return Math.max(0, this.getVirtualHeight(this.getHeight()) - this.getHeight());
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null) {
      return;
    }
    const elementHeight = this.getHeight();
    if (elementHeight !== this._currentElementHeight) {
      this._currentElementHeight = elementHeight;
      this.style.height = "" + elementHeight + "px";
      
      const totalTextHeight = this.getVirtualTextHeight();
      let codeMirrorHeight;
      if (this._useVPad && totalTextHeight > elementHeight) {
        // Adjust the height of the code mirror such that a small gap is at the bottom to 'push'
        // the lines up and align them with the top of the viewport.
        codeMirrorHeight = elementHeight - (elementHeight % this._codeMirror.defaultTextHeight());
      } else {
        codeMirrorHeight = elementHeight;        
      }

      const containerDiv = util.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + codeMirrorHeight + "px";
      this._codeMirror.setSize("100%", "" + codeMirrorHeight + "px");
      this._codeMirror.refresh();
    }
  }
    
  _themeCssSet(): void {  
    // const themeTag = <HTMLStyleElement> util.getShadowId(this, ID_THEME_STYLE);
    // if (themeTag !== null) {
    //   themeTag.innerHTML = this.getThemeCss();
    // }
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
    const defAttr = termjs.Emulator.defAttr;
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
          const classList: string[] = [];
          if (data === -1) {
            // Cursor itself
            classList.push("reverse-video");
            classList.push("terminal-cursor");
          } else {
          
            let bg = termjs.backgroundFromCharAttr(data);
            let fg = termjs.foregroundFromCharAttr(data);
            const flags = termjs.flagsFromCharAttr(data);
            
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
  
  private log(msg: any, ...opts: any[]): void {
    console.log("[codemirrorviewer: " + this._instanceId + "] " + msg, ...opts);
  }  
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  

export = EtCodeMirrorViewer;
