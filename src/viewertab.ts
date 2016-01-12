/**
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 */

import fs  = require('fs');

import ViewerElement = require("./viewerelement");
import ViewerElementTypes = require("./viewerelementtypes");
import EtEmbeddedViewer = require('./embeddedviewer');
import Logger = require('./logger');
import LogDecorator = require('./logdecorator');
import domutils = require('./domutils');
import CbScrollbar = require('./gui/scrollbar');
import util = require('./gui/util');
import clipboard = require('clipboard');
import webipc = require('./webipc');
import globalcss = require('./gui/globalcss');
import virtualscrollarea = require('./virtualscrollarea');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;
type ScrollableElement = VirtualScrollable & HTMLElement;

const log = LogDecorator;

const DEBUG = true;

let registered = false;

const ID = "EtTabViewerTemplate";

const ID_SCROLL_AREA = "scroll_area";
const ID_SCROLLBAR = "scrollbar";
const ID_CONTAINER = "terminal_container";
const ID_MAIN_STYLE = "main_style";
const ID_THEME_STYLE = "theme_style";

const SCROLL_STEP = 1;

/**
 */
class EtViewerTab extends ViewerElement {
  
  //-----------------------------------------------------------------------
  // Statics
  
  static TAG_NAME = "et-viewer-tab";
  
  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      CbScrollbar.init();
      EtEmbeddedViewer.init();
      window.document.registerElement(EtViewerTab.TAG_NAME, {prototype: EtViewerTab.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically.
  private _log: Logger;

  private _virtualScrollArea: virtualscrollarea.VirtualScrollArea;
  
  private _terminalSize: ClientRect;
  private _scrollYOffset: number; // The Y scroll offset into the virtual height.
  private _virtualHeight: number; // The virtual height of the terminal contents in px.
  
  private _blinkingCursor: boolean;
  private _title: string;

  // private _themeCssPath: string;
  private _mainStyleLoaded: boolean;
  private _themeStyleLoaded: boolean;
  private _resizePollHandle: domutils.LaterHandle;
  private _elementAttached: boolean;
  
  private _scheduleLaterHandle: domutils.LaterHandle;
  private _scheduledResize: boolean;

  private _initProperties(): void {
    this._virtualScrollArea = null;
    this._elementAttached = false;
    this._blinkingCursor = false;

    this._title = "New Tab";
    this.tag = null;

    // this._themeCssPath = null;
    this._mainStyleLoaded = false;
    this._themeStyleLoaded = false;
    this._resizePollHandle = null;
    this._terminalSize = null;
    this._scrollYOffset = 0;
    this._virtualHeight = 0;

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
  
  // set themeCssPath(path: string) {
  //   this._themeCssPath = path;
  //   const themeCss = fs.readFileSync(path, {encoding: 'utf8'});
  //   const themeTag = <HTMLStyleElement> domutils.getShadowId(this, ID_THEME_STYLE);
  //   themeTag.innerHTML = globalcss.stripFontFaces(themeCss);
  // }
  
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
   * Focus on this terminal.
   */
  focus(): void {

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
      element.mode = ViewerElementTypes.Mode.SELECTION;
      this._appendScrollableElement(element);
    }
  }
  
  get viewerElement(): ViewerElement {
    return this._getViewerElement();
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
    if (this._elementAttached) {
      return;
    }
    this._elementAttached = true;
    
    const shadow = domutils.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);
    this._virtualScrollArea = new virtualscrollarea.VirtualScrollArea();

    // util.getShadowId(this, ID_MAIN_STYLE).addEventListener('load', () => {
    //   this._mainStyleLoaded = true;
    //   this._handleStyleLoad();
    // });
    // 
    // util.getShadowId(this, ID_THEME_STYLE).addEventListener('load', () => {
    //   this._themeStyleLoaded = true;
    //   this._handleStyleLoad();
    //   });

    this.addEventListener('focus', this._handleFocus.bind(this));
    this.addEventListener('blur', this._handleBlur.bind(this));

    const scrollbar = <CbScrollbar> domutils.getShadowId(this, ID_SCROLLBAR);
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    
    this._virtualScrollArea.setScrollContainer(scrollerArea);
    this._virtualScrollArea.setScrollbar(scrollbar);

    // FIXME there might be resizes for things other than changs in window size.
    // this._getWindow().addEventListener('resize', this._scheduleResize.bind(this));
    
    scrollerArea.addEventListener('wheel', this._handleMouseWheel.bind(this), true);
    scrollerArea.addEventListener('mousedown', (ev: MouseEvent): void => {
      if (ev.target === scrollerArea) {
        // FIXME
        // this._codeMirrorTerminal.focus();
        ev.preventDefault();
        ev.stopPropagation();
      }
    });
    
    scrollbar.addEventListener('scroll', (ev: CustomEvent) => {
      this._virtualScrollArea.scrollTo(scrollbar.position);
    });


    scrollerArea.addEventListener('mousedown', this._handleMouseDown.bind(this), true);
    scrollerArea.addEventListener('keydown', this._handleKeyDownCapture.bind(this), true);

    scrollerArea.addEventListener(virtualscrollarea.EVENT_RESIZE, this._handleVirtualScrollableResize.bind(this));
    scrollerArea.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, this._handleCodeMirrorCursor.bind(this));
    
    domutils.doLater(this._processResize.bind(this));
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
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      const background_color = "#000000";

      template.innerHTML = `<style id="${ID_MAIN_STYLE}">
        :host {
          display: block;
        }
        
        #${ID_CONTAINER} {
            display: flex;
            flex-direction: row;
            width: 100%;
            height: 100%;
        }

        #${ID_SCROLLBAR} {
            flex: 0;
            min-width: 15px;
            height: 100%;
        }
        
        #${ID_SCROLL_AREA} {
          flex: 1;
          height: 100%;
          overflow-x: hidden;
          overflow-y: hidden;
          background-color: ${background_color};
        }
        </style>
        <style id="${ID_THEME_STYLE}"></style>
        <div id='${ID_CONTAINER}'>
          <div id='${ID_SCROLL_AREA}'></div>
          <cb-scrollbar id='${ID_SCROLLBAR}'></cb-scrollbar>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
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
        node.visualState = ViewerElement.VISUAL_STATE_FOCUSED;
      }
    });
  }
  
  private _handleBlur(event: FocusEvent): void {
    // Forcefully set the visual state of each thing in the terminal to appear unfocused.
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    domutils.nodeListToArray(scrollerArea.childNodes).forEach( (node): void => {
      if (ViewerElement.isViewerElement(node)) {
        node.visualState = ViewerElement.VISUAL_STATE_UNFOCUSED;
      }
    });
  }
  
  private _getViewerElement(): ViewerElement {
    if (this.firstElementChild !== null && this.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> this.firstElementChild;
    } else {
      return null;
    }
  }
  
  private _appendScrollableElement(el: ScrollableElement): void {
    const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
    scrollerArea.appendChild(el);
    this._virtualScrollArea.appendScrollable(el);
  }
  
  // private _removeScrollableElement(el: ScrollableElement): void {
  //   const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
  //   scrollerArea.removeChild(el);
  //   this._virtualScrollArea.removeScrollable(el);
  // }
  // 
  // private _replaceScrollableElement(oldEl: ScrollableElement, newEl: ScrollableElement): void {
  //   const scrollerArea = domutils.getShadowId(this, ID_SCROLL_AREA);
  //   scrollerArea.insertBefore(newEl, oldEl);
  //   scrollerArea.removeChild(oldEl);
  //   this._virtualScrollArea.replaceScrollable(oldEl, newEl);
  // }

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
    this._virtualScrollArea.resize();
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      this._updateVirtualScrollableSize(viewerElement);
    }
  }

  private _handleCodeMirrorCursor(ev: CustomEvent): void {
    const node = <Node> ev.target;
    if (ViewerElement.isViewerElement(node)) {
      const pos = node.getCursorPosition();
      const nodeTop = this._virtualScrollArea.getScrollableTop(node);
      const top = pos.top + nodeTop;
      const bottom = pos.bottom;      
      this._virtualScrollArea.scrollIntoView(top, bottom);
    }
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
    // Ctrl+C Copy
    if (ev.keyCode === 67 && ev.ctrlKey) {
      this.copyToClipboard();
      ev.stopPropagation();
      return;
    }
  }

  // private _handleKeyPressCapture(ev: KeyboardEvent): void {
  //   if (this._codeMirrorTerminal === null) {
  //     return;
  //   }
  // 
  //   if (this._mode !== Mode.SELECTION && ev.target !== this._codeMirrorTerminal) {
  //     // Route the key down to the current code mirror terminal which has the emulator attached.
  //     const simulatedKeypress = domutils.newKeyboardEvent('keypress', ev);
  //     ev.preventDefault();
  //     ev.stopPropagation();
  //     if ( ! this._codeMirrorTerminal.dispatchEvent(simulatedKeypress)) {
  //       // Cancelled.
  //       ev.preventDefault();
  //     }
  //   }
  // }

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
          webipc.clipboardWrite(text);
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
    webipc.clipboardReadRequest();
  }
  
  // private handleRequestFrame(frameId: string): void {
  //   const sourceFrame: EtEmbeddedViewer = this._findFrame(frameId);
  //   let data = sourceFrame !== null ? sourceFrame.text : "";
  //   data = data === undefined ? "" : data;
  //   const lines = data.split("\n");
  //   let encodedData: string = "";
  //   lines.forEach( (line: string) => {
  //     encodedData = window.btoa(line +"\n");
  //     this._sendDataToPtyEvent(encodedData+"\n");
  //   });
  //     
  //   this._sendDataToPtyEvent("\x04");
  //   
  //   if (encodedData.length !== 0) {
  //     this._sendDataToPtyEvent("\x04");
  //   }
  // }


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

export = EtViewerTab;
