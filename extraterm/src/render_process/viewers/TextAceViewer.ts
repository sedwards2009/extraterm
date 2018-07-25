/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import {BulkFileHandle, Disposable, ViewerMetadata} from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';

import {BlobBulkFileHandle} from '../bulk_file_handling/BlobBulkFileHandle';
import * as BulkFileUtils from '../bulk_file_handling/BulkFileUtils';
import { ExtraEditCommands } from './ExtraAceEditCommands';
import {Commandable, CommandEntry, COMMAND_OPEN_COMMAND_PALETTE, dispatchCommandPaletteRequest}
from '../CommandPaletteRequestTypes';
import {doLater, doLaterFrame, DebouncedDoLater} from '../../utils/DoLater';
import * as DomUtils from '../DomUtils';
import * as keybindingmanager from '../keybindings/KeyBindingsManager';
import * as GeneralEvents from '../GeneralEvents';
import {KeyBindingsManager, AcceptsKeyBindingsManager, MinimalKeyboardEvent} from '../keybindings/KeyBindingsManager';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import * as ViewerElementTypes from '../viewers/ViewerElementTypes';
import {emitResizeEvent as VirtualScrollAreaEmitResizeEvent, SetterState, VirtualScrollable} from '../VirtualScrollArea';

import { ExtratermAceEditor, TerminalRenderer } from "extraterm-ace-terminal-renderer";
import { Command, DefaultCommands, Document, Editor, EditSession, MultiSelectCommands, ModeList, Renderer, Position, UndoManager } from "ace-ts";
import { newImmediateResolvePromise } from '../../utils/ImmediateResolvePromise';

const VisualState = ViewerElementTypes.VisualState;
type VisualState = ViewerElementTypes.VisualState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

const ID = "EtTextViewerTemplate";
const ID_CSS_VARS = "ID_CSS_VARS";
const ID_CONTAINER = "ID_CONTAINER";
const ID_MAIN_STYLE = "ID_MAIN_STYLE";
const CLASS_HIDE_CURSOR = "hide-cursor";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";

const KEYBINDINGS_CURSOR_MODE = "text-viewer";
const PALETTE_GROUP = "textviewer";
const COMMAND_TYPE_AND_CR_SELECTION = "typeSelectionAndCr";
const COMMAND_TYPE_SELECTION = "typeSelection";

const NO_STYLE_HACK = "NO_STYLE_HACK";
const DEBUG_RESIZE = false;

let cssText: string = null;

function getCssText(): string {
  return cssText;
}


@WebComponent({tag: "et-text-viewer"})
export class TextViewer extends ViewerElement implements Commandable, AcceptsKeyBindingsManager,
    SupportsClipboardPaste.SupportsClipboardPaste, Disposable {

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
  private _keyBindingManager: KeyBindingsManager = null;
  private _title = "";
  private _bulkFileHandle: BulkFileHandle = null;
  private _mimeType: string = null;
  private _metadataEventDoLater: DebouncedDoLater = null;
  
  private _aceEditor: ExtratermAceEditor = null;
  private _aceEditSession: EditSession = null;
  private _height = 0;
  private _isEmpty = false;
  private _mode: ViewerElementTypes.Mode = ViewerElementTypes.Mode.DEFAULT;
  private _editable = false;
  private _visualState: VisualState = VisualState.AUTO;
  private _fontUnitWidth = 10;  // slightly bogus defaults
  private _fontUnitHeight = 10;

  private _mainStyleLoaded = false;
  private _resizePollHandle: Disposable = null;

  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight = -1;

  constructor() {
    super();

    this._log = getLogger(TextViewer.TAG_NAME, this);

    this._metadataEventDoLater = new DebouncedDoLater(() => {
      const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
      this.dispatchEvent(event);
    });
    
    const shadow = this.attachShadow( { mode: 'open', delegatesFocus: true } );
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this._initFontLoading();
    this.installThemeCss();

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

    this._mode = ViewerElementTypes.Mode.DEFAULT;

    this._aceEditSession = new EditSession(new Document(""));
    this._aceEditSession.setUndoManager(new UndoManager());
    this._aceEditSession.setUseWorker(false);

    const aceRenderer = new TerminalRenderer(containerDiv);
    aceRenderer.setShowGutter(true);
    aceRenderer.setShowLineNumbers(true);
    aceRenderer.setShowFoldWidgets(false);
    aceRenderer.setDisplayIndentGuides(false);

    this._aceEditor = new ExtratermAceEditor(aceRenderer, this._aceEditSession);

    this.__addCommands(DefaultCommands);
    this.__addCommands(MultiSelectCommands);
    this.__addCommands(ExtraEditCommands);

    this._exitCursorMode();

    this._aceEditor.on("change", (data, editor) => {
      if (this._mode !== ViewerElementTypes.Mode.CURSOR) {
        return;
      }
      
      doLater( () => {
        VirtualScrollAreaEmitResizeEvent(this);
      });
    });

    this._aceEditor.selection.on("changeCursor", () => {
      const effectiveFocus = this._visualState === ViewerElementTypes.VisualState.FOCUSED ||
                              (this._visualState === ViewerElementTypes.VisualState.AUTO && this.hasFocus());
      if (this._mode !== ViewerElementTypes.Mode.DEFAULT && effectiveFocus) {
        const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
        this.dispatchEvent(event);
      }
    });
    
    this._aceEditor.on("focus", (): void => {
      if (this._visualState === VisualState.AUTO) {
        const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
        containerDiv.classList.add(CLASS_FOCUSED);
        containerDiv.classList.remove(CLASS_UNFOCUSED);
      }
    });

    this._aceEditor.on("blur", (): void => {
      if (this._visualState === VisualState.AUTO) {
        containerDiv.classList.add(CLASS_UNFOCUSED);
        containerDiv.classList.remove(CLASS_FOCUSED);
      }
    });
    
    this._aceEditor.on("changeSelection", (): void => {
      this._emitBeforeSelectionChangeEvent(true);
    });

    this._aceEditor.onCursorTopHit((column: number) => {
      this._emitCursorEdgeEvent(ViewerElementTypes.Edge.TOP, column);
    });

    this._aceEditor.onCursorBottomHit((column: number) => {
      this._emitCursorEdgeEvent(ViewerElementTypes.Edge.BOTTOM, column);
    });

    this._aceEditor.on("change", () => {
      // If the contents are changed then drop our ref to the source file and
      // force getBulkFileHandle() to read from Ace.
      if (this._bulkFileHandle != null) {
        this._bulkFileHandle.deref();
        this._bulkFileHandle = null;
      }
    });

    // Filter the keyboard events before they reach Ace.
    containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('keypress', this._handleContainerKeyPressCapture.bind(this), true);    
    containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
    containerDiv.addEventListener('contextmenu', this._handleContextMenuCapture.bind(this), true);

    this._updateCssVars(); 
    this._applyVisualState(this._visualState);
    this._adjustHeight(this._height);
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    
    if (this._title !== "") {
      metadata.title = this._title;     
    } else {
      metadata.title = "Text";
    }

    metadata.icon = "fa fa-file-text";
    return metadata;
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
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.TEXT_VIEWER];
  }

  dispose(): void {
    if (this._bulkFileHandle != null) {
      this._bulkFileHandle.deref();
      this._bulkFileHandle = null;
    }
    super.dispose();
  }

  setKeyBindingsManager(newKeyBindingManager: KeyBindingsManager): void {
    this._keyBindingManager = newKeyBindingManager;
  }

  getSelectionText(): string {    
    if (this._aceEditor.selection.isEmpty()) {
      return null;
    }
    return this._aceEditor.getSelectedText();
  }

  focus(): void {
    this._aceEditor.focus();
  }

  hasFocus(): boolean {
    return this._aceEditor.isFocused();
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
    this._aceEditor.setValue(newText);
    this._aceEditor.selection.clearSelection();
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

  setMimeType(mimeType: string): void {
    this._mimeType = mimeType;
    this._setMimeTypeOnAce(mimeType);
  }

  private _setMimeTypeOnAce(mimeType: string): void {
    const mode = ModeList.getModeByMimeType(mimeType);
    if (mode != null) {
      this._aceEditSession.setLanguageMode(mode, (err: any) => {
        if (err != null) {
          this._log.warn(err);
        }
      });
    }
  }
  
  getMimeType(): string {
    return this._mimeType;
  }

  getTabSize(): number {
    return this._aceEditSession.getTabSize();
  }

  setTabSize(size: number): void {
    this._aceEditSession.setTabSize(size);
  }

  /**
   * Return true if line numbers are being shown in the gutter.
   */
  getShowLineNumbers(): boolean {
    return this._aceEditor.renderer.getShowLineNumbers();
  }

  /**
   * Set whether to show line numebrs in the gutter.
   */
  setShowLineNumbers(show: boolean): void {
    this._aceEditor.renderer.setShowGutter(show);
    this._aceEditor.renderer.setShowLineNumbers(show);
  }

  getBulkFileHandle(): BulkFileHandle {
    if (this._bulkFileHandle != null) {
      return this._bulkFileHandle;
    } else {
      const text =  this._isEmpty ? "" : this._aceEditor.getValue();
      return new BlobBulkFileHandle(this.getMimeType()+";charset=utf8", {}, Buffer.from(text, 'utf8'));
    }
  }

  async setBulkFileHandle(handle: BulkFileHandle): Promise<void> {
    if (this._bulkFileHandle != null) {
      this._bulkFileHandle.deref();
      this._bulkFileHandle = null;
    }

    if (handle.getMetadata()["filename"] != null) {
      this._title = <string> handle.getMetadata()["filename"];
    } else {
      this._title = "";
    }

    await this._loadBulkFile(handle);
    this._setMimeTypeOnAce(this._mimeType);
  }

  private async _loadBulkFile(handle: BulkFileHandle): Promise<void> {
    handle.ref();
    this._metadataEventDoLater.trigger();
    const {mimeType, charset} = BulkFileUtils.guessMimetype(handle);
    this.setMimeType(mimeType);
    const data = await BulkFileUtils.readDataAsArrayBuffer(handle)
    const decodedText = Buffer.from(data).toString(charset == null ? "utf8" : charset);
    this._setText(decodedText);
    this._bulkFileHandle = handle;

    // After setting the whole contents of a Ace instance, it takes a
    // short while before it fully updates itself and is ready to correctly
    // handle sizing and scroll commands. Thus, we wait a short time before
    // triggering the resizing events and activities.
// FIXME this might not be needed anymore    
    await newImmediateResolvePromise();
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
    this._aceEditor.setReadOnly(! editable);
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

      this._adjustHeight(setterState.height);
      this.scrollTo(0, setterState.yOffset);
    }    
  }
  
  isFontLoaded(): boolean {
    return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  }

  lineCount(): number {
    return this._isEmpty ? 0 : this._aceEditSession.getLength();
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
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    const mode = ModeList.getModeByMimeType(mimeType);
    return mode !== null && mode !== undefined;
  }
  
  deleteTopLines(topLines: number): void {
    const linesToDelete = Math.min(topLines, this.lineCount());

    const pos: Position = { row: 0, column: 0 };
    const endPos: Position = { row: linesToDelete, column: 0 };
    this._aceEditor.replaceRange({start: pos, end: endPos}, "");

    VirtualScrollAreaEmitResizeEvent(this);
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
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id="${ID_CONTAINER}" class="terminal_viewer ${CLASS_UNFOCUSED}"></div>`

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

    this._aceEditor.clearSelection();
      this._aceEditor.selection.moveCursorToPosition({ row: this._aceEditSession.getLength()-1, column: 0 });
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
    this._aceEditSession.setScrollLeft(xCoord);
    this._aceEditSession.setScrollTop(yCoord);
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

    const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_CURSOR_MODE);
    if (keyBindings !== null) {
      const command = keyBindings.mapEventToCommand(ev);
      if (command != null) {
        ev.stopPropagation();
        return;
      }
    }

    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
    }
  }

  public dispatchEvent(ev: Event): boolean {
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
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
      const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_CURSOR_MODE);
      if (keyBindings !== null) {
this._log.debug(keybindingmanager.formatKeyboardEvent(ev));
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
    }
  }

  private _handleContainerKeyUpCapture(ev: KeyboardEvent): void {
    if (this._mode === ViewerElementTypes.Mode.DEFAULT) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  private _handleContextMenuCapture(ev: MouseEvent): void {
    ev.stopImmediatePropagation();
    ev.preventDefault();

    this.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
  }
  
  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
    let commandList: CommandEntry[] = [
      { id: COMMAND_TYPE_SELECTION, group: PALETTE_GROUP, iconRight: "fa fa-terminal", label: "Type Selection", commandExecutor: this },
      { id: COMMAND_TYPE_AND_CR_SELECTION, group: PALETTE_GROUP, iconRight: "fa fa-terminal", label: "Type Selection & Execute", commandExecutor: this }
    ];
    
    const keyBindings = this._keyBindingManager.getKeyBindingsContexts().context(KEYBINDINGS_CURSOR_MODE);
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
    if (this._mainStyleLoaded) {
      if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = doLaterFrame(this._resizePoll.bind(this));
      } else {
        // Yay! the font is correct. Resize the term soon.
// FIXME do we need to do anything here?
      }
    }
  }

  private getVirtualTextHeight(): number {
    if (this._aceEditor == null) {
      return 0;
    }
    return this._isEmpty ? 0 : this._aceEditor.renderer.lineHeight * this.lineCount();
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

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + elementHeight + "px";
      this._aceEditor.resize(true);
    }
  }
}
