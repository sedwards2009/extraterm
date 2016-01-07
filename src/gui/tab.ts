/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import domutils = require('../domutils');
import util = require("./util");

const ID = "CbTabTemplate";

let registered = false;

class CbTab extends HTMLElement {
  
  static TAG_NAME = "CB-TAB";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbTab.TAG_NAME, {prototype: CbTab.prototype});
      registered = true;
    }
  }

  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<div><content></content></div>`;
      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  createdCallback() {
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
  }
}

export = CbTab;
