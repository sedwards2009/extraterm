/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {BulkFileHandle, Disposable, ViewerMetadata} from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';

import { COMMAND_OPEN_COMMAND_PALETTE } from './command/CommandUtils';
import { isCommandable, Commandable, BoundCommand} from './command/CommandTypes';
import {doLater, DebouncedDoLater} from '../utils/DoLater';
import * as DomUtils from './DomUtils';
import {EmbeddedViewer} from './viewers/EmbeddedViewer';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import {AcceptsKeybindingsManager, KeybindingsManager} from './keybindings/KeyBindingsManager';
import {ResizeCanary} from './ResizeCanary';
import {ScrollBar} from'./gui/ScrollBar';
import * as SupportsClipboardPaste from "./SupportsClipboardPaste";
import * as SupportsDialogStack from "./SupportsDialogStack";
import { CssFile } from '../theme/Theme';
import {ThemeableElementBase} from './ThemeableElementBase';
import {ViewerElement} from "./viewers/ViewerElement";
import { RefreshLevel, Mode, VisualState } from './viewers/ViewerElementTypes';
import * as VirtualScrollArea from './VirtualScrollArea';
import * as WebIpc from './WebIpc';
import { AcceptsConfigDatabase, ConfigDatabase } from '../Config';

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type ScrollableElement = VirtualScrollable & HTMLElement;

const ID = "EtTabViewerTemplate";

const ID_SCROLL_AREA = "ID_SCROLL_AREA";
const ID_SCROLLBAR = "ID_SCROLLBAR";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CSS_VARS = "ID_CSS_VARS";
const KEYBINDINGS_VIEWER_TAB = "viewer-tab";
const CLASS_VISITOR_DIALOG = "CLASS_VISITOR_DIALOG";

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
@WebComponent({tag: "et-viewer-tab"})
export class EtViewerTab extends ViewerElement implements Commandable, AcceptsConfigDatabase,
    AcceptsKeybindingsManager, SupportsClipboardPaste.SupportsClipboardPaste,
    SupportsDialogStack.SupportsDialogStack {

  static TAG_NAME = "ET-VIEWER-TAB";

  private _log: Logger;
  private _virtualScrollArea: VirtualScrollArea.VirtualScrollArea = null;
  
  private _title = "New Tab";
  private _tag: string = null;

  private _keyBindingManager: KeybindingsManager = null;
  private _configDatabase: ConfigDatabase = null;
  private _resizePollHandle: Disposable = null;
  private _elementAttached = false;
  private _needsCompleteRefresh = true;
  private _fontSizeAdjustment = 0;
  private _armResizeCanary = false;  // Controls when the resize canary is allowed to chirp.
  private _dialogStack: HTMLElement[] = [];
  private _copyToClipboardLater: DebouncedDoLater = null;

  constructor() {
    super();
    this._log = getLogger(EtViewerTab.TAG_NAME, this);
    this._copyToClipboardLater = new DebouncedDoLater(() => this.copyToClipboard(), 100);
  }
   
  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();
    metadata.title = this._title;

    const viewerElement = this.getViewerElement();
    metadata.icon = viewerElement === null ? "fa fa-desktop" : viewerElement.getMetadata().icon;
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();
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
        if (ev.buttons & 2) { // Right Mouse Button
          const viewerElement = this._getViewerElement();
          if (viewerElement !== null && isCommandable(viewerElement)) {
            viewerElement.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
          }
        }
      }
    });
    
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.getPosition());
    });

    scrollerArea.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);

    scrollerArea.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleTerminalViewerCursor.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE,
        this._handleBeforeSelectionChange.bind(this));

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
        this.refresh(RefreshLevel.COMPLETE);
      }
    });

    this.updateThemeCss();

    doLater(this._processResize.bind(this));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._needsCompleteRefresh = true;
  }
  
  dispose(): void {
    this._copyToClipboardLater.cancel();
    const element = this.getViewerElement();
    if (element !== null) {
      element.dispose();
    }
    if (this._resizePollHandle !== null) {
      this._resizePollHandle.dispose();
      this._resizePollHandle = null;
    }
  }

  setConfigDatabase(newConfigDatabase: ConfigDatabase): void {
    this._configDatabase = newConfigDatabase;
  }

  // FIXME delete
  setTitle(newTitle: string): void {
    this._title = newTitle;
  }
  
  getTag(): string {
    return this._tag;
  }
  
  setTag(tag: string): void {
    this._tag = tag;
  }
  
  focus(): void {
    if (this._dialogStack.length !== 0) {
      this._dialogStack[this._dialogStack.length-1].focus();
      return;
    }

    const element = this.getViewerElement();
    if (element !== null) {
      super.focus();
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
      element.setMode(Mode.CURSOR);
      this._appendScrollableElement(element);
    }
  }
  
  getViewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  getFrameContents(frameId: string): BulkFileHandle {
    return this._tag === frameId ? this.getBulkFileHandle() : null;
  }

  getBulkFileHandle(): BulkFileHandle {
    const viewerElement = this.getViewerElement();
    if (viewerElement === null) {
      return null;
    }
    return viewerElement.getBulkFileHandle();
  }

  getMode(): Mode {
    return Mode.CURSOR;
  }
  
  setKeybindingsManager(keyBindingManager: KeybindingsManager): void {
    this._keyBindingManager = keyBindingManager;
  }

  getFontAdjust(): number {
    return this._fontSizeAdjustment;
  }

  setFontAdjust(delta: number): void {
    this._adjustFontSize(delta)
  }

  protected _themeCssFiles(): CssFile[] {
    return [CssFile.VIEWER_TAB];
  }

  refresh(requestedLevel: RefreshLevel): void {
    let level = requestedLevel;
    if (this._needsCompleteRefresh) {
      level = RefreshLevel.COMPLETE;
      this._needsCompleteRefresh = false;
    }

    const viewerElement = this._getViewerElement();
    if (viewerElement != null) {        
      const scrollerArea = DomUtils.getShadowId(this, ID_SCROLL_AREA);
      for (const kid of scrollerArea.children) {
        if (kid instanceof ViewerElement) {
          kid.refresh(level);
        }
      }
      
      const scrollContainer = DomUtils.getShadowId(this, ID_CONTAINER);
      this._virtualScrollArea.updateContainerHeight(scrollContainer.getBoundingClientRect().height);

      viewerElement.refresh(level);

      this._virtualScrollArea.updateScrollableSizes([viewerElement]);
      this._virtualScrollArea.reapplyState();
    }
  }

  showDialog(dialogElement: HTMLElement): Disposable {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    dialogElement.classList.add(CLASS_VISITOR_DIALOG);
    containerDiv.appendChild(dialogElement);
    this._dialogStack.push(dialogElement);
    return {
      dispose: () => {
        dialogElement.classList.remove(CLASS_VISITOR_DIALOG);
        this._dialogStack = this._dialogStack.filter(el => el !== dialogElement);
        containerDiv.removeChild(dialogElement);
      }
    };
  }
  
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
    if (this._keyBindingManager === null || this._keyBindingManager.getKeybindingsContexts() === null) {
      return;
    }

    const keyBindings = this._keyBindingManager.getKeybindingsContexts().context(KEYBINDINGS_VIEWER_TAB);
    const command = keyBindings.mapEventToCommand(ev);
    if (this._executeCommand(command)) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  }

  getCommands(commandableStack: Commandable[]): BoundCommand[] {
    const defaults = { group: PALETTE_GROUP, commandExecutor: this, contextMenu: true };
    const commandList: BoundCommand[] = [
      { ...defaults, id: COMMAND_OPEN_COMMAND_PALETTE, icon: "fas fa-toolbox", label: "Command Palette", commandPalette: false},
      { ...defaults, id: COMMAND_COPY_TO_CLIPBOARD, icon: "far fa-copy", label: "Copy to Clipboard" },
      { ...defaults, id: COMMAND_PASTE_FROM_CLIPBOARD, icon: "fa fa-clipboard", label: "Paste from Clipboard" },
      { ...defaults, id: COMMAND_FONT_SIZE_INCREASE, label: "Increase Font Size" },
      { ...defaults, id: COMMAND_FONT_SIZE_DECREASE, label: "Decrease Font Size" },
      { ...defaults, id: COMMAND_FONT_SIZE_RESET, label: "Reset Font Size" },
    ];

    const keyBindings = this._keyBindingManager.getKeybindingsContexts().context(KEYBINDINGS_VIEWER_TAB);
    if (keyBindings !== null) {
      commandList.forEach( (commandEntry) => {
        const shortcut = keyBindings.mapCommandToReadableKeyStroke(commandEntry.id)
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

  private _handleBeforeSelectionChange(ev: CustomEvent): void {
    if (ev.detail.originMouse) {
      const generalConfig = this._configDatabase.getConfig("general");
      if (generalConfig.autoCopySelectionToClipboard) {
        this._copyToClipboardLater.trigger();
      }
    }
  }

  canPaste(): boolean {
    const viewerElement = this.getViewerElement();
    if (viewerElement === null) {
      return false;
    }
    if (SupportsClipboardPaste.isSupportsClipboardPaste(viewerElement)) {
      return viewerElement.canPaste();
    }
    return false;
  }

  pasteText(text: string): void {
    const viewerElement = this.getViewerElement();
    if (viewerElement != null && SupportsClipboardPaste.isSupportsClipboardPaste(viewerElement)) {
      viewerElement.pasteText(text);
    }
  }  

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
