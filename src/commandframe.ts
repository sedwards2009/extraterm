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

const ID = "EtCommandFrameTemplate";
const COMMANDLINE_ATTR = "command-line";
const RETURN_CODE_ATTR = "return-code";
const EXPAND_ATTR = "expand";
const LINE_NUMBERS_ATTR = "line-numbers";
const TAG_ATTR = "tag";
const ID_CONTAINER = "container";
const ID_HEADER = "header";

let registered = false;
const REPLACE_NBSP_REGEX = new RegExp("\u00A0","g");

class EtCommandFrame extends HTMLElement {
  
  static TAG_NAME = "et-commandframe";
  
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
      window.document.registerElement(EtCommandFrame.TAG_NAME, {prototype: EtCommandFrame.prototype});
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
      
      template.innerHTML = `<style>
        ${globalcss.fontAwesomeCSS()}
        ${globalcss.topcoatCSS()}

        :host {
          display: block;
        }
      
        #${ID_CONTAINER} {
          display: flex;
        }

        #main {
          flex: 1 1 auto;
        }

        #${ID_HEADER} {
          display: flex;
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

        #output.closed {
          display: none;
          height: 1px;
          overflow: hidden;
        }

        #gutter {
          flex: 2rem 0 0;
          width: 2rem;
          padding: 1px
        }

        #gutter.running {
        }

        #gutter.success {
          color: ${SUCCESS_COLOR.toString()};
          border-right: 1px solid ${SUCCESS_COLOR.toString()};
        }

        #gutter.fail {
          color: ${FAIL_COLOR.toString()};
          border-right: 1px solid ${FAIL_COLOR.toString()};
        }
        
        /* Block of controls top right */
        .right_block {
          flex: 0 0 auto;
          display: flex;
          border-top-right-radius: 0.5em;
          border-bottom-left-radius: 0.5em;
          padding-top: 1px;
          padding-left: 0.5em;
          padding-right: 0.5em;
          padding-bottom: 1px;
        }
        
        #${ID_HEADER}.running > .right_block {
          border: 1px solid ${RUNNING_COLOR.toString()};
        }

        #${ID_HEADER}.success > .right_block {
          border: 1px solid ${SUCCESS_COLOR.toString()};          
        }

        #${ID_HEADER}.fail > .right_block {
          border: 1px solid ${FAIL_COLOR.toString()};
        }

        #commandline {
          flex: auto 0 1;
          border-bottom-right-radius: 0.5em;
          padding-top: 1px;
          padding-left: 0.5em;
          padding-right: 0.5em;
          padding-bottom: 1px;
        }
        
        #${ID_HEADER}.running > #commandline {
          border: 1px solid ${RUNNING_COLOR.toString()};
        }
        
        #${ID_HEADER}.success > #commandline {
          border: 1px solid ${SUCCESS_COLOR.toString()};
          border-left: 0px;
        }

        #${ID_HEADER}.fail > #commandline {
          border: 1px solid ${FAIL_COLOR.toString()};
          border-left: 0px;
        }

        #close_button, #pop_out_button {
          flex: 0 0 auto;
          padding: 0px;
          background-color: transparent;
          border: 0px;
          color: white;
        }
        #close_button:hover {
          color: red;
        }
        
        #${ID_HEADER}.running > .header_spacer {
          border-top: 1px solid ${RUNNING_COLOR.opacity(0.5).toString()};
        }
        
        #${ID_HEADER}.success > .header_spacer {
          border-top: 1px solid ${SUCCESS_COLOR.opacity(0.5).toString()};            
        }
        
        #${ID_HEADER}.fail > .header_spacer {
          border-top: 1px solid ${FAIL_COLOR.opacity(0.5).toString()};
        }
        
        .header_spacer {
          flex: 0em 1 1;
        }
        
        .spacer {
          flex: 2em 0 0;
          min-width: 2em;
        }
                
        #tag_name {
          flex: 0 1 auto;
        }
      
        #icon_div {
          display: inline-block;
          width: 1em;
          height: 1em;
        }

        #expand_button {
          display: inline-block;
          padding: 0px;
          background-color: transparent;
          color: white;
          border: 0px;
          width: 1em;
          height: 1em;
        }

        content.line_numbers::content > div {
          counter-increment: lines;
          position: relative;
          left: calc(-2rem - 2px);
        }

        content.line_numbers::content > div:before {
          display: inline-block;
          width: 2rem;
          margin-right: 2px;
          content: counter(lines);
          color: white;
          text-align: right;
          font-size: 0.7rem;
          }
        </style>
        <div id='${ID_CONTAINER}' style='display: none;' tabindex='-1'>
          <div id='gutter' class='running'>` +
            `<div id='icon_div'><i id='icon'></i></div>` +
            `<button id='expand_button'><i id='expand_icon' class='fa fa-plus-square-o'></i></button>` +
          `</div>
          <div id='main'>
            <div id='${ID_HEADER}'>
              <div id='commandline'></div>
              <div class='header_spacer'></div>
              <div class='right_block'>
                <div id='tag_icon'><i class='fa fa-tag'></i></div>
                <div id='tag_name'></div>
                <div class='spacer'></div>
                <button id='pop_out_button'><i class='fa fa-external-link'></i></button>
                <div class='spacer'></div>
                <button id='close_button'><i class='fa fa-times-circle'></i></button>` +
              `</div>` +
            `</div>
            <div id='output'><content id='lines_content'></content></div>
          </div>
        </div>
        <cb-contextmenu id='contextmenu' style='display: none;'>
          <cb-menuitem icon='external-link' name='popout'>Open in Tab</cb-menuitem>
          <cb-menuitem icon='terminal' name='typecommand'>Type Command</cb-menuitem>
          <cb-menuitem icon='copy' name='copycommand'>Copy Command to Clipboard</cb-menuitem>
          <cb-checkboxmenuitem icon='list-ol' id='expandmenuitem' checked='true' name='expand'>Expand</cb-checkboxmenuitem>
          <cb-checkboxmenuitem icon='list-ol' id='linesnumbersmenuitem' checked='false' name='showlines'>Line numbers</cb-checkboxmenuitem>
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
      (<HTMLDivElement>this._getById('commandline')).innerText = newValue;
      return;
    }

    if (attrName === RETURN_CODE_ATTR) {
      const gutter = <HTMLDivElement>this._getById('gutter');
      const icon = <HTMLDivElement>this._getById("icon");
      const header= <HTMLDivElement>this._getById(ID_HEADER);

      if (newValue === null || newValue === undefined || newValue === "") {
        icon.className = "fa fa-cog";
        gutter.classList.add('running');
        header.classList.add('running');
      } else {

        const rc = parseInt(newValue, 10);
        gutter.classList.remove('running');
        header.classList.remove('running');
        gutter.setAttribute('title', 'Return code: ' + rc);
        if (rc === 0) {
          icon.className = "fa fa-check";
          gutter.classList.add('success');
          header.classList.add('success');
        } else {
          icon.className = "fa fa-times";
          gutter.classList.add('fail');
          header.classList.add('fail');
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

    if (attrName === LINE_NUMBERS_ATTR) {
      const linescontent = <HTMLDivElement>this._getById('lines_content');
      if (util.htmlValueToBool(newValue, false)) {
        linescontent.classList.add('line_numbers');
      } else {
        linescontent.classList.remove('line_numbers');      
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
    this._setAttr(LINE_NUMBERS_ATTR, this.getAttribute(LINE_NUMBERS_ATTR));
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
          event = new CustomEvent(EtCommandFrame.EVENT_COPY_CLIPBOARD_REQUST);
          event.initCustomEvent(EtCommandFrame.EVENT_COPY_CLIPBOARD_REQUST, true, true,
            this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "typecommand":
          event = new CustomEvent(EtCommandFrame.EVENT_TYPE, { detail: this.getAttribute(COMMANDLINE_ATTR) });
          event.initCustomEvent(EtCommandFrame.EVENT_TYPE, true, true, this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "showlines":
          this.setAttribute(LINE_NUMBERS_ATTR, ev.detail.checked);
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
    const event = new CustomEvent(EtCommandFrame.EVENT_SCROLL_MOVE);
    event.initCustomEvent(EtCommandFrame.EVENT_SCROLL_MOVE, true, true, null);
    this.dispatchEvent(event);
  }
  
  private _emitFramePopOut(): void {
    const event = new CustomEvent(EtCommandFrame.EVENT_FRAME_POP_OUT);
    event.initCustomEvent(EtCommandFrame.EVENT_FRAME_POP_OUT, true, true, this);
    this.dispatchEvent(event);
  }

  private _emitCloseRequest(): void {
    const event = new CustomEvent(EtCommandFrame.EVENT_CLOSE_REQUEST);
    event.initCustomEvent(EtCommandFrame.EVENT_CLOSE_REQUEST, true, true, null);
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

export = EtCommandFrame;
