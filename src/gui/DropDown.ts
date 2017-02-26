/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ContextMenu} from './ContextMenu';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';

ContextMenu.init();

const ID = "EtDropDownTemplate";
const SLOT_CONTEXTMENU = "et-contextmenu";

let registered = false;

/**
 * A Drop Down menu.
 *
 * The contents of a DropDown should be a ContextMenu element and another
 * element like a button which emits a click event. When the user activates
 * the button, the ContextMenu is displayed.
 */
export class DropDown extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'ET-DROPDOWN';
  
  /**
   * Initialize the DropDown class and resources.
   *
   * When DropDown is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(DropDown.TAG_NAME, {prototype: DropDown.prototype});
      registered = true;
    }
  }
  
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<div><slot name='${SLOT_CONTEXTMENU}'></slot></div><div><slot></slot></div>`;
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
      const cm = <ContextMenu>this.querySelector(ContextMenu.TAG_NAME);
      cm.openAround(this);        
    };

    this._assignSlotContent();

    const len = this.childNodes.length;
    for (let i=0; i<len; i++) {
      const kid = this.childNodes[i];
      if (kid.nodeName.slice(0,1) !== '#' && kid.nodeName !== ContextMenu.TAG_NAME) {
        kid.addEventListener('click', clickHandler);
      }
    }

    const cm = <ContextMenu>this.querySelector(ContextMenu.TAG_NAME);
    cm.addEventListener('selected', (ev: MouseEvent) => {
        var event = new CustomEvent('selected', { detail: ev.detail });
        this.dispatchEvent(event);
    });
  }

  private _assignSlotContent(): void {
    const len = this.childNodes.length;
    for (let i=0; i<len; i++) {
      const kid = this.childNodes[i];
      if (kid.nodeName === ContextMenu.TAG_NAME) {
        (<HTMLElement> kid).slot = SLOT_CONTEXTMENU;
      }
    }
  }
}
