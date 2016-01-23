/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import _  = require('lodash');
import fs = require('fs');
import ViewerElement = require("../viewerelement");
import util = require("../gui/util");
import domutils = require("../domutils");

import ViewerElementTypes = require('../viewerelementtypes');

import virtualscrollarea = require('../virtualscrollarea');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type CursorMoveDetail = ViewerElementTypes.CursorMoveDetail;

const ID = "CbImageViewerTemplate";
const ID_CONTAINER = "container";
const ID_IMAGE = "image";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";
const CLASS_FOCUSED = "terminal-focused";
const CLASS_UNFOCUSED = "terminal-unfocused";

const DEBUG_RESIZE = false;

const log = LogDecorator;

let registered = false;
let instanceIdCounter = 0;

let cssText: string = null;

function getCssText(): string {
  return cssText;
}

class EtImageViewer extends ViewerElement {

  static TAG_NAME = "et-image-viewer";
  
  static init(): void {
    if (registered === false) {
      // Load the CSS resources now.
      cssText = fs.readFileSync('themes/default/theme.css', { encoding: 'utf8' });
      window.document.registerElement(EtImageViewer.TAG_NAME, {prototype: EtImageViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtTerminalViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is EtImageViewer {
    return node !== null && node !== undefined && node instanceof EtImageViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  private _text: string;
  private _buffer: Uint8Array;
  private _mimeType: string;
  private _imageWidth: number;
  private _imageHeight: number;
  
  private _height: number;
  private _mode: ViewerElementTypes.Mode;
  private document: Document;
  private _visualState: number;

  private _mainStyleLoaded: boolean;
  private _resizePollHandle: domutils.LaterHandle;

  private _viewportHeight: number;  // Used to detect changes in the viewport size when in SELECTION mode.
  
  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight: number;

  private _initProperties(): void {
    this._log = new Logger(EtImageViewer.TAG_NAME);
    this._text = null;
    this._buffer = null;
    this._mimeType = null;
    this._imageWidth = -1;
    this._imageHeight = -1;
    this._height = 0;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
    this.document = document;
    
    this._currentElementHeight = -1;
    
    this._mainStyleLoaded = false;
    this._resizePollHandle = null;
    
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

  get title(): string {
    return "Text";
  }
  
  get awesomeIcon(): string {
    return "file-image-o";
  }
  
  getSelectionText(): string {    
    return null;
  }

  focus(): void {
  }

  hasFocus(): boolean {
    const hasFocus = this === domutils.getShadowRoot(this).activeElement; // FIXME
    return hasFocus;
  }
  
  set visualState(newVisualState: number) {
    this._setVisualState(newVisualState);
  }
  
  get visualState(): number {
    return this._visualState;
  }
  
  // get text(): string {
  //   return null;
  // }
  // 
  // set text(newText: string) {
  //   if (this._codeMirror === null) {
  //     this._text = newText;
  //   } else {
  //     this._codeMirror.getDoc().setValue(newText);
  //   }
  // }
  
  set mimeType(mimeType: string) {
    this._mimeType = mimeType;
  }
  
  get mimeType(): string {
    return this._mimeType;
  }
  
  setBytes(buffer: Uint8Array, mimeType: string): void {
    this.mimeType = mimeType;
    if (domutils.getShadowRoot(this) === null) {
      this._buffer = buffer;
    } else {
      this._setImage(buffer, mimeType);
    }
  }

  set mode(newMode: ViewerElementTypes.Mode) {
    if (newMode === this._mode) {
      return;
    }
    
    // switch (newMode) {
    //   case ViewerElementTypes.Mode.SELECTION:
    //     // Enter selection mode.
    //     this._enterSelectionMode();
    //     break;
    //     
    //   case ViewerElementTypes.Mode.DEFAULT:
    //     this._exitSelectionMode();
    //     break;
    // }
    this._mode = newMode;
  }
  
  get mode(): ViewerElementTypes.Mode {
    return this._mode;
  }
  
  set editable(editable: boolean) {
    // this._editable = editable;
  }
  
  get editable(): boolean {
    // return this._editable;
    return false;
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
  setHeight(newHeight: number): void {
    if (DEBUG_RESIZE) {
      this._log.debug("setHeight: ",newHeight);
    }
    this._adjustHeight(newHeight);
  }

  getMinHeight(): number {
    return 0;
  }

  /**
   * Gets the height of the scrollable contents on this element.
   *
   * @return {number} [description]
   */
  getVirtualHeight(containerHeight: number): number {
    // const result = this.getVirtualTextHeight();
    let result = 0;
    if (this._imageHeight > 0) {
      result = this._imageHeight;
    }
    
    if (DEBUG_RESIZE) {
      this._log.debug("getVirtualHeight: ",result);
    }
    return result;
  }
  
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_RESIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
  
  // isFontLoaded(): boolean {
  //   return this._effectiveFontFamily().indexOf(NO_STYLE_HACK) === -1;
  // }

  // VirtualScrollable
  setScrollOffset(y: number): void {
// this.log("setScrollOffset(" + y + ")");
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    containerDiv.scrollTop = y;
// this.log("this._codeMirror.getScrollInfo(): " , this._codeMirror.getScrollInfo());
  }
  
  // clearSelection(): void {
  // }
  
  // setCursorPositionTop(ch: number): boolean {
  //   return true;
  // }
  
  // setCursorPositionBottom(ch: number): boolean {
  //   return true;
  // }
  
  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["image/jpeg", "image/png"].indexOf(mimeType) !== -1;
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
    if (domutils.getShadowRoot(this) !== null) {
      return;
    }
    
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this._initFontLoading();
    
    const containerDiv = domutils.getShadowId(this, ID_CONTAINER);

    this.style.height = "0px";
    // this._exitSelectionMode();
    
    // Filter the keyboard events before they reach CodeMirror.
    containerDiv.addEventListener('keydown', this._handleContainerKeyDownCapture.bind(this), true);
    containerDiv.addEventListener('keydown', this._handleContainerKeyDown.bind(this));
    containerDiv.addEventListener('keyup', this._handleContainerKeyUpCapture.bind(this), true);
    
    const imgElement = <HTMLImageElement> domutils.getShadowId(this, ID_IMAGE);
    imgElement.addEventListener('load', this._handleImageLoad.bind(this));
    this._applyVisualState(this._visualState);

    if (this._buffer !== null) {
      this._setImage(this._buffer, this._mimeType);
    }
    
    this._adjustHeight(this._height);
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
        
        #${ID_CONTAINER}:focus {
          outline: 0px;
        }
        
        ${getCssText()}
        </style>
         <style id="${ID_THEME_STYLE}"></style>
        <div id="${ID_CONTAINER}" class="${CLASS_UNFOCUSED}"><img id="${ID_IMAGE}" /></div>`

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
    // const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
    // if ((visualState === EtTextViewer.VISUAL_STATE_AUTO && this.hasFocus()) ||
    //     visualState === EtTextViewer.VISUAL_STATE_FOCUSED) {
    // 
    //   containerDiv.classList.add(CLASS_FOCUSED);
    //   containerDiv.classList.remove(CLASS_UNFOCUSED);
    // } else {
    //   containerDiv.classList.add(CLASS_UNFOCUSED);
    //   containerDiv.classList.remove(CLASS_FOCUSED);
    // }
  }
  
  private _emitVirtualResizeEvent(): void {
    if (DEBUG_RESIZE) {
      this._log.debug("_emitVirtualResizeEvent");
    }
    const event = new CustomEvent(virtualscrollarea.EVENT_RESIZE, { bubbles: true });
    this.dispatchEvent(event);
  }
  
  private _emitBeforeSelectionChangeEvent(): void {
    const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }
  
  private _setImage(buffer: Uint8Array, mimeType: string): void {
    const dataUrl = domutils.CreateDataUrl(buffer, mimeType);
    const imageEl = domutils.getShadowId(this, ID_IMAGE);
    imageEl.setAttribute("src", dataUrl);
  }
  private _handleImageLoad(): void {
    const imgElement = <HTMLImageElement> domutils.getShadowId(this, ID_IMAGE);
    this._log.debug("image loaded");
    this._log.debug("imgElement.width: ", imgElement.width);
    this._log.debug("imgElement.height: ", imgElement.height);
    this._imageWidth = imgElement.width;
    this._imageHeight = imgElement.height;
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
      // if ( ! this.isFontLoaded()) {
        // Font has not been correctly applied yet.
        this._resizePollHandle = domutils.doLaterFrame(this._resizePoll.bind(this));
      // } else {
        // Yay! the font is correct. Resize the term soon.
// FIXME do we need to do anything here?
      // }
    }
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
      
    //   const totalTextHeight = this.getVirtualTextHeight();
    //   let codeMirrorHeight;
    //   codeMirrorHeight = elementHeight;        
    // 
      const containerDiv = domutils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + elementHeight + "px";
    //   this._codeMirror.setSize("100%", "" + codeMirrorHeight + "px");
    //   this._codeMirror.refresh();
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

export = EtImageViewer;
