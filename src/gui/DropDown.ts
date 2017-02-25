/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {CbContextMenu as ContextMenu} from './ContextMenu';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';

ContextMenu.init();

const ID = "CbDropDownTemplate";
const SLOT_CBCONTEXTMENU = "cb-contextmenu";

let registered = false;

/**
 * A Drop Down menu.
 *
 * The contents of a CbDropDown should be a CbContextMenu element and another
 * element like a button which emits a click event. When the user activates
 * the button, the CbContextMenu is displayed.
 */
export class CbDropDown extends HTMLElement {
  
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
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<div><slot name='${SLOT_CBCONTEXTMENU}'></slot></div><div><slot></slot></div>`;
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
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);

    const clickHandler = (ev: MouseEvent) => {
      const cm = <ContextMenu>this.querySelector('cb-contextmenu');
      cm.openAround(this);        
    };

    this._assignSlotContent();

    const len = this.childNodes.length;
    for (let i=0; i<len; i++) {
      const kid = this.childNodes[i];
      if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== 'CB-CONTEXTMENU') {
        kid.addEventListener('click', clickHandler);
      }
    }

    const cm = <ContextMenu>this.querySelector('cb-contextmenu');  
    cm.addEventListener('selected', (ev: MouseEvent) => {
        var event = new CustomEvent('selected', { detail: ev.detail });
        this.dispatchEvent(event);
    });
  }

  private _assignSlotContent(): void {
    const len = this.childNodes.length;
    for (let i=0; i<len; i++) {
      const kid = this.childNodes[i];
      if (kid.nodeName === 'CB-CONTEXTMENU') {
        (<HTMLElement> kid).slot = SLOT_CBCONTEXTMENU;
      }
    }
  }
}
