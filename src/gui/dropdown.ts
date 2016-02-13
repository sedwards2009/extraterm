/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import contextmenu = require('./contextmenu');
import domutils = require('../domutils');
import util = require('./util');

contextmenu.init();

var ID = "CbDropDownTemplate";

var registered = false;

/**
 * A Drop Down menu.
 *
 * The contents of a CbDropDown should be a CbContextMenu element and another
 * element like a button which emits a click event. When the user activates
 * the button, the CbContextMenu is displayed.
 */
class CbDropDown extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-DROPDOWN';
  
  /**
   * Initialize the CbDropDown class and resources.
   *
   * When CbDropDown is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbDropDown.TAG_NAME, {prototype: CbDropDown.prototype});
      registered = true;
    }
  }
  
  private createClone() {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "\n" +
        "<div><content select='cb-contextmenu'></content></div>" +
        "<div><content></content></div>";
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
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
    var i: number;
    var len: number;
    var kid: Node;
    var shadow: ShadowRoot;
    var cm: contextmenu;
    var clickHandler: (ev: MouseEvent) => void;
    var clone: Node;

    shadow = domutils.createShadowRoot(this);
    clone = this.createClone();
    shadow.appendChild(clone);

    clickHandler = (ev: MouseEvent) => {
      var cm = <contextmenu>this.querySelector('cb-contextmenu');
      cm.openAround(this);        
    };

    len = this.childNodes.length;
    for (i=0; i<len; i++) {
      kid = this.childNodes[i];
      if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== 'CB-CONTEXTMENU') {
        kid.addEventListener('click', clickHandler);
      }
    }

    cm = <contextmenu>this.querySelector('cb-contextmenu');  
    cm.addEventListener('selected', (ev: MouseEvent) => {
        var event = new CustomEvent('selected', { detail: ev.detail });
        this.dispatchEvent(event);
    });
  }
}

export = CbDropDown;
