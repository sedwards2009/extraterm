/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import * as _ from 'lodash';
import * as fs from 'fs';
import {WebComponent} from 'extraterm-web-component-decorators';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
import * as BulkFileUtils from '../bulk_file_handling/BulkFileUtils';
import {ViewerElement} from './ViewerElement';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as Util from '../gui/Util';
import * as DomUtils from '../DomUtils';
import * as ViewerElementTypes from './ViewerElementTypes';
import * as VirtualScrollArea from '../VirtualScrollArea';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as keybindingmanager from '../keybindings/KeyBindingManager';
type KeyBindingManager = keybindingmanager.KeyBindingManager;

type VirtualScrollable = VirtualScrollArea.VirtualScrollable;
type SetterState = VirtualScrollArea.SetterState;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;
type VisualState = ViewerElementTypes.VisualState;
const VisualState = ViewerElementTypes.VisualState;

const ID = "EtImageViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CURSOR = "ID_CURSOR";
const ID_IMAGE = "ID_IMAGE";
const CLASS_FORCE_FOCUSED = "force-focused";
const CLASS_FORCE_UNFOCUSED = "force-unfocused";
const CLASS_FOCUS_AUTO = "focus-auto";
const SCROLL_STEP = 128;

const KEYBINDINGS_SELECTION_MODE = "image-viewer";
const COMMAND_GO_UP = "goUp";
const COMMAND_GO_DOWN = "goDown";

const DEBUG_SIZE = false;

let instanceIdCounter = 0;


@WebComponent({tag: "et-image-viewer"})
export class ImageViewer extends ViewerElement {

  static TAG_NAME = "ET-IMAGE-VIEWER";
  
  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is ImageViewer {
    return node !== null && node !== undefined && node instanceof ImageViewer;
  }
  
  private _log: Logger;
  private _keyBindingManager: KeyBindingManager = null;
  private _bulkFileHandle: BulkFileHandle = null;
  private _text = null;
  private _buffer: Buffer = null;
  private _mimeType: string = null;
  private _imageWidth = -1;
  private _imageHeight = -1;
  private _cursorTop = 0;
  private _height = 0;
  private _mode: ViewerElementTypes.Mode = ViewerElementTypes.Mode.DEFAULT;
  private document: Document = null;
  private _visualState: VisualState = VisualState.UNFOCUSED;
  private _viewportHeight = -1;  // Used to detect changes in the viewport size when in CURSOR mode.
  
  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight = -1;

  constructor() {
    super();
    this._log = getLogger(ImageViewer.TAG_NAME, this);
    this.document = document;
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    this.style.height = "0px";
    
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('focus', (ev) => {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      this._cursorTop = containerDiv.scrollTop;
    } );
    
    const imgElement = <HTMLImageElement> DomUtils.getShadowId(this, ID_IMAGE);
    imgElement.addEventListener('load', this._handleImageLoad.bind(this));
    this._applyVisualState(this._visualState);

    if (this._bulkFileHandle !== null) {
      this._setImageUrl(this._bulkFileHandle.getUrl());
    }
    
    this._adjustHeight(this._height);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.IMAGE_VIEWER];
  }

  dispose(): void {
    if (this._bulkFileHandle !== null) {
      this._bulkFileHandle.deref();
      this._bulkFileHandle = null;
    }
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

  getTitle(): string {
    return "Text";
  }
  
  getAwesomeIcon(): string {
    return "file-image-o";
  }
  
  getSelectionText(): string {    
    return null;
  }

  focus(): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    DomUtils.focusWithoutScroll(containerDiv);
  }

  hasFocus(): boolean {
    const hasFocus = this === DomUtils.getShadowRoot(this).activeElement; // FIXME
    return hasFocus;
  }
  
  setVisualState(newVisualState: ViewerElementTypes.VisualState): void {
    if (newVisualState !== this._visualState) {
      if (DomUtils.getShadowRoot(this) !== null) {
        this._applyVisualState(newVisualState);
      }    
      this._visualState = newVisualState;
    }
  }
  
  getVisualState(): ViewerElementTypes.VisualState {
    return this._visualState;
  }
  
  setMimeType(mimeType: string): void {
    this._mimeType = mimeType;
  }
  
  getMimeType(): string {
    return this._mimeType;
  }
  
  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    const {mimeType, charset} = BulkFileUtils.guessMimetype(handle);
    this.setMimeType(mimeType);

    if (this._bulkFileHandle !== null) {
      this._bulkFileHandle.deref();
    }

    this._bulkFileHandle = handle;
    handle.ref();

    if (DomUtils.getShadowRoot(this) !== null) {
      this._setImageUrl(handle.getUrl());
    }
  }

  setMode(newMode: ViewerElementTypes.Mode): void {
    this._mode = newMode;
  }
  
  getMode(): ViewerElementTypes.Mode {
    return this._mode;
  }
  
  setEditable(editable: boolean): void {
  }
  
  getEditable(): boolean {
    return false;
  }  

  // VirtualScrollable
  getHeight(): number {
    return this._height;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (setterState.heightChanged || setterState.yOffsetChanged) {
      if (DEBUG_SIZE) {
        this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
          setterState.yOffset, setterState.yOffsetChanged);
      }
      this._adjustHeight(setterState.height);
      
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      if (containerDiv !== null) {
        containerDiv.scrollTop = setterState.yOffset;
      }
    }
  }

  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

   // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    // const result = this.getVirtualTextHeight();
    let result = 0;
    if (this._imageHeight > 0) {
      result = this._imageHeight;
    }
    
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight: ",result);
    }
    return result;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
  
  // isFontLoaded(): boolean {
  //   return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  // }


  getCursorPosition(): CursorMoveDetail {
    const detail: CursorMoveDetail = {
      left: 0,
      top: this._cursorTop,
      bottom: this._cursorTop + this._height,
      viewPortTop: this._cursorTop
    };
    return detail;
  }
  
  setCursorPositionTop(ch: number): boolean {
    this._cursorTop = 0;
    this.focus();
    return true;
  }
  
  setCursorPositionBottom(ch: number): boolean {
    this._cursorTop = this._imageHeight - this._height;
    this.focus();
    return true;
  }
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["image/x-bmp", "image/bmp", "image/png", "image/gif", "image/jpeg",  "image/webp"].indexOf(mimeType) !== -1;
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
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}">
        </style>
        <div id="${ID_CONTAINER}" class="${CLASS_FORCE_UNFOCUSED}" tabindex="-1"><div id="${ID_CURSOR}"></div><img id="${ID_IMAGE}" /></div>`

      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }
  
  private _applyVisualState(visualState: VisualState): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

    containerDiv.classList.remove(CLASS_FORCE_FOCUSED);
    containerDiv.classList.remove(CLASS_FORCE_UNFOCUSED);
    containerDiv.classList.remove(CLASS_FOCUS_AUTO);
    
    switch (visualState) {
      case VisualState.AUTO:
        containerDiv.classList.add(CLASS_FOCUS_AUTO);
        break;
        
      case VisualState.FOCUSED:
        containerDiv.classList.add(CLASS_FORCE_FOCUSED);
        break;
        
      case VisualState.UNFOCUSED:
        containerDiv.classList.add(CLASS_FORCE_UNFOCUSED);
        break;
    }
  }
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_SIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }
    VirtualScrollArea.emitResizeEvent(this);
  }
  
  private _emitBeforeSelectionChangeEvent(): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }
  
  private _setImageUrl(url: string): void {
    const imageEl = DomUtils.getShadowId(this, ID_IMAGE);
    imageEl.setAttribute("src", url);
  }
  private _handleImageLoad(): void {
    const imgElement = <HTMLImageElement> DomUtils.getShadowId(this, ID_IMAGE);
    this._imageWidth = imgElement.width;
    this._imageHeight = imgElement.height;
    
    const cursorDiv = DomUtils.getShadowId(this, ID_CURSOR);
    cursorDiv.style.height = "" + imgElement.height + "px";
    
    this._emitVirtualResizeEvent()
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
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
    }
  }
  
  private _handleContainerKeyDown(ev: KeyboardEvent): void {
    if (this._keyBindingManager !== null && this._keyBindingManager.getKeyBindingContexts() !== null &&
        this._mode === ViewerElementTypes.Mode.CURSOR) {
          
      const keyBindings = this._keyBindingManager.getKeyBindingContexts().context(KEYBINDINGS_SELECTION_MODE);
      if (keyBindings !== null) {
        
        const command = keyBindings.mapEventToCommand(ev);
        if (command !== null) {
          const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
          ev.preventDefault();
          ev.stopPropagation();
          
          switch (command) {        
            case COMMAND_GO_UP:
              // Cursor up
              if (this._cursorTop !== 0) {
                const newTop = Math.max(this._cursorTop - SCROLL_STEP, 0);
                this._cursorTop = newTop;
                const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
                this.dispatchEvent(event);

              } else {
                const detail: ViewerElementTypes.CursorEdgeDetail = { edge: ViewerElementTypes.Edge.TOP, ch: 0 };
                const event = new CustomEvent(ViewerElement.EVENT_CURSOR_EDGE, { bubbles: true, detail: detail });
                this.dispatchEvent(event);
              }
              break;
            
            case COMMAND_GO_DOWN:
              // Cursor down          
              const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
              if (this._cursorTop + this._height < this._imageHeight) {
                const newTop = Math.min(this._imageHeight - this._height, this._cursorTop + SCROLL_STEP);
                this._cursorTop = newTop;
                const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
                this.dispatchEvent(event);

              } else {
                const detail: ViewerElementTypes.CursorEdgeDetail = { edge: ViewerElementTypes.Edge.BOTTOM, ch: 0 };
                const event = new CustomEvent(ViewerElement.EVENT_CURSOR_EDGE, { bubbles: true, detail: detail });
                this.dispatchEvent(event);
              }
              break;
              
            default:
              break;
          }
          ev.preventDefault();
          ev.stopPropagation();          
          return;
        }
      }
    }    
  }
  
  private _getClientYScrollRange(): number {
    return Math.max(0, this.getVirtualHeight(this.getHeight()) - this.getHeight() + this.getReserveViewportHeight(this.getHeight()));
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || DomUtils.getShadowRoot(this) === null) {
      return;
    }
    if (newHeight !== this._currentElementHeight) {
      this._currentElementHeight = newHeight;
      this.style.height = "" + newHeight + "px";
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + newHeight + "px";
    }
  }
}

function px(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return parseInt(value.slice(0,-2),10);
}  
