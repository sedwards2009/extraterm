/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import _  = require('lodash');
import fs = require('fs');
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");
import CodeMirror = require('codemirror');
import ViewerElementTypes = require('../viewerelementtypes');
import EtCodeMirrorViewerTypes = require('./codemirrorviewertypes');
import termjs = require('../term');
import virtualscrollarea = require('../virtualscrollarea');
import Logger = require('../logger');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type TextDecoration = EtCodeMirrorViewerTypes.TextDecoration;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

const ID = "CbCodeMirrorViewerTemplate";
const ID_CONTAINER = "container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";
const CLASS_HIDE_CURSOR = "hide_cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";

const NO_STYLE_HACK = "NO_STYLE_HACK";

const DEBUG_RESIZE = false;

let registered = false;
let instanceIdCounter = 0;
let cssText: string = null;

function getCssText(): string {
  return cssText;
}

class EtCodeMirrorViewer extends ViewerElement {

  static TAG_NAME = "et-codemirror-viewer";
  
  static EVENT_KEYBOARD_ACTIVITY = "keyboard-activity";

  static init(): void {
    if (registered === false) {
      
      // Load the CSS resources now.
      cssText = fs.readFileSync('node_modules/codemirror/lib/codemirror.css', { encoding: 'utf8' })
        + fs.readFileSync('node_modules/codemirror/addon/scroll/simplescrollbars.css', { encoding: 'utf8' })
        + fs.readFileSync('themes/default/theme.css', { encoding: 'utf8' });

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
  private _log: Logger;
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
  private _mode: ViewerElementTypes.Mode;
  private document: Document;
  private _useVPad: boolean;
  private _visualState: number;

  private _mainStyleLoaded: boolean;
  private _resizePollHandle: util.LaterHandle;
  
  // Emulator dimensions
  private _rows: number;
  private _columns: number;
  private _realizedRows: number;

  private _lastCursorAnchorPosition: CodeMirror.Position;
  private _lastCursorHeadPosition: CodeMirror.Position;
  
  // The current element height. This is a cached value used to prevent touching the DOM.  
  private _currentElementHeight: number;
  private _renderEventListener: termjs.RenderEventHandler = this._handleRenderEvent.bind(this);

  private _initProperties(): void {
    this._log = new Logger(EtCodeMirrorViewer.TAG_NAME);
    this._emulator = null;
    this._terminalFirstRow = 0;
    this._mutationObserver = null;  
    this._commandLine = null;
    this._returnCode  =null;
    this._focusable = false;
    this._codeMirror = null;
    this._height = 0;
    this._isEmpty = true;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
    this.document = document;
    this._useVPad = true;
    this._visualState = EtCodeMirrorViewer.VISUAL_STATE_AUTO;
    
    this._currentElementHeight = -1;
    
    this._mainStyleLoaded = false;
    this._resizePollHandle = null;
    
    this._rows = -1;
    this._columns = -1;
    this._realizedRows = -1;
    this._lastCursorAnchorPosition = null;
    this._lastCursorHeadPosition = null;
    
    this._renderEventListener = null;
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
  
  set visualState(newVisualState: number) {
    this._setVisualState(newVisualState);
  }
  
  get visualState(): number {
    return this._visualState;
  }
  
  set emulator(emulator: termjs.Emulator) {
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

  get emulator(): termjs.Emulator {
    return this._emulator;
  }
  
  set mode(newMode: ViewerElementTypes.Mode) {
    if (newMode === this._mode) {
      return;
    }
    
    switch (newMode) {
      case ViewerElementTypes.Mode.SELECTION:
        // Enter selection mode.
        this._enterSelectionMode();
        break;
        
      case ViewerElementTypes.Mode.DEFAULT:
        this._exitSelectionMode();
        break;
    }
    this._mode = newMode;
  }
  
  get mode(): ViewerElementTypes.Mode {
    return this._mode;
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
    if (DEBUG_RESIZE) {
      this._log.debug("setHeight: ",newHeight);
    }
    this._adjustHeight(newHeight);
  }

  getMinHeight(): number {
    return 0;
  }

  set useVPad(use: boolean) {
    this._useVPad = use;
  }

  /**
   * Gets the height of the scrollable contents on this element.
   *
   * @return {number} [description]
   */
  getVirtualHeight(containerHeight: number): number {
    const result = this.getVirtualTextHeight();
    if (DEBUG_RESIZE) {
      this._log.debug("getVirtualHeight: ",result);
    }
    return result;
  }
  
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
  
  resizeEmulatorToParentContainer(): void {
    if (DEBUG_RESIZE) {
      this._log.debug("resizeEmulatorToParentContainer: ", this._emulator === null ? "(no emulator)" : "(have emulator)");
    }
    if (this._emulator !== null) {
      this.resizeEmulatorToBox(this.parentElement.clientWidth, this.parentElement.clientHeight);
    }
  }

  /**
   * Resize the terminal to fill a given pixel box size.
   * 
   * @returns Object with the new colums (cols field) and rows (rows field) information.
   */
  resizeEmulatorToBox(widthPixels: number, heightPixels: number): {cols: number; rows: number;} {
    const {columns: cols, rows: rows} = this.emulator.size();
    
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
      this.emulator.resize( { rows: newRows, columns: newCols } );
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
  
  createdCallback(): void {
    this._initProperties();
    this._instanceId = instanceIdCounter;
    instanceIdCounter++;
    this._renderEventListener = this._handleRenderEvent.bind(this);
  }
  
  attachedCallback(): void {
    if (util.getShadowRoot(this) !== null) {
      return;
    }
    
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
      if (this._mode !== ViewerElementTypes.Mode.DEFAULT) {
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
      
      if (this._visualState === ViewerElement.VISUAL_STATE_AUTO) {
        const containerDiv = util.getShadowId(this, ID_CONTAINER);
        containerDiv.classList.add(CLASS_FOCUSED);
        containerDiv.classList.remove(CLASS_UNFOCUSED);
      }
    });

    this._codeMirror.on("blur", (instance: CodeMirror.Editor): void => {
      if (this._emulator !== null) {
        this._emulator.blur();
      }
      
      if (this._visualState === ViewerElement.VISUAL_STATE_AUTO) {
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
      this._emitBeforeSelectionChangeEvent();
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
          util.doLater( () => {
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
    
    // Filter the keyboard events before they reach CodeMirror.
    containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('keypress', this._handleContainerKeyPressCapture.bind(this), true);
    containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
    
    const codeMirrorElement = this._codeMirror.getWrapperElement();
    codeMirrorElement.addEventListener("mousedown", this._handleMouseDownEvent.bind(this), true);
    codeMirrorElement.addEventListener("mouseup", this._handleMouseUpEvent.bind(this), true);
    codeMirrorElement.addEventListener("mousemove", this._handleMouseMoveEvent.bind(this), true);
    
    this._codeMirror.on("scrollCursorIntoView", (instance: CodeMirror.Editor, ev: Event): void => {
      ev.preventDefault();
    });
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
        
        ${getCssText()}
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer terminal ${CLASS_UNFOCUSED}"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _setVisualState(newVisualState: number): void {
    if (newVisualState === this._visualState) {
      return;
    }
    
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    if ((newVisualState === EtCodeMirrorViewer.VISUAL_STATE_AUTO && this.hasFocus()) ||
        newVisualState === EtCodeMirrorViewer.VISUAL_STATE_FOCUSED) {

      containerDiv.classList.add(CLASS_FOCUSED);
      containerDiv.classList.remove(CLASS_UNFOCUSED);
    } else {
      containerDiv.classList.add(CLASS_UNFOCUSED);
      containerDiv.classList.remove(CLASS_FOCUSED);
    }
    
    this._visualState = newVisualState;
  }
  
  private _enterSelectionMode(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
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

    this._mode = ViewerElementTypes.Mode.SELECTION;
  }

  private _exitSelectionMode(): void {
    const containerDiv = <HTMLDivElement> util.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.add(CLASS_HIDE_CURSOR);
    this._mode = ViewerElementTypes.Mode.DEFAULT;
  }
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_RESIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }
    const event = new CustomEvent(virtualscrollarea.EVENT_RESIZE, { bubbles: true });
    this.dispatchEvent(event);
  }
  
  private _emitKeyboardActivityEvent(): void {
    const scrollInfo = this._codeMirror.getScrollInfo();    
    const event = new CustomEvent(EtCodeMirrorViewer.EVENT_KEYBOARD_ACTIVITY, { bubbles: true });
    this.dispatchEvent(event);
  }

  private _emitBeforeSelectionChangeEvent(): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  private scrollTo(x: number, y: number): void {
    this._codeMirror.scrollTo(x, y);
  }
  
  private _handleEmulatorMouseEvent(ev: MouseEvent, emulatorHandler: (opts: termjs.MouseEventOptions) => void): void {
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
  
  public dispatchEvent(ev: Event): boolean {
    this._log.debug("codemirrorviewer dispatchEvent: ",ev.type);
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = util.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
    }
  }
  
  private _scheduleSyntheticKeyDown(ev: KeyboardEvent): void {
    util.doLater( () => {
      const fakeKeyDownEvent = domutils.newKeyboardEvent('keydown', {
        bubbles: true,
        key: ev.key,        
        code: ev.code,
        location: ev.location,
        repeat: ev.repeat,
        keyCode: ev.keyCode,
        charCode: ev.charCode,
        keyIdentifier: ev.keyIdentifier,
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
    
    util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
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
      this._resizePollHandle = util.doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  private _effectiveFontFamily(): string {
    const containerDiv = util.getShadowId(this, ID_CONTAINER);
    const cs = window.getComputedStyle(containerDiv, null);
    return cs.getPropertyValue("font-family");
  }

  private _resizePoll(): void {
    if (this._mainStyleLoaded) {
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

    if (lineCount - this._terminalFirstRow > realizedRows) {
      // Trim off the extra lines.
      const startPos = this._terminalFirstRow === 0
        ? { line: this._terminalFirstRow + realizedRows, ch: 0 }
        : { line: this._terminalFirstRow + realizedRows -1, ch: doc.getLine(this._terminalFirstRow + realizedRows-1).length };
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
    }

    const {text: text, decorations: decorations} = this._linesToTextStyles(lines);
    const startPos = { line: this._terminalFirstRow + startRow, ch: 0 };
    const endPos = { line: this._terminalFirstRow + endRow -1, ch: doc.getLine(this._terminalFirstRow + endRow -1).length };
    this._insertLinesAtPos(startPos, endPos, text, decorations);

    this._isEmpty = false;
  }
  
  private _insertLinesAtPos(startPos: CodeMirror.Position, endPos: CodeMirror.Position, text: string,
      decorations: TextDecoration[]): void {
// this._log.debug("_insertLinesAtPos: startPos: ",startPos, " endPos: ", endPos, " text: |"+text+"|");

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
    
    // this._log.debug("lineCount: " + doc.lineCount());
    // this._log.debug("______________________________________");
    // this._log.debug(doc.getValue());
    // this._log.debug("______________________________________");    
  }
  
  private _deleteScreen(): void {
    if (this._isEmpty) {
      return;
    }
    
    const doc = this._codeMirror.getDoc();
    const lineCount = doc.lineCount();
    const endPos = { line: lineCount-1, ch: doc.getLine(lineCount-1).length };
    if (this._terminalFirstRow === 0) {
      const startPos = { line: this._terminalFirstRow, ch: 0 };
      doc.replaceRange("", startPos, endPos);  
      this._isEmpty = true;
    } else {
      // Start deleting from the end of the row before the top of the terminal.
      const startPos = { line: this._terminalFirstRow-1, ch: doc.getLine(this._terminalFirstRow-1).length };
      doc.replaceRange("", startPos, endPos);
    }
  }
  
  private _updateFocusable(focusable: boolean): void {
    // const containerDiv = util.getShadowId(this, ID_CONTAINER);
    // containerDiv.setAttribute('tabIndex', focusable ? "-1" : "");
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
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  

export = EtCodeMirrorViewer;
