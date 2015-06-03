/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */

import resourceLoader = require('./resourceloader');
import contextmenu = require('./gui/contextmenu');
import menuitem = require('./gui/menuitem');
import checkboxmenuitem = require('./gui/checkboxmenuitem');
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

let registered = false;
const REPLACE_NBSP_REGEX = new RegExp("\u00A0","g");

class EtCommandFrame extends HTMLElement {
  
  /**
   * 
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement('et-commandframe', {prototype: EtCommandFrame.prototype});
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

      const success_color = "#00ff00";
      const fail_color = "#ff0000";
      template.innerHTML = `<style>
        @import '${resourceLoader.toUrl('css/font-awesome.css')}';
        @import '${resourceLoader.toUrl('css/topcoat-desktop-light.css')}';

        :host {
          display: block;
        }
      
        #container {
          display: flex;
        }

        #main {
          flex: 1 1 auto;
        }

        #header {
          border-top-right-radius: 0.5em;
          border-bottom-right-radius: 0.5em;
          padding-top: 1px;
          padding-left: 0.5em;
          padding-right: 0.5em;
          padding-bottom: 1px;
          display: flex;
        }

        #header.running {
          border: 1px solid white;
        }

        #header.success {
          border-top: 1px solid ${success_color};
          border-bottom: 1px solid ${success_color};
          border-right: 1px solid ${success_color};
        }

        #header.fail {
          border-top: 1px solid ${fail_color};
          border-bottom: 1px solid ${fail_color};
          border-right: 1px solid ${fail_color};
        }

        @-webkit-keyframes PULSE_ANIMATION {
          0%   { background-color: rgba(255, 165, 0, 1.0); }
          25%   { background-color: rgba(255, 165, 0, 1.0); }
          50% { background-color: rgba(255, 165, 0, 0.5); }
          75% { background-color: rgba(255, 165, 0, 1.0); }
          100%   { background-color: rgba(255, 165, 0, 1.0); }
        }

        #header:focus {
          -webkit-animation: PULSE_ANIMATION 2s infinite;
          animation: PULSE_ANIMATION 2s infinite;
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
          color: ${success_color};
          border-right: 1px solid ${success_color};
        }

        #gutter.fail {
          color: ${fail_color};
          border-right: 1px solid ${fail_color};
        }

        #commandline {
          flex: auto 1 1;
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
      
        .header_spacer {
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
        <div id='container' style='display: none;'>
          <div id='gutter' class='running'>
         <div id='icon_div'><i id='icon'></i></div>
         <button id='expand_button'><i id='expand_icon' class='fa fa-plus-square-o'></i></button>
          </div>
          <div id='main'>
            <div id='header' tabindex='-1'>
              <div id='commandline'></div>
              <i class='fa fa-tag'></i>
              <div id='tag_name'></div>
              <div class='header_spacer'></div>
              <button id='pop_out_button'><i class='fa fa-external-link'></i></button>
              <div class='header_spacer'></div>
              <button id='close_button'><i class='fa fa-times-circle'></i></button>
            </div>
            <div id='output'><content id='lines_content'></content></div>
          </div>
        </div>
        <cb-contextmenu id='contextmenu' style='display: none;'>
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
      const header= <HTMLDivElement>this._getById('header');

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

    const popOutButton = this._getById('pop_out_button');
    popOutButton.addEventListener('click', (): void => {
        var event = new CustomEvent('frame-pop-out', { detail: this });
        this.dispatchEvent(event);
    });
    
    const closebutton = this._getById('close_button');
    closebutton.addEventListener('click', (): void => {
        var event = new CustomEvent('close-request', { detail: null });
        this.dispatchEvent(event);
    });

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
        case "copycommand":
          event = new CustomEvent('copy-clipboard-request');
          event.initCustomEvent('copy-clipboard-request', true, true, this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "typecommand":
          event = new CustomEvent('type', { detail: this.getAttribute(COMMANDLINE_ATTR) });
          event.initCustomEvent('type', true, true, this.getAttribute(COMMANDLINE_ATTR));
          this.dispatchEvent(event);
          break;

        case "showlines":
          this.setAttribute(LINE_NUMBERS_ATTR, ev.detail.checked);
          break;

        case "expand":
          this.setAttribute(EXPAND_ATTR, ev.detail.checked);
          break;

        case 'close':
          event = new CustomEvent('close-request');
          event.initCustomEvent('close-request', true, true, null);
          this.dispatchEvent(event);
          break;

        default:
          break;
      }
      (<HTMLDivElement>this._getById('header')).focus();
    });

    cm.addEventListener('before-close', (function(ev: Event) {
      const header = this._getById('header');
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
    const header = <HTMLDivElement>this._getById('header');
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }

  /**
   * 
   */
  focusFirst(): void {
    const header = <HTMLDivElement>this._getById('header');
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }
  
  /**
   * 
   */
  private _emitManualScroll(): void {
    const event = new CustomEvent('scroll-move');
    event.initCustomEvent('scroll-move', true, true, null);
    this.dispatchEvent(event);
  }
  
  private _emitFramePopOut(frame: EtCommandFrame): void {
    const event = new CustomEvent('frame-pop-out');
    event.initCustomEvent('frame-pop-out', true, true, frame);
    this.dispatchEvent(event);
  }
  
  /**
   * 
   */
  openMenu(): void {
    const header = <HTMLDivElement>this._getById('header');
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
