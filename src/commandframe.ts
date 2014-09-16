///<reference path='./chrome_lib.d.ts'/>
///<reference path='./requirejs.d.ts'/>

import contextmenu = require('gui/contextmenu');
import menuitem = require('gui/menuitem');
import checkboxmenuitem = require('gui/checkboxmenuitem');
import util = require('gui/util');

contextmenu.init();
menuitem.init();
checkboxmenuitem.init();

var ID = "EtCommandFrameTemplate";
var COMMANDLINE_ATTR = "command-line";
var RETURN_CODE_ATTR = "return-code";
var EXPAND_ATTR = "expand";
var LINE_NUMBERS_ATTR = "line-numbers";
var TAG_ATTR = "tag";

var registered = false;
var REPLACE_NBSP_REGEX = new RegExp("\u00A0","g");

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
    var template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = window.document.createElement('template');
      template.id = ID;

      var success_color = "#00ff00";
      var fail_color = "#ff0000";
      template.innerHTML = "<style>\n" +
        "@import url('" + requirejs.toUrl("css/topcoat-desktop-light.css") + "');\n" +
        "@import url('" + requirejs.toUrl("css/font-awesome.css") + "');\n" +

        ":host {\n" +
        "display: block;\n" +
        "}\n" +
      
        "#container {\n" +
        "  display: flex;\n" +
        "}\n" +

        "#main {\n" +
        "  flex: 1 1 auto;\n" +
        "}\n" +

        "#header {\n" +
        "  border-top-right-radius: 0.5em;\n" +
        "  border-bottom-right-radius: 0.5em;\n" +
        "  padding-top: 1px;\n" +
        "  padding-left: 0.5em;\n" +
        "  padding-right: 0.5em;\n" +
        "  padding-bottom: 1px;\n" +
        "  display: flex;\n" +
        "}\n" +

        "#header.running {\n" +
        "  border: 1px solid white;\n" +
        "}\n" +

        "#header.success {\n" +
        "  border-top: 1px solid " + success_color + ";\n" +
        "  border-bottom: 1px solid " + success_color + ";\n" +
        "  border-right: 1px solid " + success_color + ";\n" +
        "}\n" +

        "#header.fail {\n" +
        "  border-top: 1px solid " + fail_color + ";\n" +
        "  border-bottom: 1px solid " + fail_color + ";\n" +
        "  border-right: 1px solid " + fail_color + ";\n" +
        "}\n" +

        "@-webkit-keyframes PULSE_ANIMATION {\n" +
        "  0%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
        "  25%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
        "  50% { background-color: rgba(255, 165, 0, 0.5); }\n" +
        "  75% { background-color: rgba(255, 165, 0, 1.0); }\n" +
        "  100%   { background-color: rgba(255, 165, 0, 1.0); }\n" +
        "}\n" +

        "#header:focus {\n" +
        "  -webkit-animation: PULSE_ANIMATION 2s infinite;\n" +
        "  animation: PULSE_ANIMATION 2s infinite;\n" +
        "}\n" +

        "#output.closed {\n" +
        "  display: none;\n" +
        "  height: 1px;\n" +
        "  overflow: hidden;\n" +
        "}\n" +

        "#gutter {\n" +
        "  flex: 2rem 0 0;\n" +
        "  width: 2rem;\n" +
        "  padding: 1px\n" +
        "}\n" +

        "#gutter.running {\n" +
        "}\n" +

        "#gutter.success {\n" +
        "  color: " + success_color + ";\n" +
        "  border-right: 1px solid " + success_color + ";\n" +
        "}\n" +

        "#gutter.fail {\n" +
        "  color: " + fail_color + ";\n" +
        "  border-right: 1px solid " + fail_color + ";\n" +
        "}\n" +

        "#commandline {\n" +
        "  flex: auto 1 1;\n" +
        "}\n" +

        "#close_button {\n" +
        "  flex: 0 0 auto;\n" +
        "  padding: 0px;\n" +
        "  background-color: transparent;\n" +
        "  border: 0px;\n" +
        "  color: white;\n" +
        "}\n" +
        "#close_button:hover {\n" +
        "  color: red;\n" +
        "}\n" +
      
        ".header_spacer {\n" +
        "  flex: 2em 0 0;\n" +
        "  min-width: 2em;\n" +
        "}\n" +
      
        "#tag_name {\n" +
        "  flex: 0 1 auto;\n" +
        "}\n" +
      
        "#icon_div {\n" +
        "  display: inline-block;\n" +
        "  width: 1em;\n" +
        "  height: 1em;\n" +
        "}\n" +

        "#expand_button {\n" +
        "  display: inline-block;\n" +
        "  padding: 0px;\n" +
        "  background-color: transparent;\n" +
        "  color: white;\n" +
        "  border: 0px;\n" +
        "  width: 1em;\n" +
        "  height: 1em;\n" +
        "}\n" +

        "content.line_numbers::content > div {\n" +
        "  counter-increment: lines;\n" +
        "  position: relative;\n" +
        "  left: calc(-2rem - 2px);\n" +
        "}\n" +

        "content.line_numbers::content > div:before {\n" +
        "  display: inline-block;\n" +
        "  width: 2rem;\n" +
        "  margin-right: 2px;\n" +
        "  content: counter(lines);\n" +
        "  color: white;\n" +
        "  text-align: right;\n" +
        "  font-size: 0.7rem;\n" +
        "  }\n" +
        "</style>\n" +
        "<div id='container' style='display: none;'>" +
        "  <div id='gutter' class='running'>" +
         "<div id='icon_div'><i id='icon'></i></div>" +
         "<button id='expand_button'><i id='expand_icon' class='fa fa-plus-square-o'></i></button>" +
        "  </div>" +
        "  <div id='main'>" +
        "    <div id='header' tabindex='-1'>" +
              "<div id='commandline'></div>" +
              "<i class='fa fa-tag'></i>" +
              "<div id='tag_name'></div>" +
              "<div class='header_spacer'></div>" +
              "<button id='close_button'><i class='fa fa-times-circle'></i></button>" +
        "    </div>" +
        "    <div id='output'><content id='lines_content'></content></div>" +
        "  </div>" +
        "</div>" +
        "<cb-contextmenu id='contextmenu' style='display: none;'>\n" +
        "<cb-menuitem icon='terminal' name='typecommand'>Type Command</cb-menuitem>\n" +
        "<cb-menuitem icon='copy' name='copycommand'>Copy Command to Clipboard</cb-menuitem>\n" +
        "<cb-checkboxmenuitem icon='list-ol' id='expandmenuitem' checked='true' name='expand'>Expand</cb-checkboxmenuitem>\n" +
        "<cb-checkboxmenuitem icon='list-ol' id='linesnumbersmenuitem' checked='false' name='showlines'>Line numbers</cb-checkboxmenuitem>\n" +
        "<cb-menuitem icon='times-circle' name='close'>Close</cb-menuitem>\n" +
        "</cb-contextmenu>\n";
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
      var gutter = <HTMLDivElement>this._getById('gutter');
      var icon = <HTMLDivElement>this._getById("icon");
      var header= <HTMLDivElement>this._getById('header');

      if (newValue === null || newValue === undefined || newValue === "") {
        icon.className = "fa fa-cog";
        gutter.classList.add('running');
        header.classList.add('running');
      } else {

        var rc = parseInt(newValue, 10);
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
      var output = <HTMLDivElement>this._getById('output');
      var expandicon = <HTMLDivElement>this._getById('expand_icon');
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
      var linescontent = <HTMLDivElement>this._getById('lines_content');
      if (util.htmlValueToBool(newValue, false)) {
        linescontent.classList.add('line_numbers');
      } else {
        linescontent.classList.remove('line_numbers');      
      }
      return;
    }
    
    if (attrName === TAG_ATTR) {
      var tagName = <HTMLDivElement>this._getById('tag_name');
      tagName.innerText = newValue;
    }
  }

  /**
   * Callback invoked by the browser after an instance of this element has been created.
   */
  createdCallback(): void {
    var shadow = util.createShadowRoot(this);

    var clone = this._createClone();
    shadow.appendChild(clone);

    this._setAttr(COMMANDLINE_ATTR, this.getAttribute(COMMANDLINE_ATTR));
    this._setAttr(RETURN_CODE_ATTR, this.getAttribute(RETURN_CODE_ATTR));
    this._setAttr(EXPAND_ATTR, this.getAttribute(EXPAND_ATTR));
    this._setAttr(LINE_NUMBERS_ATTR, this.getAttribute(LINE_NUMBERS_ATTR));
    this._setAttr(TAG_ATTR, this.getAttribute(TAG_ATTR));

    var closebutton = this._getById('close_button');
    closebutton.addEventListener('click', (function() {
        var event = new CustomEvent('close-request', { detail: null });
        this.dispatchEvent(event);
    }).bind(this));

    var expandbutton = this._getById('expand_button');
    expandbutton.addEventListener('click', (function() {
      var expanded = util.htmlValueToBool(this.getAttribute(EXPAND_ATTR), true);
      this.setAttribute(EXPAND_ATTR, !expanded);
    }).bind(this));

    var cm = <contextmenu>this._getById('contextmenu');
    this._getById('container').addEventListener('contextmenu', (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      var cm = <contextmenu>this._getById('contextmenu');
      cm.open(ev.clientX, ev.clientY);
    });

    cm.addEventListener('selected', (function(ev: CustomEvent) {
      var event: CustomEvent;
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
      this._getById('header').focus();
    }).bind(this));

    cm.addEventListener('before-close', (function(ev: Event) {
      var header = this._getById('header');
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
    var header = <HTMLDivElement>this._getById('header');
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }

  /**
   * 
   */
  focusFirst(): void {
    var header = <HTMLDivElement>this._getById('header');
    header.focus();
    this.scrollIntoView(true);
    this._emitManualScroll();
  }
  
  /**
   * 
   */
  private _emitManualScroll(): void {
    var event = new CustomEvent('close-request');
    event.initCustomEvent('scroll-move', true, true, null);
    this.dispatchEvent(event);
  }
  
  /**
   * 
   */
  openMenu(): void {
    var header = <HTMLDivElement>this._getById('header');
    var cm = <contextmenu>this._getById('contextmenu');
    var rect = header.getBoundingClientRect();
    cm.openAround(header); //(rect.left, rect.top );
  }
  
  /**
   * 
   */
  get text(): string {
    var kids = this.childNodes;
    var result = "";
    for (var i=0; i<kids.length; i++) {
      var kid = kids[i];
      if (kid.nodeName === "DIV") {
        var text = (<HTMLDivElement>kid).innerText;
        text = text.replace(REPLACE_NBSP_REGEX," ");
        result += util.trimRight(text) + "\n"
      }
    }
    return result;
  }
}

export = EtCommandFrame;
