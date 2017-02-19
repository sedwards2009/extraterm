/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import fs  = require('fs');

import ViewerElement = require("./viewerelement");
import ViewerElementTypes = require("./viewerelementtypes");
import ResizeRefreshElementBase = require("./ResizeRefreshElementBase");
import EtEmbeddedViewer = require('./embeddedviewer');
import Logger from './Logger';
import log from './LogDecorator';
import domutils = require('./domutils');
import CbScrollbar = require('./gui/scrollbar');
import util = require('./gui/util');
import ResizeCanary from './ResizeCanary';
import ThemeableElementBase = require('./themeableelementbase');
import * as ThemeTypes from './Theme';
import keybindingmanager = require('./keybindingmanager');
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import CommandPaletteRequestTypes = require('./commandpaletterequesttypes');
type CommandPaletteRequest = CommandPaletteRequestTypes.CommandPaletteRequest;

import electron = require('electron');
const clipboard = electron.clipboard;

import * as WebIpc from './WebIpc';
import * as VirtualScrollArea from './VirtualScrollArea';
import BulkDOMOperation = require('./BulkDOMOperation');

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type SetterState = VirtualScrollArea.SetterState;
type ScrollableElement = VirtualScrollable & HTMLElement;
type VisualState = ViewerElementTypes.VisualState;
const VisualState = ViewerElementTypes.VisualState;

const DEBUG = true;

let registered = false;

const ID = "EtTabViewerTemplate";

const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CSS_VARS = "ID_CSS_VARS";
const KEYBINDINGS_VIEWER_TAB = "viewer-tab";

const PALETTE_GROUP = "viewertab";
const COMMAND_OPEN_COMMAND_PALETTE = CommandPaletteRequestTypes.COMMAND_OPEN_COMMAND_PALETTE;
const COMMAND_COPY_TO_CLIPBOARD = "copyToClipboard";
const COMMAND_PASTE_FROM_CLIPBOARD = "pasteFromClipboard";
const COMMAND_FONT_SIZE_INCREASE = "increaseFontSize";
const COMMAND_FONT_SIZE_DECREASE = "decreaseFontSize";
const COMMAND_FONT_SIZE_RESET = "resetFontSize";

const MINIMUM_FONT_SIZE = -3;
const MAXIMUM_FONT_SIZE = 4;

const SCROLL_STEP = 1;

/**
 * A viewer tab which can contain any ViewerElement.
 */
export default class EtViewerTab extends ViewerElement implements CommandPaletteRequestTypes.Commandable,
    keybindingmanager.AcceptsKeyBindingManager {

  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-VIEWER-TAB";
  
  /**
   * Initialize the EtViewerTab class and resources.
   *
   * When EtViewerTab is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      CbScrollbar.init();
      EtEmbeddedViewer.init();
      ResizeCanary.init();
      window.document.registerElement(EtViewerTab.TAG_NAME, {prototype: EtViewerTab.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;

  private _virtualScrollArea: VirtualScrollArea.VirtualScrollArea;
  
  private _terminalSize: ClientRect;
  private _scrollYOffset: number; // The Y scroll offset into the virtual height.
  private _virtualHeight: number; // The virtual height of the terminal contents in px.
  
  private _blinkingCursor: boolean;
  private _title: string;

  private _keyBindingManager: KeyBindingManager;

  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: domutils.LaterHandle;
  private _elementAttached: boolean;
  
  private _scheduleLaterHandle: domutils.LaterHandle;
  private _scheduledResize: boolean;

  private _fontSizeAdjustment: number;
  private _armResizeCanary: boolean;  // Controls when the resize canary is allowed to chirp.

  private _initProperties(): void {
    this._virtualScrollArea = null;
    this._elementAttached = false;
    this._blinkingCursor = false;

    this._title = "New Tab";
    this.tag = null;

    this._mainStyleLoaded = false;
    this._themeStyleLoaded = false;
    this._resizePollHandle = null;
    this._terminalSize = null;
    this._scrollYOffset = 0;
    this._virtualHeight = 0;

    this._fontSizeAdjustment = 0;
    this._armResizeCanary = false;

    this._scheduleLaterHandle = null;
    this._scheduledResize = false;
  }
  
  //-----------------------------------------------------------------------
  //
  //   ######                                
  //   #     # #    # #####  #      #  ####  
  //   #     # #    # #    # #      # #    # 
  //   ######  #    # #####  #      # #      
  //   #       #    # #    # #      # #      
  //   #       #    # #    # #      # #    # 
  //   #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------
  
  /**
   * Get this terminal's title.
   *
   * This is the window title of the terminal, don't confuse it with more
   * general HTML title of the element.
   */
  get terminalTitle(): string {
    return this._title;
  }
  
  get title(): string {
    return this._title;
  }
  
  set title(newTitle: string) {
    this._title = newTitle;
  }
  
  tag: string;
  
  /**
   * Destroy the ViewerTab
   */
  destroy(): void {
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.cancel();
      this._resizePollHandle = null;
    }

    // this._getWindow().removeEventListener('resize', this._scheduleResize.bind(this));
  }

  /**
   * Focus on this ViewerTab.
   */
  focus(): void {
    const element = this.viewerElement;
    if (element !== null) {
      element.focus();
    }
  }
  
  /**
   * Returns true if this terminal has the input focus.
   *
   * @return true if the terminal has the focus.
   */
  hasFocus(): boolean {
    const shadowRoot = domutils.getShadowRoot(this);
    if (shadowRoot === null) {
      return false;
    }
    return shadowRoot.activeElement !== null;
  }
  
  set viewerElement(element: ViewerElement) {
    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }
    
    if (element !== null) {
      // element.visualState = ViewerElementTypes. this._visualState; FIXME
      element.setMode(ViewerElementTypes.Mode.CURSOR);
      this._appendScrollableElement(element);
    }
  }
  
  get viewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  get awesomeIcon(): string {
    const viewerElement = this.viewerElement;
    return viewerElement === null ? "desktop" : viewerElement.awesomeIcon;
  }
  
  getFrameContents(frameId: string): string {
    const viewerElement = this.viewerElement;
    if (viewerElement === null) {
      return null;
    }
    if (this.tag === frameId) {
      return viewerElement.text;
    } else {
      return null;
    }
  }

  getMode(): ViewerElementTypes.Mode {
    return ViewerElementTypes.Mode.CURSOR;
  }
  
  setKeyBindingManager(keyBindingManager: KeyBindingManager): void {
    this._keyBindingManager = keyBindingManager;
  }

  bulkSetMode(mode: ViewerElementTypes.Mode): BulkDOMOperation.BulkDOMOperation {
    return BulkDOMOperation.nullOperation();
  }
  
  getVisualState(): ViewerElementTypes.VisualState {
    return ViewerElementTypes.VisualState.AUTO;
  }

  bulkSetVisualState(state: VisualState): BulkDOMOperation.BulkDOMOperation {
    return BulkDOMOperation.nullOperation();
  }

  getFontAdjust(): number {
    return this._fontSizeAdjustment;
  }

  setFontAdjust(delta: number): void {
    this._adjustFontSize(delta)
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.VIEWER_TAB];
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

  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties();
  }
   
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });

    const clone = this._createClone();
    shadow.appendChild(clone);
    this._virtualScrollArea = new VirtualScrollArea.VirtualScrollArea();

    this.addEventListener('focus', this._handleFocus.bind(this));
    this.addEventListener('blur', this._handleBlur.bind(this));

    const scrollbar = <CbScrollbar> domutils.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    
    this._virtualScrollArea.setScrollFunction( (offset: number): void => {
      scrollerArea.scrollTop = offset;
    });
    this._virtualScrollArea.setScrollbar(scrollbar);
    
    scrollerArea.addEventListener('wheel', this._handleMouseWheel.bind(this), true);
    scrollerArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === scrollerArea) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.position);
    });

    scrollerArea.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);

    scrollerArea.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleTerminalViewerCursor.bind(this));

        // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    const resizeCanary = <ResizeCanary> document.createElement(ResizeCanary.TAG_NAME);
    resizeCanary.setCss(`
        font-family: var(--terminal-font);
        font-size: var(--terminal-font-size);
    `);
    containerDiv.appendChild(resizeCanary);
    resizeCanary.addEventListener('resize', () => {
      if (this._armResizeCanary) {
        this._armResizeCanary = false;
        this.refresh(ResizeRefreshElementBase.RefreshLevel.COMPLETE);
      }
    });

    this.updateThemeCss();

    domutils.doLater(this._processResize.bind(this));
  }

  bulkRefresh(level: ResizeRefreshElementBase.RefreshLevel): BulkDOMOperation.BulkDOMOperation {
    const viewerElement = this._getViewerElement();
    if (viewerElement == null) {
      return BulkDOMOperation.nullOperation();
    } else {
      return viewerElement.bulkRefresh(level);
    }
  }

  //-----------------------------------------------------------------------
  //
  //   ######                                      
  //   #     # #####  # #    #   ##   ##### ###### 
  //   #     # #    # # #    #  #  #    #   #      
  //   ######  #    # # #    # #    #   #   #####  
  //   #       #####  # #    # ######   #   #      
  //   #       #   #  #  #  #  #    #   #   #      
  //   #       #    # #   ##   #    #   #   ###### 
  //
  //-----------------------------------------------------------------------
  
  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      template.innerHTML = `
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <style id="${ID_CSS_VARS}">${this._getCssVarsRules()}</style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_AREA}'></div>
          <cb-scrollbar id='${ID_SCROLLBAR}'></cb-scrollbar>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _getCssVarsRules(): string {
    return `
    #${ID_CONTAINER} {
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
  
  private _getDocument(): Document {
    return this.ownerDocument;
  }
  
  private _handleFocus(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear focused.
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(VisualState.FOCUSED);
      }
    });
  }
  
  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(VisualState.UNFOCUSED);
      }
    });
  }
  
  private _getViewerElement(): ViewerElement {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);    
    if (scrollerArea.firstElementChild !== null && scrollerArea.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> scrollerArea.firstElementChild;
    } else {
      return null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }

  private _handleMouseDown(ev: MouseEvent): void {
    if (ev.buttons === 4) { // Middle mouse button
      ev.stopPropagation();
      ev.preventDefault();
      this._pasteFromClipboard();
    }
  }
  
  // ----------------------------------------------------------------------
  //
  //    #####                                                          ##        #####                           
  //   #     #  ####  #####   ####  #      #      # #    #  ####      #  #      #     # # ###### # #    #  ####  
  //   #       #    # #    # #    # #      #      # ##   # #    #      ##       #       #     #  # ##   # #    # 
  //    #####  #      #    # #    # #      #      # # #  # #          ###        #####  #    #   # # #  # #      
  //         # #      #####  #    # #      #      # #  # # #  ###    #   # #          # #   #    # #  # # #  ### 
  //   #     # #    # #   #  #    # #      #      # #   ## #    #    #    #     #     # #  #     # #   ## #    # 
  //    #####   ####  #    #  ####  ###### ###### # #    #  ####      ###  #     #####  # ###### # #    #  ####  
  //
  // ----------------------------------------------------------------------
  private _handleMouseWheel(ev: WheelEvent): void {
    ev.stopPropagation();
    ev.preventDefault();
    const delta = ev.deltaY * SCROLL_STEP;
    this._virtualScrollArea.scrollTo(this._virtualScrollArea.getScrollYOffset() + delta);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    this._updateVirtualScrollableSize(<any> ev.target); 
      // ^ We know this event only comes from VirtualScrollable elements.
  }

  private _updateVirtualScrollableSize(virtualScrollable: VirtualScrollable): void {
    this._virtualScrollArea.updateScrollableSize(virtualScrollable);
  }

  /**
   * Handle a resize event from the window.
   */
  private _processResize(): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    this._virtualScrollArea.updateContainerHeight(scrollerArea.getBoundingClientRect().height);
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      this._updateVirtualScrollableSize(viewerElement);
    }
  }

  private _handleTerminalViewerCursor(ev: CustomEvent): void {
    const node = <Node> ev.target;
    if (ViewerElement.isViewerElement(node)) {
      const pos = node.getCursorPosition();
      const nodeTop = this._virtualScrollArea.getScrollableTop(node);
      const top = pos.top + nodeTop;
      const bottom = pos.bottom;      
      this._virtualScrollArea.scrollIntoView(top, bottom);
    }
  }

  private _adjustFontSize(delta: number): void {
    const newAdjustment = Math.min(Math.max(this._fontSizeAdjustment + delta, MINIMUM_FONT_SIZE), MAXIMUM_FONT_SIZE);
    if (newAdjustment !== this._fontSizeAdjustment) {
      this._fontSizeAdjustment = newAdjustment;

      const styleElement = <HTMLStyleElement> domutils.getShadowId(this, ID_CSS_VARS);
      if (styleElement != null) {
        (<any>styleElement.sheet).cssRules[0].style.cssText = this._getCssFontSizeRule(newAdjustment);  // Type stubs are missing cssRules.
        this._armResizeCanary = true;
        // Don't refresh. Let the Resize Canary detect the real change in the DOM when it arrives.
      }
    }
  }

  private _resetFontSize(): void {
    this._adjustFontSize(-this._fontSizeAdjustment);
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

  private _handleKeyDownCapture(ev: KeyboardEvent): void {
    if (this._keyBindingManager === null || this._keyBindingManager.getKeyBindingContexts() === null) {
      return;
    }

    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_VIEWER_TAB);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  private _commandPaletteEntries(): CommandPaletteRequestTypes.CommandEntry[] {
    const commandList: CommandPaletteRequestTypes.CommandEntry[] = [];

    commandList.push( { id: COMMAND_FONT_SIZE_INCREASE, group: PALETTE_GROUP, label: "Increase Font Size", target: this } );
    commandList.push( { id: COMMAND_FONT_SIZE_DECREASE, group: PALETTE_GROUP, label: "Decrease Font Size", target: this } );
    commandList.push( { id: COMMAND_FONT_SIZE_RESET, group: PALETTE_GROUP, label: "Reset Font Size", target: this } );

    const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_VIEWER_TAB);
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
  
  private _executeCommand(command: string): boolean {
    switch (command) {
      case COMMAND_COPY_TO_CLIPBOARD:
        this.copyToClipboard();
        break;

      case COMMAND_PASTE_FROM_CLIPBOARD:
        this._pasteFromClipboard();
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

      case COMMAND_FONT_SIZE_INCREASE:
        this._adjustFontSize(1);
        break;

      case COMMAND_FONT_SIZE_DECREASE:
        this._adjustFontSize(-1);
        break;

      case COMMAND_FONT_SIZE_RESET:
        this._resetFontSize();
        break;

      default:
        return false;
    }
    return true;
  }

  // ********************************************************************
  //
  //   #     #                 
  //   ##   ## #  ####   ####  
  //   # # # # # #      #    # 
  //   #  #  # #  ####  #      
  //   #     # #      # #      
  //   #     # # #    # #    # 
  //   #     # #  ####   ####  
  //
  // ********************************************************************

  /**
   * Copy the selection to the clipboard.
   */
  copyToClipboard(): void {
    let text: string = null;
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const kids = domutils.nodeListToArray(scrollerArea.childNodes);
    for (let i=0; i<kids.length; i++) {
      const node = kids[i];
      if (ViewerElement.isViewerElement(node)) {
        text = node.getSelectionText();
        if (text !== null) {
          WebIpc.clipboardWrite(text);
          break;
        }
      }
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
  
  /**
   * Find a command frame by ID.
   */
  private _findFrame(frameId: string): EtEmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    
    const scrollArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    const matches = scrollArea.querySelectorAll(EtEmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EtEmbeddedViewer>matches[0];
  }
}
