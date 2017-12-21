/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import * as CodeMirror from 'codemirror';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as SourceDir from '../../SourceDir';
import {WebComponent} from 'extraterm-web-component-decorators';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
import * as BulkFileUtils from '../bulk_file_handling/BulkFileUtils';
import * as CodeMirrorCommands from '../codemirror/CodeMirrorCommands';
import * as CodeMirrorUtils from '../codemirror/CodeMirrorUtils';
import {Commandable, CommandEntry, COMMAND_OPEN_COMMAND_PALETTE, dispatchCommandPaletteRequest}
from '../CommandPaletteRequestTypes';
import * as DomUtils from '../DomUtils';
import * as ExtensionApi from 'extraterm-extension-api';
import * as GeneralEvents from '../GeneralEvents';
import {KeyBindingManager, AcceptsKeyBindingManager, MinimalKeyboardEvent} from '../keybindings/KeyBindingManager';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import {TextDecoration} from './TerminalViewerTypes';
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as Util from '../gui/Util';
import {ViewerElement, ViewerElementMetadata} from '../viewers/ViewerElement';
import * as ViewerElementTypes from '../viewers/ViewerElementTypes';
import {emitResizeEvent as VirtualScrollAreaEmitResizeEvent, SetterState, VirtualScrollable} from '../VirtualScrollArea';

const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

const ID = "EtTextViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const CLASS_HIDE_CURSOR = "hide_cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";

const KEYBINDINGS_CURSOR_MODE = "text-viewer";
const PALETTE_GROUP = "textviewer";
const COMMAND_TYPE_AND_CR_SELECTION = "typeSelectionAndCr";
const COMMAND_TYPE_SELECTION = "typeSelection";

const COMMANDS = [
  COMMAND_TYPE_AND_CR_SELECTION,
  COMMAND_TYPE_SELECTION,
  COMMAND_OPEN_COMMAND_PALETTE
];

const NO_STYLE_HACK = "NO_STYLE_HACK";
const DEBUG_RESIZE = false;

let classInitialized = false;

CodeMirrorCommands.init();

let cssText: string = null;

function getCssText(): string {
  return cssText;
}


const simpleScrollBars = require('codemirror/addon/scroll/simplescrollbars');

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

function init(): void {
  if (classInitialized === false) {
    
    // Load the CSS resources now.
    cssText = fs.readFileSync(require.resolve('codemirror/lib/codemirror.css'), { encoding: 'utf8' })
      + fs.readFileSync(require.resolve('codemirror/addon/scroll/simplescrollbars.css'), { encoding: 'utf8' });

    classInitialized = true;
  }
}


@WebComponent({tag: "et-text-viewer"})
export class TextViewer extends ViewerElement implements Commandable, AcceptsKeyBindingManager,
    SupportsClipboardPaste.SupportsClipboardPaste {

  static TAG_NAME = "ET-TEXT-VIEWER";
  
  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is TextViewer {
    return node !== null && node !== undefined && node instanceof TextViewer;
  }
  
  private _log: Logger;
  private _keyBindingManager: KeyBindingManager = null;
  private _bulkFileHandle: BulkFileHandle = null;
  private _mimeType: string = null;
  
  private _codeMirror: CodeMirror.Editor = null;
  private _height = 0;
  private _isEmpty = false;
  private _mode: ViewerElementTypes.Mode = ViewerElementTypes.Mode.DEFAULT;
  private _editable = false;
  private document: Document;
  private _visualState: VisualState = VisualState.AUTO;

  private _mainStyleLoaded = false;
  private _resizePollHandle: DomUtils.LaterHandle = null;

  private _lastCursorAnchorPosition: CodeMirror.Position = null;
  private _lastCursorHeadPosition: CodeMirror.Position = null;
  private _viewportHeight = -1;  // Used to detect changes in the viewport size when in cursor mode.
  
  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight = -1;

  constructor() {
    super();
    init();

    this._log = getLogger(TextViewer.TAG_NAME, this);
    this.document = document;
  }
  
  getMetadata(): ViewerElementMetadata {
    const metadata = super.getMetadata();
    metadata.title = "Text";
    metadata.icon = "file-text-o";
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = this.attachShadow( { mode: 'open', delegatesFocus: true } );
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this._initFontLoading();
    this.installThemeCss();

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

    this.style.height = "0px";
    this._exitCursorMode();
    this._mode = ViewerElementTypes.Mode.DEFAULT;

    const codeMirrorOptions: CodeMirror.EditorConfiguration = {
      value: "",
      readOnly: true,
      lineNumbers: true,
      scrollbarStyle: "overlay",
      cursorScrollMargin: 0,
      showCursorWhenSelecting: true,
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
      if (this._visualState === VisualState.AUTO) {
        const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
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
        DomUtils.doLater(this._emitVirtualResizeEvent.bind(this));
      }
    });
    
    // Filter the keyboard events before they reach CodeMirror.
    containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
    containerDiv.addEventListener('contextmenu', this._handleContextMenuCapture.bind(this), true);

    const codeMirrorElement = this._codeMirror.getWrapperElement();
    
    this._codeMirror.on("scrollCursorIntoView", (instance: CodeMirror.Editor, ev: Event): void => {
      ev.preventDefault();
    });
        
    this._applyVisualState(this._visualState);

    if (this._bulkFileHandle !== null) {
      this._loadBulkFile(this._bulkFileHandle);
    }

    this._adjustHeight(this._height);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TEXT_VIEWER];
  }
  
  setKeyBindingManager(newKeyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = newKeyBindingManager;
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
    const hasFocus = this._codeMirror.getInputField() === DomUtils.getShadowRoot(this).activeElement;
    return hasFocus;
  }
  
  setVisualState(newVisualState: VisualState): void {
    if (newVisualState !== this._visualState) {
      if (DomUtils.getShadowRoot(this) !== null) {
        this._applyVisualState(newVisualState);
      }    
      this._visualState = newVisualState;
    }
  }
  
  getVisualState(): VisualState {
    return this._visualState;
  }
  
  private _setText(newText: string): void {
    if (this._codeMirror !== null) {
      this._codeMirror.getDoc().setValue(newText);
    }
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

  setMimeType(mimeType: string): void {
    this._mimeType = mimeType;
    
    const modeInfo = CodeMirror.findModeByMIME(mimeType);
    if (modeInfo != null) {
      if (modeInfo.mode !== null && modeInfo.mode !== "null") {
        LoadCodeMirrorMode(modeInfo.mode);
      }
      if (this._codeMirror !== null) {
        this._codeMirror.setOption("mode", mimeType);
      }
    }
  }
  
  getMimeType(): string {
    return this._mimeType;
  }

  getTabSize(): number {
    return parseInt(this._codeMirror.getOption("tabSize"), 10);
  }

  setTabSize(size: number): void {
    this._codeMirror.setOption("tabSize", size);
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    this._loadBulkFile(handle);
  }

  private async _loadBulkFile(handle: BulkFileHandle): Promise<void> {
    this._bulkFileHandle = handle;
    const data = await BulkFileUtils.readDataAsArrayBuffer(handle)
    const {mimeType, charset} = BulkFileUtils.guessMimetype(handle);
    const decodedText = Buffer.from(data).toString(charset);
    this._setText(decodedText);
    this.setMimeType(mimeType);
    this._emitVirtualResizeEvent();
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
        this._log.debug(`setDimensionsAndScroll(): ` +
        `height=${setterState.height}, heightChanged=${setterState.heightChanged}, ` +
        `yOffset=${setterState.yOffset}, yOffsetChanged=${setterState.yOffsetChanged}, ` +
        `physicalTop=${setterState.physicalTop}, physicalTopChanged=${setterState.physicalTopChanged}, ` +
        `containerHeight=${setterState.containerHeight}, ` +
        `containerHeightChanged=${setterState.containerHeightChanged}, ` +
        `visibleBottomOffset=${setterState.visibleBottomOffset}, ` +
        `visibleBottomOffsetChanged=${setterState.visibleBottomOffsetChanged}`);
      }

      // FIXME the commented code makes it go faster but breaks the pop-out frame function and hangs the whole app.
      // const op = () => {
        this._adjustHeight(setterState.height);
        this.scrollTo(0, setterState.yOffset);
      // };
      // if (this._codeMirror !== null) {
      //   this._codeMirror.operation(op);
      // } else {
      //   op();
      // }
    }
    
    if (setterState.visibleBottomOffsetChanged) {
      const shadowRoot = DomUtils.getShadowRoot(this);
      if (shadowRoot !== null) {
        const horizontalScrollbar = <HTMLDivElement> shadowRoot.querySelector("DIV.CodeMirror-overlayscroll-horizontal");
        const offsetFromBottom = Math.max(0,-1*setterState.visibleBottomOffset);
        horizontalScrollbar.style.bottom = "" + offsetFromBottom + "px";
      }
    }
  }
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  lineCount(): number {
    const doc = this._codeMirror.getDoc();
    return this._isEmpty ? 0 : doc.lineCount();
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

    VirtualScrollAreaEmitResizeEvent(this);
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
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer ${CLASS_UNFOCUSED}"></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _applyVisualState(visualState: VisualState): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    if ((visualState === VisualState.AUTO && this.hasFocus()) ||
        visualState === VisualState.FOCUSED) {

      containerDiv.classList.add(CLASS_FOCUSED);
      containerDiv.classList.remove(CLASS_UNFOCUSED);
    } else {
      containerDiv.classList.add(CLASS_UNFOCUSED);
      containerDiv.classList.remove(CLASS_FOCUSED);
    }
  }
  
  private _enterCursorMode(): void {
    const containerDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.classList.remove(CLASS_HIDE_CURSOR);
    
    const doc = this._codeMirror.getDoc();
    doc.setCursor( { line: doc.lineCount()-1, ch: 0 } );
    
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
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_RESIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }

    VirtualScrollAreaEmitResizeEvent(this);
  }
  
  private _emitBeforeSelectionChangeEvent(originMouse: boolean): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { detail: { originMouse: originMouse },
      bubbles: true });
    this.dispatchEvent(event);
  }

  private _getMimeTypeName(): string {
    for (const info of CodeMirror.modeInfo) {
      if (info.mime === this._mimeType) {
        return info.name;
      }
    }
    return this._mimeType;
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

    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    this._codeMirror.scrollTo(xCoord, yCoord);
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
          .filter( (binding) => COMMANDS.indexOf(binding.command) === -1)
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
  
  private _handleContainerKeyDown(ev: KeyboardEvent): void {
    if (this._mode !== ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
    }
  }

  private _handleContainerKeyDownCapture(ev: KeyboardEvent): void {
    let command: string = null;
    if (this._keyBindingManager !== null && this._keyBindingManager.getKeyBindingContexts() !== null  &&
        this._mode === ViewerElementTypes.Mode.CURSOR) {
          
      const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_CURSOR_MODE);
      if (keyBindings !== null) {
        command = keyBindings.mapEventToCommand(ev);
        if (this._executeCommand(command)) {
          ev.stopPropagation();
          return;
        } else {
          if (command !== null) {
            return;
          }
          if (ev.shiftKey) {
            const evWithoutShift: MinimalKeyboardEvent = {
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

  private _handleContextMenuCapture(ev: MouseEvent): void {
    // Prevent CodeMirror from seeing this event and messing with the hidden textarea and the focus.
    ev.stopImmediatePropagation();
    ev.preventDefault();

    this.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
  }
  
  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
    let commandList: CommandEntry[] = [
      { id: COMMAND_TYPE_SELECTION, group: PALETTE_GROUP, iconRight: "terminal", label: "Type Selection", commandExecutor: this },
      { id: COMMAND_TYPE_AND_CR_SELECTION, group: PALETTE_GROUP, iconRight: "terminal", label: "Type Selection & Execute", commandExecutor: this }
    ];
    
    if (this._mode ===ViewerElementTypes.Mode.CURSOR) {
      const cmCommandList: CommandEntry[] =
        CodeMirrorCommands.commandDescriptions(this._codeMirror).map( (desc) => {
          return { id: desc.command,
            group: PALETTE_GROUP,
            iconLeft:desc.iconLeft,
            iconRight: desc.iconRight,
            label: desc.label,
            commandExecutor: this };
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
            // Exit cursor mode.
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
    if (this._mainStyleLoaded) {
      if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = DomUtils.doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
// FIXME do we need to do anything here?
      }
    }
  }
  
  private getVirtualTextHeight(): number {
    if (DomUtils.getShadowRoot(this) === null) {
      return 8;
    }
    return this._isEmpty ? 0 : this._codeMirror.defaultTextHeight() * this.lineCount();
  }
  
  private _getClientYScrollRange(): number {
    return Math.max(0, this.getVirtualHeight(this.getHeight()) - this.getHeight() + this.getReserveViewportHeight(this.getHeight()));
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || DomUtils.getShadowRoot(this) === null) {
      return;
    }
    const elementHeight = this.getHeight();
    if (elementHeight !== this._currentElementHeight) {
      this._currentElementHeight = elementHeight;
      this.style.height = "" + elementHeight + "px";
      
      const totalTextHeight = this.getVirtualTextHeight();
      let codeMirrorHeight;
      codeMirrorHeight = elementHeight;        

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
  
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  
