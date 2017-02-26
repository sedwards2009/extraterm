/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from '../DomUtils';
import * as Util from './Util';
import Logger from '../Logger';

const ID = "EtTabTemplate";

let registered = false;

/**
 * Holds the contents of one tab inside a TabWidget tag.
 */
export class Tab extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-TAB";

  /**
   * Initialize the Tab class and resources.
   *
   * When Tab is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(Tab.TAG_NAME, {prototype: Tab.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _mutationObserver: MutationObserver;

  private _initProperties(): void {
    this._mutationObserver = null;
    this._log = new Logger(Tab.TAG_NAME, this);
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
    this._initProperties();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);

    this._mutationObserver = new MutationObserver( (mutations) => {
      this._applyDraggable();
    });
    this._mutationObserver.observe(this, { childList: true });
  }
  
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<div><slot></slot></div>`;
      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  attachedCallback(): void {
    this._applyDraggable();
  }

  private _applyDraggable(): void {
    this._log.debug("_applyDraggable");
    for (const kid of this.childNodes) {
      if (kid instanceof HTMLElement) {
        kid.setAttribute("draggable", "true");
      }
    }
  }
}
