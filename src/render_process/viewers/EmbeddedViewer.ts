/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as _ from 'lodash';
import * as path from 'path';

import {WebComponent} from 'extraterm-web-component-decorators';

import {BulkFileHandle, BulkFileState} from '../bulk_file_handling/BulkFileHandle';
import {guessMimetype} from '../bulk_file_handling/BulkFileUtils';
import {CheckboxMenuItem} from '../gui/CheckboxMenuItem';
import * as CodeMirrorOperation from '../codemirror/CodeMirrorOperation';
import {COMMAND_OPEN_COMMAND_PALETTE, dispatchCommandPaletteRequest, CommandEntry, Commandable, isCommandable}
from '../CommandPaletteRequestTypes';
import * as DomUtils from '../DomUtils';
import * as GeneralEvents from '../GeneralEvents';
import {EVENT_DRAG_STARTED, EVENT_DRAG_ENDED} from '../GeneralEvents';
import {FrameMimeType} from '../InternalMimeTypes';
import * as KeyBindingManager from '../keybindings/KeyBindingManager';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {MenuItem} from '../gui/MenuItem';
import * as ResourceLoader from '../../ResourceLoader';
import * as SupportsClipboardPaste from '../SupportsClipboardPaste';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as Util from '../gui/Util';
import {ViewerElement, ViewerElementMetadata, ViewerElementPosture} from './ViewerElement';
import * as ViewerElementTypes from './ViewerElementTypes';
import {VisualState} from './ViewerElementTypes';
import * as VirtualScrollArea from '../VirtualScrollArea';
import {SetterState, VirtualScrollable} from '../VirtualScrollArea';


const ID = "EtEmbeddedViewerTemplate";

const ID_CONTAINER = "ID_CONTAINER";
const ID_HEADER = "ID_HEADER";
const ID_OUTPUT = "ID_OUTPUT";
const ID_OUTPUT_CONTAINER = "ID_OUTPUT_CONTAINER";
const ID_ICON = "ID_ICON";
const ID_ICON_DIV = "ID_ICON_DIV";
const ID_COMMAND_LINE = "ID_COMMAND_LINE";
const ID_TAG_NAME = "ID_TAG_NAME";
const ID_SCROLL_ICON = "ID_SCROLL_ICON";
const ID_SCROLL_NAME = "ID_SCROLL_NAME";

// const ID_EXPAND_BUTTON = "expand_button";
// const ID_EXPAND_ICON = "expand_icon";
// const ID_EXPAND_MENU_ITEM = "expandmenuitem";
const ID_CLOSE_BUTTON = "ID_CLOSE_BUTTON";
const ID_POP_OUT_BUTTON = "ID_POP_OUT_BUTTON";
const ID_TAG_ICON = "ID_TAG_ICON";

const CLASS_SCROLLING = "scrolling";
const CLASS_NOT_SCROLLING = "not-scrolling";
const CLASS_BOTTOM_VISIBLE = "bottom-visible";
const CLASS_BOTTOM_NOT_VISIBLE = "bottom-not-visible";
const CLASS_RUNNING = "CLASS_RUNNING";
const CLASS_FAILED = "CLASS_FAILED";
const CLASS_SUCCEEDED = "CLASS_SUCCEEDED";
const CLASS_NEUTRAL = "CLASS_NEUTRAL";

const DEBUG_SIZE = false;
const DND_TEXT_SIZE_THRESHOLD = 1024 * 1024;


/**
 * A visual frame which contains another element and can be shown directly inside a terminal.
 */
@WebComponent({tag: "et-embeddedviewer"})
export class EmbeddedViewer extends ViewerElement implements Commandable,
    SupportsClipboardPaste.SupportsClipboardPaste {
  
  static TAG_NAME = 'ET-EMBEDDEDVIEWER';

  static EVENT_CLOSE_REQUEST = 'close-request';
  static EVENT_FRAME_POP_OUT = 'frame-pop-out';
  static EVENT_SCROLL_MOVE = 'scroll-move';

  /**
   * Type guard for detecting a EtEmbeddedViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtEmbeddedViewer.
   */
  static is(node: Node): node is EmbeddedViewer {
    return node !== null && node !== undefined && node instanceof EmbeddedViewer;
  }
  
  private _log: Logger = null;
  private _title: string = "";
  private _tag: string = "";
  private _awesomeIcon: string = null;
  private _visualState: VisualState = ViewerElementTypes.VisualState.AUTO;
  private _mode: ViewerElementTypes.Mode = ViewerElementTypes.Mode.DEFAULT;
  private _virtualScrollArea: VirtualScrollArea.VirtualScrollArea;
  private _childFocusHandlerFunc: (ev: FocusEvent) => void;
  private _requestContainerHeight = false; // true if the container needs a height update.
  private _requestContainerScroll = false; // true if the container needs scroll to be set.
  private _requestContainerYScroll = 0; // the new scroll Y to use during update.
  private _headerTop = 0;
  private _headerBottom = 0;

  private _connectSetupDone = false;

  constructor() {
    super();
    this._log = getLogger(EmbeddedViewer.TAG_NAME, this);
    this._virtualScrollArea = new VirtualScrollArea.VirtualScrollArea();
    this._childFocusHandlerFunc = this._handleChildFocus.bind(this);

    this._setUpShadowDom();
    this._updateMetadata();
    this.setTag(this._tag);
    this.installThemeCss();
    this._setUpEventHandlers();
  }
  
  connectedCallback(): void {
    super.connectedCallback();

    if ( ! this._connectSetupDone) {
    this._setUpVirtualScrollArea();

    // Remove the anti-flicker style.
    DomUtils.getShadowId(this, ID_CONTAINER).setAttribute('style', '');
      this._connectSetupDone = true;
  }
  }

  getMetadata(): ViewerElementMetadata {
    const metadata = super.getMetadata();
    metadata.title = this._title;
    metadata.icon = this._awesomeIcon;
    return metadata;
  }

  dispose(): void {
    const viewerElement = this._getViewerElement();
    if (viewerElement !== null) {
      viewerElement.dispose();
    }
  }

  setViewerElement(element: ViewerElement): void {
    const oldViewer = this._getViewerElement()
    if (oldViewer != null) {
      oldViewer.removeEventListener('focus', this._childFocusHandlerFunc);
    }

    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }
    
    if (element !== null) {
      element.setVisualState(this._visualState);
      element.setMode(this._mode);
      element.addEventListener('focus', this._childFocusHandlerFunc);
      this.appendChild(element);
      this._virtualScrollArea.appendScrollable(element);

      this._updateMetadata();
    }
  }
  
  getViewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  setVisualState(newVisualState: VisualState): void {
    this._visualState = newVisualState;
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      viewerElement.setVisualState(newVisualState);
    }
  }
  
  getVisualState(): VisualState {
    return this._visualState;
  }
  
  // See VirtualScrollable
  getMinHeight(): number {
    if (DEBUG_SIZE) {
      this._log.debug("getMinHeight() => ", this.getReserveViewportHeight(0));
    }
    return this.getReserveViewportHeight(0);
  }
  
  // See VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    const viewerElement = this.getViewerElement();
    let result = 0;
    if (viewerElement !== null) {
      result = this._virtualScrollArea.getVirtualHeight();
    }
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight() => ", result);
    }
    return result;
  }
  
  // See VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    const {top, bottom} = this._borderSize();
    const result = top + bottom;
      
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight() => ", result);
    }
    return result;
  }
  
  // See VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (DEBUG_SIZE) {
        this._log.debug(`setDimensionsAndScroll(): height=${setterState.height}, ` +
        `heightChanged=${setterState.heightChanged}, yOffset=${setterState.yOffset}, ` +
        `yOffsetChanged=${setterState.yOffsetChanged}, physicalTop=${setterState.physicalTop}, ` +
        `containerHeight=${setterState.containerHeight}`);
    }

    if (setterState.heightChanged) {
      this.style.height = "" + setterState.height + "px";
    }

    const containerDiv = <HTMLDivElement>this._getById(ID_CONTAINER);
    if (setterState.yOffset === 0) {
      containerDiv.classList.remove(CLASS_SCROLLING);
      containerDiv.classList.add(CLASS_NOT_SCROLLING);
    } else {
      containerDiv.classList.add(CLASS_SCROLLING);
      containerDiv.classList.remove(CLASS_NOT_SCROLLING);
    }

    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const rect = headerDiv.getBoundingClientRect();

    headerDiv.style.top = Math.min(Math.max(setterState.physicalTop, 0), setterState.height - rect.height) + 'px';
    const outputContainerDiv = <HTMLDivElement>this._getById(ID_OUTPUT_CONTAINER);
    outputContainerDiv.style.top = "" + rect.height + "px";
    
    if (setterState.physicalTop > 0 || setterState.height < setterState.containerHeight) {
      // Bottom part is visible
      containerDiv.classList.remove(CLASS_BOTTOM_NOT_VISIBLE);
      containerDiv.classList.add(CLASS_BOTTOM_VISIBLE);
    } else {
      containerDiv.classList.add(CLASS_BOTTOM_NOT_VISIBLE);
      containerDiv.classList.remove(CLASS_BOTTOM_VISIBLE);
    }
    
    const scrollNameDiv = <HTMLDivElement>this._getById(ID_SCROLL_NAME);
    const percent = Math.floor(setterState.yOffset / this.getVirtualHeight(0) * 100);
    scrollNameDiv.innerHTML = "" + percent + "%";
    
    if (setterState.heightChanged) {
      this._requestContainerHeight = true;
    }
    this._requestContainerScroll = true;
    this._requestContainerYScroll = setterState.yOffset;

    if (this.parentElement != null) {
      this._applyContainerChanges();
    }

    if (setterState.physicalTopChanged || setterState.containerHeight || setterState.heightChanged) {
      const viewportBottomOffset = setterState.physicalTop + setterState.containerHeight - setterState.height;
      this._virtualScrollArea.setViewportBottomOffset(viewportBottomOffset);
    }
  }

  markVisible(visible: boolean): void {
    if (visible) {
      if (DEBUG_SIZE) {
        this._log.debug("markVisible()");
      }

      this._applyContainerChanges();
      this._virtualScrollArea.reapplyState();
    }
  }

  private _applyContainerChanges(): void {
    if (this._requestContainerHeight) {
      this._requestContainerHeight = false;
      const outputContainerDiv = <HTMLDivElement>this._getById(ID_OUTPUT);
      this._virtualScrollArea.updateContainerHeight(outputContainerDiv.getBoundingClientRect().height);
    }
    if (this._requestContainerScroll) {
      this._requestContainerScroll = false;
      this._virtualScrollArea.scrollTo(this._requestContainerYScroll);
    }
  }

  getSelectionText(): string {
    const viewerElement = this.getViewerElement();
    return viewerElement === null ? null : viewerElement.getSelectionText();
  }
  
  getBulkFileHandle(): BulkFileHandle {
    const viewerElement = this.getViewerElement();
    return viewerElement === null ? null : viewerElement.getBulkFileHandle();    
  }  

  setTag(tag: string): void {
    this._tag = tag;
    const tagName = <HTMLDivElement>this._getById(ID_TAG_NAME);
    tagName.innerText = tag;
  }
  
  getTag(): string {
    return this._tag;
  }

  hasFocus(): boolean {
    const el = this.getViewerElement();
    if (el == null) {
      return false;
    }
    return el.hasFocus();
  }

  canPaste(): boolean {
    const el = this.getViewerElement();
    if (el == null) {
      return false;
    }

    return SupportsClipboardPaste.isSupportsClipboardPaste(el) && el.canPaste();
  }

  pasteText(text: string): void {
    if ( ! this.canPaste()) {
      return;
    }

    const el = this.getViewerElement();
    if (SupportsClipboardPaste.isSupportsClipboardPaste(el)) {
      el.pasteText(text);
    }
  }

  clearSelection(): void {
    const viewerElement = this.getViewerElement();
    if (viewerElement === null) {
      return;
    }
    viewerElement.clearSelection();
  }

  setMode(newMode: ViewerElementTypes.Mode): void {
    this._mode = newMode;
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      return viewerElement.setMode(newMode);
    }
  }

  getMode(): ViewerElementTypes.Mode {
    return this._mode;
  }

  focus(): void {
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      return viewerElement.focus();
    } else {
      super.focus();
    }
  }

  getCursorPosition(): ViewerElementTypes.CursorMoveDetail {
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      const borderSize = this._borderSize();
      const {left, top, bottom, viewPortTop } = viewerElement.getCursorPosition();
      return {
        left,
        top: top+borderSize.top,
        bottom: bottom + borderSize.top,
        viewPortTop: viewPortTop+borderSize.top
      };
    }
    return null;
  }
  
  setCursorPositionTop(x: number): boolean {
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionTop(x);
    }
    return false;
  }
  
  setCursorPositionBottom(x: number): boolean {
    const viewerElement = this.getViewerElement();
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionBottom(x);
    }
    return false;
  }

  private _setUpShadowDom(): void {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this._createClone();
    shadow.appendChild(clone);
  }

  private _updateMetadata(): void {
    const viewerElement = this.getViewerElement();
    const metadata: ViewerElementMetadata = viewerElement !== null ? viewerElement.getMetadata() : 
      {
        title: "",
        icon: null,
        posture: ViewerElementPosture.NEUTRAL,
        toolTip: null
      };

    this._updateTitle(metadata.title);
    this._updateAwesomeIcon(metadata.icon);
    this._updatePosture(metadata.posture);
    this._updateToolTip(metadata.toolTip);
  }
  
  private _updateTitle(title: string): void {
    (<HTMLDivElement>this._getById(ID_COMMAND_LINE)).innerText = title;
  }

  private _updateAwesomeIcon(iconName: string): void {
    this._awesomeIcon = iconName;
    const icon = <HTMLDivElement>this._getById(ID_ICON);
    icon.className = "fa " + (iconName !== null && iconName !== undefined && iconName !== "" ? "fa-" : "") + iconName;
  }
  
  private _updatePosture(posture: ViewerElementPosture): void {
    const container = <HTMLDivElement>this._getById(ID_CONTAINER);
    
    container.classList.remove(CLASS_RUNNING);
    container.classList.remove(CLASS_SUCCEEDED);
    container.classList.remove(CLASS_FAILED);
    container.classList.remove(CLASS_NEUTRAL);

    container.classList.add({
        [ViewerElementPosture.RUNNING]: CLASS_RUNNING,
        [ViewerElementPosture.SUCCESS]: CLASS_SUCCEEDED,
        [ViewerElementPosture.FAILURE]: CLASS_FAILED,
        [ViewerElementPosture.NEUTRAL]: CLASS_NEUTRAL,
      }[posture]);
  }

  private _updateToolTip(toolTip: string): void {
    if (toolTip !== null) {
      (<HTMLDivElement>this._getById(ID_ICON_DIV)).setAttribute('title', toolTip);
      (<HTMLDivElement>this._getById(ID_COMMAND_LINE)).setAttribute('title', toolTip);
    }
  }

  private _setUpEventHandlers(): void {
    this.addEventListener(ViewerElement.EVENT_METADATA_CHANGE, this._handleViewerMetadataChanged.bind(this));
    DomUtils.getShadowId(this, ID_POP_OUT_BUTTON).addEventListener('click', this._emitFramePopOut.bind(this));
    DomUtils.getShadowId(this, ID_CLOSE_BUTTON).addEventListener('click', this._emitCloseRequest.bind(this));
    
    const headerDiv = DomUtils.getShadowId(this, ID_HEADER);
    headerDiv.addEventListener('dragstart', this._handleDragStart.bind(this), false);
    headerDiv.addEventListener('dragend', this._handleDragEnd.bind(this), false);

    const outputDiv = DomUtils.getShadowId(this, ID_OUTPUT);    
    outputDiv.addEventListener('mousedown', this.focus.bind(this));
    outputDiv.addEventListener('click', this.focus.bind(this));
    outputDiv.addEventListener('keydown', this._handleKeyDown.bind(this));
    outputDiv.addEventListener(VirtualScrollArea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    
    DomUtils.addCustomEventResender(this, ViewerElement.EVENT_BEFORE_SELECTION_CHANGE);
    DomUtils.addCustomEventResender(this, ViewerElement.EVENT_CURSOR_MOVE);
    DomUtils.addCustomEventResender(this, ViewerElement.EVENT_CURSOR_EDGE);

    // Right mouse button click opens up the command palette.
    DomUtils.getShadowId(this, ID_CONTAINER).addEventListener('contextmenu', (ev: MouseEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();

      const viewerElement = this.getViewerElement();
      if (viewerElement === null) {
        return;
      }

      if (isCommandable(viewerElement)) {
        viewerElement.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
      } else {
        this.executeCommand(COMMAND_OPEN_COMMAND_PALETTE);
      }
    });
  }

  private _setUpVirtualScrollArea(): void {
    const outputContainerDiv = DomUtils.getShadowId(this, ID_OUTPUT_CONTAINER);
    DomUtils.preventScroll(outputContainerDiv);
    this._virtualScrollArea.setScrollFunction( (offset: number): void => {
      const outputDiv = DomUtils.getShadowId(this, ID_OUTPUT);    
      outputDiv.style.top = "-" + offset +"px";
    });
    
    // const expandbutton = this._getById(ID_EXPAND_BUTTON);
    // expandbutton.addEventListener('click', (): void => {
    //   const expanded = util.htmlValueToBool(this.getAttribute(EtEmbeddedViewer.ATTR_EXPAND), true);
    //   this.setAttribute(EtEmbeddedViewer.ATTR_EXPAND, "" + !expanded);
    // });

    const setterState: VirtualScrollArea.SetterState = {
      height: this.getMinHeight(),
      heightChanged: true,
      yOffset: 0,
      yOffsetChanged: true,
      physicalTop: 0,
      physicalTopChanged: true,
      containerHeight: this.getMinHeight(),
      containerHeightChanged: true,
      visibleBottomOffset: 0,
      visibleBottomOffsetChanged: true
    };

    this.setDimensionsAndScroll(setterState);
  }

  private _handleViewerMetadataChanged(): void {
    this._updateMetadata();
  }

  private _handleDragStart(ev: DragEvent): void {
    ev.stopPropagation();

    const target = <HTMLElement>ev.target;
    if (target.getAttribute("draggable") == null || this.getViewerElement() == null) {
      ev.preventDefault();
      return;
    }

    // Reference to this frame for the purposes of drag and drop inside Extraterm.
    ev.dataTransfer.setData(FrameMimeType.MIMETYPE, "" + this.getTag());
    
    const handle = this.getBulkFileHandle();

this._log.debug("handle.getState() ", handle.getState()); // FIXME
this._log.debug(BulkFileState[handle.getState()]);

    if (handle.getState() === BulkFileState.COMPLETED) {
      const metadata = handle.getMetadata();
      let {mimeType, charset} = guessMimetype(handle);

      if (mimeType.startsWith("text/") && handle.getTotalSize() < DND_TEXT_SIZE_THRESHOLD) {
        // It is text and not too big. Send it the contents as part of the DnD event.
        const stringByteData = this._fetchUrlImmediately(handle.getUrl());
        const byteData = Buffer.from(stringByteData, "latin1");
        if (charset == null || charset === "") {
          charset = "utf8";
        }
        const decodedString = byteData.toString(charset);

        ev.dataTransfer.setData("text/plain", decodedString);
      }

      // Expose the contents as a URL which can be downloaded.
      let filename = <string> metadata["filename"];
      if (filename == null) {
        filename = "";
      }
      filename = path.basename(filename);

      ev.dataTransfer.setData("text/uri-list", handle.getUrl() + "/" + filename);      
    }

    ev.dataTransfer.setDragImage(target, -10, -10);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.dropEffect = 'move';

    const dragStartedEvent = new CustomEvent(EVENT_DRAG_STARTED, { bubbles: true });
    this.dispatchEvent(dragStartedEvent);
  }

  private _fetchUrlImmediately(url: string): string {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);

    let response: string = null;
    xhr.onload = (e) => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          response = xhr.response;
        } else {
          this._log.warn("An error occurred while downloading URL ", url, xhr.statusText);
        }
      }
    };
    xhr.send(null);
    return response;
  }

  private _handleDragEnd(ev: DragEvent): void {
    const dragEndedEvent = new CustomEvent(EVENT_DRAG_ENDED, { bubbles: true });
    this.dispatchEvent(dragEndedEvent);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.EMBEDDED_FRAME];
  }

  executeCommand(commandId: string): void {
    this._executeCommand(commandId);
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

  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;
      
      template.innerHTML = `
        <style id=${ThemeableElementBase.ID_THEME}></style>
        <div id='${ID_CONTAINER}' style='display: none;' class='${CLASS_RUNNING}'>
          <div id='${ID_HEADER}' tabindex='0' draggable='true'>
            <div class='left_block'>
              <div id='${ID_ICON_DIV}'><i id='${ID_ICON}'></i></div>
              <div id='${ID_COMMAND_LINE}'></div>
            </div>
            <div class='header_spacer'></div>
            <div class='right_block'>
              <div id='${ID_SCROLL_ICON}'><i class='fa fa-arrows-v'></i></div>
              <div id='${ID_SCROLL_NAME}'></div>
              <div class='spacer'></div>
              <div id='${ID_TAG_ICON}'><i class='fa fa-tag'></i></div>
              <div id='${ID_TAG_NAME}'></div>
              <div class='spacer'></div>
` +//              <button id='${ID_EXPAND_BUTTON}' title='Expand/Collapse'><i id='${ID_EXPAND_ICON}' class='fa fa-plus-square-o'></i></button>
//              <div class='spacer'></div>
`              <button id='${ID_POP_OUT_BUTTON}'><i class='fa fa-external-link'></i></button>
              <div class='spacer'></div>
              <button id='${ID_CLOSE_BUTTON}' title='Close'><i class='fa fa-times-circle'></i></button>` +
            `</div>` +
          `</div>
          <div id='${ID_OUTPUT_CONTAINER}'><div id='${ID_OUTPUT}'><slot></slot></div></div>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): Element {
    return DomUtils.getShadowRoot(this).querySelector('#'+id);
  }

  private _borderSize(): {top: number; bottom: number;} {
    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const outputContainerDiv =  <HTMLDivElement>this._getById(ID_OUTPUT_CONTAINER);
    const outputContainerStyle = window.getComputedStyle(outputContainerDiv);

    const headerRect = headerDiv.getBoundingClientRect();

    if (headerRect.width === 0) {
      // Bogus info. This element most likely isn't in the DOM tree proper. Fall back to the last good read.
      return { top: this._headerTop, bottom: this._headerBottom };
    }

    const top = headerRect.height + DomUtils.pixelLengthToInt(outputContainerStyle.borderTopWidth);
    const bottom = DomUtils.pixelLengthToInt(outputContainerStyle.borderBottomWidth);

    this._headerTop = top;
    this._headerBottom = bottom;
    return {top, bottom};
  }

  private _getViewerElement(): ViewerElement {
    if (this.firstElementChild !== null && this.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> this.firstElementChild;
    } else {
      return null;
    }
  }

  private _handleChildFocus(ev: FocusEvent): void {
    const focusEvent = new FocusEvent('focus', {});
    this.dispatchEvent(focusEvent);
  }

  private _handleKeyDown(ev: KeyboardEvent): void {
    if (ev.keyCode === 79 && ev.ctrlKey && ev.shiftKey) { // Ctrl+Shift+O
      ev.stopPropagation();
      ev.preventDefault();
      this._emitFramePopOut();
      return;
    }
    
    if (ev.keyCode === 87 && ev.ctrlKey && ev.shiftKey) { // Ctrl+Shift+W
      ev.stopPropagation();
      ev.preventDefault();
      this._emitCloseRequest();
      return;
    }
  }

  private _executeCommand(command): boolean {
    switch (command) {
      case COMMAND_OPEN_COMMAND_PALETTE:
        dispatchCommandPaletteRequest(this);
        break;
        
      default:
          return false;
    }
    return true;
  }

  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[] {
    return [];
  }

  private _emitManualScroll(): void {
    const event = new CustomEvent(EmbeddedViewer.EVENT_SCROLL_MOVE);
    event.initCustomEvent(EmbeddedViewer.EVENT_SCROLL_MOVE, true, true, null);
    this.dispatchEvent(event);
  }
  
  private _emitFramePopOut(): void {
    const event = new CustomEvent(EmbeddedViewer.EVENT_FRAME_POP_OUT);
    event.initCustomEvent(EmbeddedViewer.EVENT_FRAME_POP_OUT, true, true, this);
    this.dispatchEvent(event);
  }

  private _emitCloseRequest(): void {
    const event = new CustomEvent(EmbeddedViewer.EVENT_CLOSE_REQUEST);
    event.initCustomEvent(EmbeddedViewer.EVENT_CLOSE_REQUEST, true, true, null);
    this.dispatchEvent(event);
  }

  private _handleVirtualScrollableResize(ev: CustomEvent): void {
    const scrollable = <any> ev.target;
    const height = this._virtualScrollArea.getVirtualHeight();
    this._virtualScrollArea.updateScrollableSize(scrollable);

    const newHeight = this._virtualScrollArea.getVirtualHeight();
    if (height !== newHeight) {
      VirtualScrollArea.emitResizeEvent(this);
    }
  }
}
