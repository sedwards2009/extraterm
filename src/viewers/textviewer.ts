/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import _  = require('lodash');
import fs = require('fs');
import path = require('path');

import textencoding = require('text-encoding');
import utf8encoding = require('../utf8encoding');

import sourceDir = require('../sourceDir');
import ViewerElement = require("../viewerelement");
import ThemeableElementBase = require('../themeableelementbase');
import util = require("../gui/util");
import domutils = require("../domutils");
import ThemeTypes = require('../theme');
import CodeMirror = require('codemirror');
import ViewerElementTypes = require('../viewerelementtypes');
import EtTextViewerTypes = require('./terminalviewertypes');
import virtualscrollarea = require('../virtualscrollarea');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');
import generalevents = require('../generalevents');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type SetterState = virtualscrollarea.SetterState;
const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;
type TextDecoration = EtTextViewerTypes.TextDecoration;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

const ID = "CbTextViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const CLASS_HIDE_CURSOR = "hide_cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";

const KEYBINDINGS_SELECTION_MODE = "text-viewer";
const COMMAND_TYPE_AND_CR_SELECTION = "typeSelectionAndCr";
const COMMAND_TYPE_SELECTION = "typeSelection";
const COMMANDS = [
  COMMAND_TYPE_AND_CR_SELECTION,
  COMMAND_TYPE_SELECTION
];

const NO_STYLE_HACK = "NO_STYLE_HACK";

const DEBUG_RESIZE = false;

const log = LogDecorator;

let registered = false;

let cssText: string = null;

function getCssText(): string {
  return cssText;
}

// CodeMirror mode management.
const meta = require('codemirror/mode/meta');
const loadedCodeMirrorModes = new Set<string>();

function LoadCodeMirrorMode(modeName: string): void {
  if (loadedCodeMirrorModes.has(modeName)) {
    return;
  }
  require('codemirror/mode/' + modeName + '/' + modeName);
  loadedCodeMirrorModes.add(modeName);
}

class EtTextViewer extends ViewerElement {

  static TAG_NAME = "et-text-viewer";
  
  static init(): void {
    if (registered === false) {
      
      // Load the CSS resources now.
      cssText = fs.readFileSync(require.resolve('codemirror/lib/codemirror.css'), { encoding: 'utf8' })
        + fs.readFileSync(require.resolve('codemirror/addon/scroll/simplescrollbars.css'), { encoding: 'utf8' });

      window.document.registerElement(EtTextViewer.TAG_NAME, {prototype: EtTextViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is EtTextViewer {
    return node !== null && node !== undefined && node instanceof EtTextViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  private _text: string;
  private _mimeType: string;
  
  private _commandLine: string; // FIXME needed?
  private _returnCode: string;  // FIXME needed?
  private _codeMirror: CodeMirror.Editor;
  private _height: number;
  private _isEmpty: boolean;
  private _mode: ViewerElementTypes.Mode;
  private _editable: boolean;
  private document: Document;
  private _visualState: VisualState;

  private _mainStyleLoaded: boolean;
  private _resizePollHandle: domutils.LaterHandle;

  private _lastCursorAnchorPosition: CodeMirror.Position;
  private _lastCursorHeadPosition: CodeMirror.Position;
  private _viewportHeight: number;  // Used to detect changes in the viewport size when in SELECTION mode.
  
  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight: number;

  private _initProperties(): void {
    this._text = null;
    this._mimeType = null;
    this._log = new Logger(EtTextViewer.TAG_NAME);
    this._commandLine = null;
    this._returnCode  =null;
    this._editable = false;
    this._codeMirror = null;
    this._height = 0;
    this._isEmpty = false;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
    this.document = document;
    this._visualState = VisualState.AUTO;
    
    this._currentElementHeight = -1;
    
    this._mainStyleLoaded = false;
    this._resizePollHandle = null;
    
    this._lastCursorAnchorPosition = null;
    this._lastCursorHeadPosition = null;
    this._viewportHeight = -1;
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
      return "Text";
    }
  }
  
  get awesomeIcon(): string {
    return "file-text-o";
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

  focus(): void {
    this._codeMirror.focus();
  }

  hasFocus(): boolean {
    const hasFocus = this._codeMirror.getInputField() === domutils.getShadowRoot(this).activeElement;
    return hasFocus;
  }
  
  set visualState(newVisualState: number) {
    this._setVisualState(newVisualState);
  }
  
  get visualState(): number {
    return this._visualState;
  }
  
  get text(): string {
    return this._codeMirror.getDoc().getValue();
  }
  
  set text(newText: string) {
    if (this._codeMirror === null) {
      this._text = newText;
    } else {
      this._codeMirror.getDoc().setValue(newText);
    }
  }
  
  set mimeType(mimeType: string) {
    this._mimeType = mimeType;
    
    const modeInfo = CodeMirror.findModeByMIME(mimeType);
    if (modeInfo.mode !== undefined && modeInfo.mode !== null && modeInfo.mode !== "null") {
      LoadCodeMirrorMode(modeInfo.mode);
      if (this._codeMirror !== null) {
        this._codeMirror.setOption("mode", mimeType);
      }
    }
  }
  
  get mimeType(): string {
    return this._mimeType;
  }
  
  setBytes(buffer: Uint8Array, mimeType: string): void {
    let charset = "utf-8";
    let cleanMimeType = mimeType;
    if (mimeType.indexOf(';') !== -1) {
      charset = mimeType.slice(mimeType.indexOf(';') + 1);
      cleanMimeType = mimeType.slice(0, mimeType.indexOf(';'));
    }
    
    let decodedString: string;
    if (charset === 'utf8' || charset === 'utf-8') {
      decodedString = utf8encoding.decodeUint8Array(buffer);
    } else {
      const decoder = textencoding.TextDecoder(charset);
      decodedString = decoder.decode(buffer);
    }
    
    this.text = decodedString;
    this.mimeType = cleanMimeType;
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
  
  set editable(editable: boolean) {
    this._editable = editable;
    if (this._mode === ViewerElementTypes.Mode.SELECTION) {
      this._codeMirror.setOption("readOnly", ! editable);
    }
  }
  
  get editable(): boolean {
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
  getMinHeight(): number {
    return 0;
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
    if (DEBUG_RESIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (setterState.heightChanged || setterState.yOffsetChanged) {
      if (DEBUG_RESIZE) {
        this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
          setterState.yOffset, setterState.yOffsetChanged);
      }
        
      this._adjustHeight(setterState.height);
      this.scrollTo(0, setterState.yOffset);
    }
  }
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return this._isEmpty ? 0 : doc.lineCount();
  }
  
  refresh(): void {
    this._codeMirror.refresh();
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
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    const mode = CodeMirror.findModeByMIME(mimeType);
    return mode !== null && mode !== undefined;
  }
  
  deleteTopPixels(topPixels: number): void {
    const defaultTextHeight = this._codeMirror.defaultTextHeight();
    const linesToDelete = Math.min(Math.floor(topPixels / defaultTextHeight), this.lineCount());
    const pos = { line: 0, ch: 0 };
    const endPos = { line: linesToDelete, ch: 0 };
    this._codeMirror.getDoc().replaceRange("", pos, endPos);
    this._emitVirtualResizeEvent();
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
  }
  
  attachedCallback(): void {
    super.attachedCallback();

    if (domutils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this._initFontLoading();
    this.updateThemeCss();

    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);

    this.style.height = "0px";
    this._exitSelectionMode();

    const codeMirrorOptions: CodeMirror.EditorConfiguration = {
      value: "",
      readOnly: true,
      lineNumbers: true,
      scrollbarStyle: "null",
      cursorScrollMargin: 0,
      showCursorWhenSelecting: true,
      styleActiveLine: true,
      theme: "text",
      keyMap: this._codeMirrorKeyMap()
    };

    if (this._mimeType !== null) {
      codeMirrorOptions.mode = this._mimeType;
    }

    // Create the CodeMirror instance
    this._codeMirror = CodeMirror( (el: HTMLElement): void => {
      containerDiv.appendChild(el);
    }, codeMirrorOptions);

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
      if (this._visualState === VisualState.AUTO) {
        const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
        containerDiv.classList.add(CLASS_FOCUSED);
        containerDiv.classList.remove(CLASS_UNFOCUSED);
      }
    });

    this._codeMirror.on("blur", (instance: CodeMirror.Editor): void => {
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
          domutils.doLater( () => {
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
      if (this._mode !== ViewerElementTypes.Mode.SELECTION) {
        return;
      }
      
      const height = to - from;
      if (height !== this._viewportHeight) {
        this._viewportHeight = height;
        domutils.doLater(this._emitVirtualResizeEvent.bind(this));
      }
    });
    
    // Filter the keyboard events before they reach CodeMirror.
    containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
    
    const codeMirrorElement = this._codeMirror.getWrapperElement();
    
    this._codeMirror.on("scrollCursorIntoView", (instance: CodeMirror.Editor, ev: Event): void => {
      ev.preventDefault();
    });
        
    this._applyVisualState(this._visualState);

    if (this._text !== null) {
      this._log.debug("setting text");
      this._codeMirror.getDoc().setValue(this._text);
      domutils.doLater(this._emitVirtualResizeEvent.bind(this));
      this._text = null;
    }

    this._adjustHeight(this._height);
  }

  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    super.detachedCallback();
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TEXT_VIEWER];
  }
  
  resize(): void {
    if (this._codeMirror !== null) {
      if (DEBUG_RESIZE) {
        this._log.debug("calling codeMirror.refresh()");
      }
      this._codeMirror.refresh();
    }
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

        /* The idea is that this rule will be quickly applied. We can then monitor
           the computed style to see when the proper theme font is applied and
           NO_STYLE_HACK disappears from the reported computed style. */
        .terminal {
          font-family: sans-serif, ${NO_STYLE_HACK};
        }

        ${getCssText()}
        </style>
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer ${CLASS_UNFOCUSED}"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _setVisualState(newVisualState: number): void {
    if (newVisualState === this._visualState) {
      return;
    }    

    if (domutils.getShadowRoot(this) !== null) {
      this._applyVisualState(newVisualState);
    }    
    this._visualState = newVisualState;
  }
  
  private _applyVisualState(visualState: number): void {
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    if ((visualState === VisualState.AUTO && this.hasFocus()) ||
        visualState === VisualState.FOCUSED) {

      containerDiv.classList.add(CLASS_FOCUSED);
      containerDiv.classList.remove(CLASS_UNFOCUSED);
    } else {
      containerDiv.classList.add(CLASS_UNFOCUSED);
      containerDiv.classList.remove(CLASS_FOCUSED);
    }
  }
  
  private _enterSelectionMode(): void {
    const containerDiv = <HTMLDivElement> domutils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.remove(CLASS_HIDE_CURSOR);
    
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line: doc.lineCount()-1, ch: 0 } );
    
    this._lastCursorHeadPosition = this._codeMirror.getDoc().getCursor("head");
    this._lastCursorAnchorPosition = this._codeMirror.getDoc().getCursor("anchor");
    if (this._editable) {
      this._codeMirror.setOption("readOnly", false);
    }
    this._mode = ViewerElementTypes.Mode.SELECTION;
  }

  private _exitSelectionMode(): void {
    if (this._codeMirror !== null) {
      this._codeMirror.setOption("readOnly", true);
    }

    const containerDiv = <HTMLDivElement> domutils.getShadowId(this, ID_CONTAINER);
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
  
  private _emitBeforeSelectionChangeEvent(originMouse: boolean): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { detail: { originMouse: originMouse },
      bubbles: true });
    this.dispatchEvent(event);
  }

  private scrollTo(x: number, y: number): void {
    if (domutils.getShadowRoot(this) === null) {
      return;
    }
    this._codeMirror.scrollTo(x, y);
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
    if (this.keyBindingContexts === null) {
      return {};  // empty keymap
    }
    
    const keyBindings = this.keyBindingContexts.context(KEYBINDINGS_SELECTION_MODE);
    if (keyBindings === null) {
      return {};
    }

    const codeMirrorKeyMap = keyBindings.keyBindings
          .filter( (binding) => COMMANDS.indexOf(binding.command) === -1)
          .reduce( (accu, binding) => {
            accu[binding.shortcutCode] = binding.command;
            return accu;
          }, {});
    return codeMirrorKeyMap;
  }
    
  public dispatchEvent(ev: Event): boolean {
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
    }
  }
  
  private _scheduleSyntheticKeyDown(ev: KeyboardEvent): void {
    domutils.doLater( () => {
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
  
  private _handleContainerKeyDown(ev: KeyboardEvent): void {
    if (this._mode !== ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
    }
  }

  private _handleContainerKeyDownCapture(ev: KeyboardEvent): void {
    if (this.keyBindingContexts !== null && this._mode === ViewerElementTypes.Mode.SELECTION) {
      const keyBindings = this.keyBindingContexts.context(KEYBINDINGS_SELECTION_MODE);
      if (keyBindings !== null) {
        const command = keyBindings.mapEventToCommand(ev);
        switch (command) {
          case COMMAND_TYPE_AND_CR_SELECTION:
          case COMMAND_TYPE_SELECTION:
            ev.stopPropagation();
            const text = this._codeMirror.getDoc().getSelection();
            if (text !== "") {
              if (command === COMMAND_TYPE_AND_CR_SELECTION) {
                // Exit selection mode.
                const setModeDetail: generalevents.SetModeEventDetail = { mode: ViewerElementTypes.Mode.DEFAULT };
                const setModeEvent = new CustomEvent(generalevents.EVENT_SET_MODE, { detail: setModeDetail });
                setModeEvent.initCustomEvent(generalevents.EVENT_SET_MODE, true, true, setModeDetail);
                this.dispatchEvent(setModeEvent);
              }              
              const typeTextDetail: generalevents.TypeTextEventDetail =
                                      { text: text + (command === COMMAND_TYPE_AND_CR_SELECTION ? "\n" : "") };
              const typeTextEvent = new CustomEvent(generalevents.EVENT_TYPE_TEXT, { detail: typeTextDetail });
              typeTextEvent.initCustomEvent(generalevents.EVENT_TYPE_TEXT, true, true, typeTextDetail);
              this.dispatchEvent(typeTextEvent);
            }            
            return;
            
          default:
            break;
        }
      }
    }

    // Send all Alt+* and Ctrl+Shift+A-Z keys above
    if (ev.altKey || (ev.ctrlKey && ev.shiftKey && ev.keyCode >= 65 && ev.keyCode <= 90)) {
      ev.stopPropagation();
      this._scheduleSyntheticKeyDown(ev);
      return;
    }
    
    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
     // Emit a key down event which our parent elements can catch.
     this._scheduleSyntheticKeyDown(ev);
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
    
    domutils.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
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
      this._resizePollHandle = domutils.doLaterFrame(this._resizePoll.bind(this));
    }
  }
  
  private _effectiveFontFamily(): string {
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    const cs = window.getComputedStyle(containerDiv, null);
    return cs.getPropertyValue("font-family");
  }

  private _resizePoll(): void {
    if (this._mainStyleLoaded) {
      if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = domutils.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
// FIXME do we need to do anything here?
      }
    }
  }
  
  private getVirtualTextHeight(): number {
    if (domutils.getShadowRoot(this) === null) {
      return 8;
    }
    return this._isEmpty ? 0 : this._codeMirror.defaultTextHeight() * this.lineCount();
  }
  
  private _getClientYScrollRange(): number {
    return Math.max(0, this.getVirtualHeight(this.getHeight()) - this.getHeight() + this.getReserveViewportHeight(this.getHeight()));
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || domutils.getShadowRoot(this) === null) {
      return;
    }
    const elementHeight = this.getHeight();
    if (elementHeight !== this._currentElementHeight) {
      this._currentElementHeight = elementHeight;
      this.style.height = "" + elementHeight + "px";
      
      const totalTextHeight = this.getVirtualTextHeight();
      let codeMirrorHeight;
      codeMirrorHeight = elementHeight;        

      const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
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
  
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  

export = EtTextViewer;
