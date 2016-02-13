/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import domutils = require('../domutils');
import util = require('./util');
import resourceLoader = require('../resourceloader');
import globalcss = require('./globalcss');

const ID = "CbMenuItemTemplate";

let registered = false;

/**
 * A menu item suitable for use inside a CbContextMenu.
 */
class CbMenuItem extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-MENUITEM';
  
  static ATTR_SELECTED = 'selected';

  /**
   * Initialize the CbMenuItem class and resources.
   *
   * When CbMenuItem is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      globalcss.init();
      window.document.registerElement(CbMenuItem.TAG_NAME, {prototype: CbMenuItem.prototype});
      registered = true;
    }
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
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    const shadow = domutils.createShadowRoot(this);
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
  
  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    if (attrName === CbMenuItem.ATTR_SELECTED) {
      this.updateKeyboardSelected(newValue);
    }
  }
  
  //-----------------------------------------------------------------------
  private _html(): string {
    return `
      <style>
      ${globalcss.fontAwesomeCSS()}
      
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
      </style>
      <div id='container'>
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
      template.innerHTML = this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  _clicked(): void {}
  
  private updateKeyboardSelected(value: string): void {
    const shadow = domutils.getShadowRoot(this);
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
