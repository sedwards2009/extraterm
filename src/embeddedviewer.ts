/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import resourceLoader = require('./resourceloader');
import contextmenu = require('./gui/contextmenu');
import menuitem = require('./gui/menuitem');
import checkboxmenuitem = require('./gui/checkboxmenuitem');
import globalcss = require('./gui/globalcss');
import util = require('./gui/util');
import ViewerElement = require('./viewerelement');
import ViewerElementTypes = require('./viewerelementtypes');
import virtualscrollarea = require('./virtualscrollarea');
import Logger = require('./logger');
import LogDecorator = require('./logdecorator');

type VirtualScrollable = virtualscrollarea.VirtualScrollable;

const log = LogDecorator;

contextmenu.init();
menuitem.init();
checkboxmenuitem.init();

const ID = "EtEmbeddedViewerTemplate";

const ID_CONTAINER = "container";
const ID_HEADER = "header";
const ID_OUTPUT = "output";
const ID_ICON = "icon";
const ID_ICON_DIV = "icondiv";
const ID_COMMANDLINE = "command_line";
const ID_TAG_NAME = "tag_name";
const ID_EXPAND_BUTTON = "expand_button";
const ID_CLOSE_BUTTON = "close_button";
const ID_POP_OUT_BUTTON = "pop_out_button";
const ID_TAG_ICON = "tag_icon";
const ID_EXPAND_ICON = "expand_icon";

let registered = false;
const REPLACE_NBSP_REGEX = new RegExp("\u00A0","g");

const DEBUG_SIZE = false;

/**
 * A visual frame which contains another element and can be shown directly inside a terminal.
 */
class EtEmbeddedViewer extends ViewerElement {
  
  static TAG_NAME = "et-embeddedviewer";
  
  static EVENT_COPY_CLIPBOARD_REQUST = 'copy-clipboard-request';
  
  static EVENT_TYPE = 'type';
  
  static EVENT_CLOSE_REQUEST = 'close-request';
  
  static EVENT_FRAME_POP_OUT = 'frame-pop-out';
  
  static EVENT_SCROLL_MOVE = 'scroll-move';
  
  static ATTR_COMMAND = "command";

  static ATTR_RETURN_CODE = "return-code";

  static ATTR_EXPAND = "expand";

  static ATTR_TAG = "tag";

  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(EtEmbeddedViewer.TAG_NAME, {prototype: EtEmbeddedViewer.prototype});
      registered = true;
    }
  }
  
  /**
   * Type guard for detecting a EtEmbeddedViewer instance.
   * 
   * @param  node the node to test
   * @return      True if the node is a EtEmbeddedViewer.
   */
  static is(node: Node): node is EtEmbeddedViewer {
    return node !== null && node !== undefined && node instanceof EtEmbeddedViewer;
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;

  private _currentElementHeight: number;
  
  private _visualState: number;

  private _mode: ViewerElementTypes.Mode;
  
  private _initProperties(): void {
    this._log = new Logger(EtEmbeddedViewer.TAG_NAME);
    this._currentElementHeight = -1;
    this._visualState = ViewerElement.VISUAL_STATE_AUTO;
    this._mode = ViewerElementTypes.Mode.DEFAULT;
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
  
  set viewerElement(element: ViewerElement) {
    if (this.childNodes.length !== 0) {
      this.innerHTML = "";
    }
    
    if (element !== null) {
      element.visualState = this._visualState;
      element.mode = this._mode;
      this.appendChild(element);
    }
  }
  
  get viewerElement(): ViewerElement {
    return this._getViewerElement();
  }
  
  set visualState(newVisualState: number) {
    this._visualState = newVisualState;
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      viewerElement.visualState = newVisualState;
    }
  }
  
  get visualState(): number {
    return this._visualState;
  }

  getMinHeight(): number {
    if (DEBUG_SIZE) {
      this._log.debug("getMinHeight() => ", this.getReserveViewportHeight(0));
    }
    return this.getReserveViewportHeight(0);
  }
  
  getVirtualHeight(containerHeight: number): number {
    const viewerElement = this.viewerElement;
    let result = 0;
    if (viewerElement !== null) {
      result = viewerElement.getVirtualHeight(containerHeight);
    }
    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight() => ", result);
    }
    return result;
  }
  
  getReserveViewportHeight(containerHeight: number): number {
    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const rect = headerDiv.getBoundingClientRect();
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight() => ",rect.height);
    }
    return rect.height;
  }
  
  setHeight(height: number): void {
    if (DEBUG_SIZE) {
      this._log.debug("setHeight(): ", height);
    }
    const headerDiv = <HTMLDivElement>this._getById(ID_HEADER);
    const rect = headerDiv.getBoundingClientRect();
    
    if (height !== this._currentElementHeight) {
      this.style.height = "" + height + "px";
      this._currentElementHeight = height;
    }
    
    if (this.viewerElement !== null) {
      this.viewerElement.setHeight(height - rect.height);
    }    
  }
  
  setScrollOffset(y: number): void {
    if (DEBUG_SIZE) {
      this._log.debug("setScrollOffset(): ", y);
    }
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      viewerElement.setScrollOffset(y);
    }
  }
  
  /**
   * 
   */
  focusLast(): void {
    const header = <HTMLDivElement>this._getById(ID_CONTAINER);
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }

  /**
   * 
   */
  focusFirst(): void {
    const header = <HTMLDivElement>this._getById(ID_CONTAINER);
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }
  
  getSelectionText(): string {
    const viewerElement = this.viewerElement;
    return viewerElement === null ? null : viewerElement.getSelectionText();
  }
  
  /**
   * 
   */
  openMenu(): void {
    const header = <HTMLDivElement>this._getById(ID_HEADER);
    const cm = <contextmenu>this._getById('contextmenu');
    const rect = header.getBoundingClientRect();
    cm.openAround(header); //(rect.left, rect.top );
  }
  
  /**
   * 
   */
  get text(): string {  // FIXME
    const kids = this.childNodes;
    let result = "";
    for (var i=0; i<kids.length; i++) {
      const kid = kids[i];
      if (kid.nodeName === "DIV") {
        var text = (<HTMLDivElement>kid).innerText;
        text = text.replace(REPLACE_NBSP_REGEX," ");
        result += util.trimRight(text) + "\n"
      }
    }
    return result;
  }
  
  set tag(tag: string) {
    this.setAttribute(EtEmbeddedViewer.ATTR_TAG, tag);
  }
  
  get tag(): string {
    return this.getAttribute(EtEmbeddedViewer.ATTR_TAG);
  }

  clearSelection(): void {
    const viewerElement = this.viewerElement;
    if (viewerElement === null) {
      return;
    }
    viewerElement.clearSelection();
  }

  set mode(newMode: ViewerElementTypes.Mode) {
    this._mode = newMode;
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      viewerElement.mode = newMode;
    }
  }

  get mode(): ViewerElementTypes.Mode {
    return this._mode;
  }

  focus(): void {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.focus();
    } else {
      super.focus();
    }
  }

  getCursorPosition(): ViewerElementTypes.CursorMoveDetail {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.getCursorPosition();
    }    
  }
  
  setCursorPositionTop(x: number): boolean {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionTop(x);
    }
    return false;
  }
  
  setCursorPositionBottom(x: number): boolean {
    const viewerElement = this.viewerElement;
    if (viewerElement !== null) {
      return viewerElement.setCursorPositionBottom(x);
    }
    return false;
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
   * Callback invoked by the browser after an instance of this element has been created.
   */
  createdCallback(): void {
    this._initProperties();
  }
  
  attachedCallback(): void {
    if (util.getShadowRoot(this) !== null) {
      return;
    }

    const shadow = util.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);

    this._setAttr(EtEmbeddedViewer.ATTR_COMMAND, this.getAttribute(EtEmbeddedViewer.ATTR_COMMAND));
    this._setAttr(EtEmbeddedViewer.ATTR_RETURN_CODE, this.getAttribute(EtEmbeddedViewer.ATTR_RETURN_CODE));
    this._setAttr(EtEmbeddedViewer.ATTR_EXPAND, this.getAttribute(EtEmbeddedViewer.ATTR_EXPAND));
    this._setAttr(EtEmbeddedViewer.ATTR_TAG, this.getAttribute(EtEmbeddedViewer.ATTR_TAG));

    this._getById(ID_POP_OUT_BUTTON).addEventListener('click', this._emitFramePopOut.bind(this));
    this._getById(ID_CLOSE_BUTTON).addEventListener('click', this._emitCloseRequest.bind(this));

    const expandbutton = this._getById(ID_EXPAND_BUTTON);
    expandbutton.addEventListener('click', (): void => {
      const expanded = util.htmlValueToBool(this.getAttribute(EtEmbeddedViewer.ATTR_EXPAND), true);
      this.setAttribute(EtEmbeddedViewer.ATTR_EXPAND, "" + !expanded);
    });

    this.addEventListener(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, (ev: CustomEvent) => {
      if (ev.target === this) {
        return;
      }
      ev.stopPropagation();
      
      // Send our own event. It will appear to have originated from the embedded viewer.
      const event = new CustomEvent(ViewerElement.EVENT_BEFORE_SELECTION_CHANGE, { bubbles: true });
      this.dispatchEvent(event);      
    });

    this.addEventListener(ViewerElement.EVENT_CURSOR_MOVE, (ev: CustomEvent) => {
      if (ev.target === this) {
        return;
      }
      ev.stopPropagation();
      
      // Send our own event. It will appear to have originated from the embedded viewer.
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_MOVE, { bubbles: true });
      this.dispatchEvent(event);      
    });

    this.addEventListener(ViewerElement.EVENT_CURSOR_EDGE, (ev: CustomEvent) => {
      if (ev.target === this) {
        return;
      }
      ev.stopPropagation();
      
      // Send our own event. It will appear to have originated from the embedded viewer.
      const event = new CustomEvent(ViewerElement.EVENT_CURSOR_EDGE, { bubbles: true, detail: ev.detail });
      this.dispatchEvent(event);      
    });

    const cm = <contextmenu>this._getById('contextmenu');
    this._getById('container').addEventListener('contextmenu', (ev: MouseEvent): void => {
      ev.stopPropagation();
      ev.preventDefault();
      const cm = <contextmenu>this._getById('contextmenu');
      cm.open(ev.clientX, ev.clientY);
    });

    cm.addEventListener('selected', (ev: CustomEvent): void => {
      let event: CustomEvent;
      switch (ev.detail.name) {
        case 'popout':
          this._emitFramePopOut();
          break;
        
        case "copycommand":
          event = new CustomEvent(EtEmbeddedViewer.EVENT_COPY_CLIPBOARD_REQUST);
          event.initCustomEvent(EtEmbeddedViewer.EVENT_COPY_CLIPBOARD_REQUST, true, true,
            this.getAttribute(EtEmbeddedViewer.ATTR_COMMAND));
          this.dispatchEvent(event);
          break;

        case "typecommand":
          event = new CustomEvent(EtEmbeddedViewer.EVENT_TYPE,
              { detail: this.getAttribute(EtEmbeddedViewer.ATTR_COMMAND) });
          event.initCustomEvent(EtEmbeddedViewer.EVENT_TYPE, true, true,
              this.getAttribute(EtEmbeddedViewer.ATTR_COMMAND));
          this.dispatchEvent(event);
          break;

        case "expand":
          this.setAttribute(EtEmbeddedViewer.ATTR_EXPAND, ev.detail.checked);
          break;

        case 'close':
          this._emitCloseRequest();
          break;

        default:
          break;
      }
      (<HTMLDivElement>this._getById(ID_HEADER)).focus();
    });

    cm.addEventListener('before-close', (function(ev: Event) {
      const header = this._getById(ID_HEADER);
      header.focus();
    }).bind(this));

    this.setHeight(this.getMinHeight());

    // Remove the anti-flicker style.
    this._getById('container').setAttribute('style', '');
  }

  /**
   * 
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    this._setAttr(attrName, newValue);
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
  private _createClone(): Node {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;
      
      const RUNNING_COLOR = new util.Color("#ffffff");
      const SUCCESS_COLOR = new util.Color("#54ff54");  // Linux green
      const FAIL_COLOR = new util.Color("#ff5454"); // Linux red
      const FOCUS_COLOR = new util.Color("#43ace8");
      const FADE_DURATION = "0.5s";

      template.innerHTML = `
        <style>
        ${globalcss.fontAwesomeCSS()}
        ${globalcss.topcoatCSS()}
        :host {
          display: block;
        }
      
        #${ID_CONTAINER} {
        }

        #${ID_HEADER} {
          display: flex;
          width: 100%;
        }
        
        @-webkit-keyframes PULSE_ANIMATION {
          0%   { outline-color: ${FOCUS_COLOR.toString()}; }
          50% { outline-color: ${FOCUS_COLOR.opacity(0.5).toString()}; }
          100%   { outline-color: ${FOCUS_COLOR.toString()}; }
        }
  
        #${ID_CONTAINER}:focus {
          -webkit-animation: PULSE_ANIMATION 2s infinite;
          animation: PULSE_ANIMATION 2s infinite;          
          
          outline-width: 4px;
          outline-offset: -2px;
          outline-color: ${FOCUS_COLOR.toString()};
          outline-style: solid;
        }

        #${ID_OUTPUT}.closed {
          display: none;
          height: 1px;
          overflow: hidden;
        }

        /* Block of controls top left/right */
        .left_block, .right_block {
          flex: 0 0 auto;
          display: flex;
          padding-top: 1px;
          padding-left: 0.5em;
          padding-right: 0.5em;
          padding-bottom: 1px;
          
          transition-property: border-color;
          transition-duration: ${FADE_DURATION};
        }
        
        .left_block {          
          border-top-left-radius: 0.5em;
          border-bottom-right-radius: 0.5em;
          border-left-width: 2px;
        }
        
        .right_block {          
          border-top-right-radius: 0.5em;
          border-bottom-left-radius: 0.5em;
          border-right-width: 2px;
        }

        #${ID_CONTAINER}.running > #${ID_HEADER} > .left_block {
          border: 1px solid ${RUNNING_COLOR.toString()};
          border-left-width: 2px;
        }

        #${ID_CONTAINER}.running > #${ID_HEADER} > .right_block {
          border: 1px solid ${RUNNING_COLOR.toString()};
          border-right-width: 2px;
        }
        
        #${ID_CONTAINER}.success > #${ID_HEADER} > .left_block {
          border: 1px solid ${SUCCESS_COLOR.toString()};          
          border-left-width: 2px;
        }
      
        #${ID_CONTAINER}.success > #${ID_HEADER} > .right_block {
          border: 1px solid ${SUCCESS_COLOR.toString()};          
          border-right-width: 2px;
        }

        #${ID_CONTAINER}.fail > #${ID_HEADER} > .left_block {
          border: 1px solid ${FAIL_COLOR.toString()};
          border-left-width: 2px;
        }
        
        #${ID_CONTAINER}.fail > #${ID_HEADER} > .right_block {
          border: 1px solid ${FAIL_COLOR.toString()};
          border-right-width: 2px;
        }
        
        /* *** Icon Div *** */
        #${ID_ICON_DIV} {
          display: inline-block;
          width: 1em;
          height: 1em;
        }

        #${ID_CONTAINER}.running > #${ID_HEADER} > DIV.left_block > #${ID_ICON_DIV} {
          color: ${RUNNING_COLOR.toString()};
        }

        #${ID_CONTAINER}.success > #${ID_HEADER} > DIV.left_block > #${ID_ICON_DIV} {
          color: ${SUCCESS_COLOR.toString()};          
        }

        #${ID_CONTAINER}.fail > #${ID_HEADER} > DIV.left_block > #${ID_ICON_DIV} {
          color: ${FAIL_COLOR.toString()};
        }
        
        /* *** Comand line DIV *** */
        #${ID_COMMANDLINE} {
          flex: auto 0 1;
          border-bottom-right-radius: 0.5em;
          padding-top: 1px;
          padding-left: 0.5em;
          padding-right: 0.5em;
          padding-bottom: 1px;

          transition-property: border-color;
          transition-duration: ${FADE_DURATION};
          color: white;
        }

        #${ID_CONTAINER}.running > #${ID_HEADER} > #${ID_COMMANDLINE} {
          border: 1px solid ${RUNNING_COLOR.toString()};
        }
        
        #${ID_CONTAINER}.success > #${ID_HEADER} > #${ID_COMMANDLINE} {
          border: 1px solid ${SUCCESS_COLOR.toString()};
        }

        #${ID_CONTAINER}.fail > #${ID_HEADER} > #${ID_COMMANDLINE} {
          border: 1px solid ${FAIL_COLOR.toString()};
        }

        #${ID_EXPAND_BUTTON}, #${ID_CLOSE_BUTTON}, #${ID_POP_OUT_BUTTON} {
          flex: 0 0 auto;
          padding: 0px;
          background-color: transparent;
          border: 0px;
          color: white;
        }

        #${ID_CLOSE_BUTTON}:hover {
          color: red;
        }

        #${ID_HEADER} > .header_spacer {
          transition-property: border-top-color;
          transition-duration: ${FADE_DURATION};
        }
        
        #${ID_CONTAINER}.running > #${ID_HEADER} > .header_spacer {
          border-top: 1px solid ${RUNNING_COLOR.opacity(0.5).toString()};
        }
        
        #${ID_CONTAINER}.success > #${ID_HEADER} > .header_spacer {
          border-top: 1px solid ${SUCCESS_COLOR.opacity(0.5).toString()};            
        }
        
        #${ID_CONTAINER}.fail > #${ID_HEADER} > .header_spacer {
          border-top: 1px solid ${FAIL_COLOR.opacity(0.5).toString()};
        }
        
        /* *** Output DIV *** */
        #${ID_OUTPUT} {
          border-left: 2px solid rgba(0,0,0,0);
          border-right: 2px solid rgba(0,0,0,0);
          transition-property: border-left-color, border-right-color;
          transition-duration: ${FADE_DURATION}, ${FADE_DURATION};
        }

        #${ID_CONTAINER}.success > #${ID_OUTPUT} {
          border-left-color: ${SUCCESS_COLOR};
          border-right-color: ${SUCCESS_COLOR};
        }
        
        #${ID_CONTAINER}.fail > #${ID_OUTPUT} {
          border-left-color: ${FAIL_COLOR.toString()};
          border-right-color: ${FAIL_COLOR.toString()};
        }
        
        
        #${ID_CONTAINER}.running > #${ID_OUTPUT} > .header_spacer {
          border-left-color ${RUNNING_COLOR.toString()};
        }
        
        #${ID_CONTAINER}.success > #${ID_OUTPUT} > .header_spacer {
          border-left-color: ${SUCCESS_COLOR.toString()};
        }
        
        #${ID_CONTAINER}.fail > #${ID_OUTPUT} > .header_spacer {
          border-top: 1px solid ${FAIL_COLOR.opacity(0.5).toString()};
        }
        
        .header_spacer {
          flex: 0em 1 1;
        }
        
        .spacer {
          flex: 1em 0 0;
          min-width: 1em;
        }
                
        #${ID_TAG_NAME} {
          flex: 0 1 auto;
          color: white;
        }
        
        #${ID_TAG_ICON} {
          color: white;
        }
        </style>
        <div id='${ID_CONTAINER}' style='display: none;' tabindex='-1' class='running'>
          <div id='${ID_HEADER}'>
            <div class='left_block'>
              <div id='${ID_ICON_DIV}'><i id='${ID_ICON}'></i></div>
              <div id='${ID_COMMANDLINE}'></div>
            </div>
            <div class='header_spacer'></div>
            <div class='right_block'>
              <div id='${ID_TAG_ICON}'><i class='fa fa-tag'></i></div>
              <div id='${ID_TAG_NAME}'></div>
              <div class='spacer'></div>
              <button id='${ID_EXPAND_BUTTON}' title='Expand/Collapse'><i id='${ID_EXPAND_ICON}' class='fa fa-plus-square-o'></i></button>
              <div class='spacer'></div>
              <button id='${ID_POP_OUT_BUTTON}'><i class='fa fa-external-link'></i></button>
              <div class='spacer'></div>
              <button id='${ID_CLOSE_BUTTON}' title='Close'><i class='fa fa-times-circle'></i></button>` +
            `</div>` +
          `</div>
          <div id='${ID_OUTPUT}'><content></content></div>
        </div>
        <cb-contextmenu id='contextmenu' style='display: none;'>
          <cb-menuitem icon='external-link' name='popout'>Open in Tab</cb-menuitem>
          <cb-menuitem icon='terminal' name='typecommand'>Type Command</cb-menuitem>
          <cb-menuitem icon='copy' name='copycommand'>Copy Command to Clipboard</cb-menuitem>
          <cb-checkboxmenuitem icon='list-ol' id='expandmenuitem' checked='true' name='expand'>Expand</cb-checkboxmenuitem>
          <cb-menuitem icon='times-circle' name='close'>Close</cb-menuitem>
        </cb-contextmenu>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private _getById(id: string): Element {
    return util.getShadowRoot(this).querySelector('#'+id);
  }

  /**
   * Process an attribute value change.
   */
  private _setAttr(attrName: string, newValue: string): void {
    if (util.getShadowRoot(this) === null) {
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_COMMAND) {
      (<HTMLDivElement>this._getById(ID_COMMANDLINE)).innerText = newValue;
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_RETURN_CODE) {
      const container = <HTMLDivElement>this._getById(ID_CONTAINER);
      const icon = <HTMLDivElement>this._getById(ID_ICON);
      const iconDiv = <HTMLDivElement>this._getById(ID_ICON_DIV);

      if (newValue === null || newValue === undefined || newValue === "") {
        icon.className = "fa fa-cog";
        container.classList.add('running');
        container.classList.remove('success');
        container.classList.remove('fail');
      } else {

        const rc = parseInt(newValue, 10);
        container.classList.remove('running');
        container.classList.remove('running');
        iconDiv.setAttribute('title', 'Return code: ' + rc);
        if (rc === 0) {
          icon.className = "fa fa-check";
          container.classList.add('success');
        } else {
          icon.className = "fa fa-times";
          container.classList.add('fail');
        }
      }

      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_EXPAND) {
      const output = <HTMLDivElement>this._getById('output');
      const expandicon = <HTMLDivElement>this._getById('expand_icon');
      if (util.htmlValueToBool(newValue, true)) {
        // Expanded.
        output.classList.remove('closed');
        expandicon.classList.remove('fa-plus-square-o');
        expandicon.classList.add('fa-minus-square-o');
        (<checkboxmenuitem>this._getById('expandmenuitem')).setAttribute('checked', "true");
      } else {
        // Collapsed.
        output.classList.add('closed');
        expandicon.classList.add('fa-plus-square-o');
        expandicon.classList.remove('fa-minus-square-o');
        (<checkboxmenuitem>this._getById('expandmenuitem')).setAttribute('checked', "false");
      }
      return;
    }

    if (attrName === EtEmbeddedViewer.ATTR_TAG) {
      const tagName = <HTMLDivElement>this._getById('tag_name');
      tagName.innerText = newValue;
    }
  }

  private _getViewerElement(): ViewerElement {
    if (this.firstElementChild !== null && this.firstElementChild instanceof ViewerElement) {
      return <ViewerElement> this.firstElementChild;
    } else {
      return null;
    }
  }

  /**
   * 
   */
  private _emitManualScroll(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_SCROLL_MOVE);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_SCROLL_MOVE, true, true, null);
    this.dispatchEvent(event);
  }
  
  private _emitFramePopOut(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_FRAME_POP_OUT);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_FRAME_POP_OUT, true, true, this);
    this.dispatchEvent(event);
  }

  private _emitCloseRequest(): void {
    const event = new CustomEvent(EtEmbeddedViewer.EVENT_CLOSE_REQUEST);
    event.initCustomEvent(EtEmbeddedViewer.EVENT_CLOSE_REQUEST, true, true, null);
    this.dispatchEvent(event);
  }
}

export = EtEmbeddedViewer;
