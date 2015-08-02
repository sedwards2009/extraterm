/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./util');
import resourceLoader = require('../resourceloader');
import globalcss = require('./globalcss');

const ID = "CbMenuItemTemplate";

let registered = false;

class CbMenuItem extends HTMLElement {
  
  static TAG_NAME = 'cb-menuitem';
  
  static ATTR_SELECTED = 'selected';
  
  //-----------------------------------------------------------------------
  // Statics

  static init(): void {
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(CbMenuItem.TAG_NAME, {prototype: CbMenuItem.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  createdCallback(): void {
    const shadow = util.createShadowRoot(this);
    const clone = this._createClone();
    shadow.appendChild(clone);

    let iconhtml = "";
    const icon = this.getAttribute('icon');
    if (icon !== null && icon !== "") {
      iconhtml += "<i class='fa fa-fw fa-" + icon + "'></i>";
    } else {
      iconhtml += "<i class='fa fa-fw'></i>";
    }
    (<HTMLElement>shadow.querySelector("#icon2")).innerHTML = iconhtml; 
    
    this.updateKeyboardSelected(this.getAttribute(CbMenuItem.ATTR_SELECTED));
  }
  
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    if (attrName === CbMenuItem.ATTR_SELECTED) {
      this.updateKeyboardSelected(newValue);
    }
  }
  
  //-----------------------------------------------------------------------
  private _css(): string {
    // This import below triggers a crash bug in chrome when the tab is closed.
    return `${globalcss.fontAwesomeCSS()}
      :host {
          display: block;
          color: #000;
          font: 16px 'Source Sans', helvetica, arial, sans-serif;
          font-weight: 400;
      }
      #container {
          cursor: default;
          padding: 1px;
          display: flex;
      }
      .selected {
          background-color: #288edf;
          color: #ffffff;
      }
      #icon1, #icon2 {
          flex: auto 0 0;
          white-space: pre;
      }
      #label {
          flex: auto 1 1;
          padding-left: 0.5rem;
          white-space: pre;
      }
`;
  }

  private _html(): string {
    return `<div id='container'>
      <div id='icon1'><i class='fa fa-fw'></i></div>
      <div id='icon2'></div>
      <div id='label'><content></content></div>
      </div>`;
  }

  private _createClone(): Node {
    let template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  _clicked(): void {}
  
  private updateKeyboardSelected(value: string): void {
    const shadow = util.getShadowRoot(this);
    const container = <HTMLDivElement>shadow.querySelector("#container");
    const on = value === "true";
    if (on) {
      container.classList.add('selected');
    } else {
      container.classList.remove('selected');
    }
  }
}

export = CbMenuItem;
