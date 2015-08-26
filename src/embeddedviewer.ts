/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import resourceLoader = require('./resourceloader');
import contextmenu = require('./gui/contextmenu');
import menuitem = require('./gui/menuitem');
import checkboxmenuitem = require('./gui/checkboxmenuitem');
import globalcss = require('./gui/globalcss');
import util = require('./gui/util');

contextmenu.init();
menuitem.init();
checkboxmenuitem.init();

const ID = "EtEmbeddedViewerTemplate";

const COMMANDLINE_ATTR = "command-line";
const RETURN_CODE_ATTR = "return-code";
const EXPAND_ATTR = "expand";
const TAG_ATTR = "tag";
const ID_CONTAINER = "container";
const ID_HEADER = "header";
const ID_OUTPUT = "output";
const ID_ICON = "icon";
const ID_ICON_DIV = "icondiv";
const ID_COMMANDLINE = "commandline";

let registered = false;
const REPLACE_NBSP_REGEX = new RegExp("\u00A0","g");

class EtEmbeddedViewer extends HTMLElement {
  
  static TAG_NAME = "et-embeddedviewer";
  
  static EVENT_COPY_CLIPBOARD_REQUST = 'copy-clipboard-request';
  
  static EVENT_TYPE = 'type';
  
  static EVENT_CLOSE_REQUEST = 'close-request';
  
  static EVENT_FRAME_POP_OUT = 'frame-pop-out';
  
  static EVENT_SCROLL_MOVE = 'scroll-move';

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

        #expand_button, #close_button, #pop_out_button {
          flex: 0 0 auto;
          padding: 0px;
          background-color: transparent;
          border: 0px;
          color: white;
        }

        #close_button:hover {
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
                
        #tag_name {
          flex: 0 1 auto;
          color: white;
        }
        
        #tag_icon {
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
              <div id='tag_icon'><i class='fa fa-tag'></i></div>
              <div id='tag_name'></div>
              <div class='spacer'></div>
              <button id='expand_button' title='Expand/Collapse'><i id='expand_icon' class='fa fa-plus-square-o'></i></button>
              <div class='spacer'></div>
              <button id='pop_out_button'><i class='fa fa-external-link'></i></button>
              <div class='spacer'></div>
              <button id='close_button' title='Close'><i class='fa fa-times-circle'></i></button>` +
            `</div>` +
          `</div>
          <div id='${ID_OUTPUT}'><content id='lines_content'></content></div>
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
    if (attrName === COMMANDLINE_ATTR) {
      (<HTMLDivElement>this._getById(ID_COMMANDLINE)).innerText = newValue;
      return;
    }

    if (attrName === RETURN_CODE_ATTR) {
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

    if (attrName === EXPAND_ATTR) {
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

    if (attrName === TAG_ATTR) {
      const tagName = <HTMLDivElement>this._getById('tag_name');
      tagName.innerText = newValue;
    }
  }

  /**
   * Callback invoked by the browser after an instance of this element has been created.
   */
  createdCallback(): void {
    const shadow = util.createShadowRoot(this);

    const clone = this._createClone();
    shadow.appendChild(clone);

    this._setAttr(COMMANDLINE_ATTR, this.getAttribute(COMMANDLINE_ATTR));
    this._setAttr(RETURN_CODE_ATTR, this.getAttribute(RETURN_CODE_ATTR));
    this._setAttr(EXPAND_ATTR, this.getAttribute(EXPAND_ATTR));
    this._setAttr(TAG_ATTR, this.getAttribute(TAG_ATTR));

    this._getById('pop_out_button').addEventListener('click', this._emitFramePopOut.bind(this));
    this._getById('close_button').addEventListener('click', this._emitCloseRequest.bind(this));

    const expandbutton = this._getById('expand_button');
    expandbutton.addEventListener('click', (): void => {
      var expanded = util.htmlValueToBool(this.getAttribute(EXPAND_ATTR), true);
      this.setAttribute(EXPAND_ATTR, "" + !expanded);
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
            this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "typecommand":
          event = new CustomEvent(EtEmbeddedViewer.EVENT_TYPE, { detail: this.getAttribute(COMMANDLINE_ATTR) });
          event.initCustomEvent(EtEmbeddedViewer.EVENT_TYPE, true, true, this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "expand":
          this.setAttribute(EXPAND_ATTR, ev.detail.checked);
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

    // Remove the anti-flicker style.
    window.requestAnimationFrame( () => {
      this._getById('container').setAttribute('style', '');
    });
  }

  /**
   * 
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string) {
    this._setAttr(attrName, newValue);
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
  get text(): string {
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
    this.setAttribute(TAG_ATTR, tag);
  }
  
  get tag(): string {
    return this.getAttribute(TAG_ATTR);
  }
}

export = EtEmbeddedViewer;
