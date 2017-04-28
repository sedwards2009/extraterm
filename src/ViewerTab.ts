/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as fs from 'fs';

import {ViewerElement} from "./ViewerElement";
import * as ViewerElementTypes from './ViewerElementTypes';
import * as ResizeRefreshElementBase from './ResizeRefreshElementBase';
import {EmbeddedViewer} from './EmbeddedViewer';
import Logger from './Logger';
import log from './LogDecorator';
import * as DomUtils from './DomUtils';
import {ScrollBar} from'./gui/ScrollBar';
import * as Util from './gui/Util';
import {ResizeCanary} from './ResizeCanary';
import {ThemeableElementBase} from './ThemeableElementBase';
import * as ThemeTypes from './Theme';
import * as keybindingmanager from './KeyBindingManager';
type KeyBindingManager = keybindingmanager.KeyBindingManager;

import * as CommandPaletteRequestTypes from './CommandPaletteRequestTypes';
type CommandPaletteRequest = CommandPaletteRequestTypes.CommandPaletteRequest;

import * as Electron from 'electron';
const clipboard = Electron.clipboard;

import * as WebIpc from './WebIpc';
import * as VirtualScrollArea from './VirtualScrollArea';

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
export class EtViewerTab extends ViewerElement implements CommandPaletteRequestTypes.Commandable,
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
      ScrollBar.init();
      EmbeddedViewer.init();
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
  private _tag: string;

  private _keyBindingManager: KeyBindingManager;

  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: DomUtils.LaterHandle;
  private _elementAttached: boolean;
  private _needsCompleteRefresh: boolean;

  private _scheduleLaterHandle: DomUtils.LaterHandle;
  private _scheduledResize: boolean;

  private _fontSizeAdjustment: number;
  private _armResizeCanary: boolean;  // Controls when the resize canary is allowed to chirp.

  private _initProperties(): void {
    this._log = new Logger(EtViewerTab.TAG_NAME, this);

    this._virtualScrollArea = null;
    this._elementAttached = false;
    this._needsCompleteRefresh = true;
    this._blinkingCursor = false;

    this._title = "New Tab";
    this._tag = null;

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
  getTerminalTitle(): string {
    return this._title;
  }
  
  getTitle(): string {
    return this._title;
  }
  
  setTitle(newTitle: string): void {
    this._title = newTitle;
  }
  
  getTag(): string {
    return this._tag;
  }
  
  setTag(tag: string): void {
    this._tag = tag;
  }
  
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
    const element = this.getViewerElement();
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
    const shadowRoot = DomUtils.getShadowRoot(this);
    if (shadowRoot === null) {
      return false;
    }
    return shadowRoot.activeElement !== null;
  }
  
  setViewerElement(element: ViewerElement): void {
    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }
    
    if (element !== null) {
      // element.visualState = ViewerElementTypes. this._visualState; FIXME
      element.setMode(ViewerElementTypes.Mode.CURSOR);
      this._appendScrollableElement(element);
    }
  }
  
  getViewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  getAwesomeIcon(): string {
    const viewerElement = this.getViewerElement();
    return viewerElement === null ? "desktop" : viewerElement.getAwesomeIcon();
  }
  
  getFrameContents(frameId: string): string {
    const viewerElement = this.getViewerElement();
    if (viewerElement === null) {
      return null;
    }
    if (this._tag === frameId) {
      return viewerElement.getText();
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

    const scrollbar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);

    const scrollContainer = DomUtils.getShadowId(this, ID_CONTAINER);
    DomUtils.preventScroll(scrollContainer);

    scrollContainer.addEventListener(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, (ev: CustomEvent) => {
        this._handleCommandPaletteRequest(ev);
      });

    this._virtualScrollArea.setScrollFunction( (offset: number): void => {
      scrollerArea.scrollTop = offset;
    });
    this._virtualScrollArea.setScrollbar(scrollbar);

    scrollerArea.addEventListener('wheel', this._handleMouseWheel.bind(this), true);
    scrollerArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === scrollerArea) {
        ev.preventDefault();
        ev.stopPropagation();
        this.focus();
      }
    });
    
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.getPosition());
    });

    scrollerArea.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);

    scrollerArea.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleTerminalViewerCursor.bind(this));

        // A Resize Canary for tracking when terminal fonts are effectively changed in the DOM.
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
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

    DomUtils.doLater(this._processResize.bind(this));
  }

  /**
   * Custom Element 'detached' life cycle hook.
   */
  detachedCallback(): void {
    super.detachedCallback();
    this._needsCompleteRefresh = true;
  }

  refresh(requestedLevel: ResizeRefreshElementBase.RefreshLevel): void {
    let level = requestedLevel;
    if (this._needsCompleteRefresh) {
      level = ResizeRefreshElementBase.RefreshLevel.COMPLETE;
      this._needsCompleteRefresh = false;
    }

    const viewerElement = this._getViewerElement();
    if (viewerElement != null) {        
      // --- DOM read ---
      const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
      const scrollbar = <ScrollBar> DomUtils.getShadowId(this, ID_SCROLLBAR);
      ResizeRefreshElementBase.ResizeRefreshElementBase.refreshChildNodes(scrollerArea, level);
      scrollbar.refresh(level);
      
      // --- DOM write ---
      const scrollContainer = DomUtils.getShadowId(this, ID_CONTAINER);
      this._virtualScrollArea.updateContainerHeight(scrollContainer.getBoundingClientRect().height);

      viewerElement.refresh(level);

      this._virtualScrollArea.updateScrollableSizes([viewerElement]);
      this._virtualScrollArea.reapplyState();
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
          <${ScrollBar.TAG_NAME} id='${ID_SCROLLBAR}'></${ScrollBar.TAG_NAME}>
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
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    DomUtils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(VisualState.FOCUSED);
      }
    });
  }
  
  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    DomUtils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.setVisualState(VisualState.UNFOCUSED);
      }
    });
  }
  
  private _getViewerElement(): ViewerElement {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);    
    if (scrollerArea.firstElementChild !== null && scrollerArea.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> scrollerArea.firstElementChild;
    } else {
      return null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
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
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    this._virtualScrollArea.updateContainerHeight(scrollerArea.getBoundingClientRect().height);
    const viewerElement = this.getViewerElement();
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

      const styleElement = <HTMLStyleElement> DomUtils.getShadowId(this, ID_CSS_VARS);
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

  private _handleCommandPaletteRequest(ev: CustomEvent): void {
    if (ev.path[0] === this) { // Don't process our own messages.
      return;
    }
    
    ev.stopPropagation();
    
    const request: CommandPaletteRequestTypes.CommandPaletteRequest = ev.detail;
    const commandPaletteRequestDetail: CommandPaletteRequest = {
        srcElement: request.srcElement === null ? this : request.srcElement,
        commandEntries: [...request.commandEntries, ...this._commandPaletteEntries()],
        contextElement: this
      };
    const commandPaletteRequestEvent = new CustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST,
      { detail: commandPaletteRequestDetail });
    commandPaletteRequestEvent.initCustomEvent(CommandPaletteRequestTypes.EVENT_COMMAND_PALETTE_REQUEST, true, true,
      commandPaletteRequestDetail);
    this.dispatchEvent(commandPaletteRequestEvent);
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
    const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    const kids = DomUtils.nodeListToArray(scrollerArea.childNodes);
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
  private _findFrame(frameId: string): EmbeddedViewer {
    if (/[^0-9]/.test(frameId)) {
      return null;
    }
    
    const scrollArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
    const matches = scrollArea.querySelectorAll(EmbeddedViewer.TAG_NAME + "[tag='" + frameId + "']");
    return matches.length === 0 ? null : <EmbeddedViewer>matches[0];
  }
}
