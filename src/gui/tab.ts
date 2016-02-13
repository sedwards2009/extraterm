/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import domutils = require('../domutils');
import util = require("./util");

const ID = "CbTabTemplate";

let registered = false;

/**
 * Holds the contents of one tab inside a CbTabWidget tag.
 */
class CbTab extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "CB-TAB";

  /**
   * Initialize the CbTab class and resources.
   *
   * When CbTab is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbTab.TAG_NAME, {prototype: CbTab.prototype});
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
  createdCallback() {
    const shadow = domutils.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
  }
  
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
}

export = CbTab;
