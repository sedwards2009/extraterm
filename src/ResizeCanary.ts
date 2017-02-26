/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from './DomUtils';
import Logger from './Logger';
import ElementResizeDetectorMaker = require('element-resize-detector');

let registered = false;

const ID = "ExtratermResizeCanaryTemplate";
const ID_SIZER = "ID_SIZER";
const ID_CONTAINER = "ID_CONTAINER";

export class ResizeCanary extends HTMLElement {
  
  static TAG_NAME = "ET-RESIZE-CANARY";

  static init(): void {
    if (registered === false) {
      window.document.registerElement(ResizeCanary.TAG_NAME, {prototype: ResizeCanary.prototype});
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _erd: any; //ElementResizeDetector.Detector;
  
  private _laterHandle: DomUtils.LaterHandle;
  
  private _css: string; 

  private _initProperties(): void {
    this._log = new Logger(ResizeCanary.TAG_NAME, this);
    this._erd = null;
    this._laterHandle = null;
    this._css = "";
  }

  setCss(css: string): void {
    this._css = css;
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
    this._initProperties();
  }

  attachedCallback(): void {
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    shadow.appendChild(this._createNodes());
    this._erd = ElementResizeDetectorMaker(); // Use the 'object' strategy, 'scroll' doesn't work here.
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_SIZER);
    
    this._erd.listenTo(container, (el: HTMLElement) => {
      if (this._laterHandle === null) {
        this._laterHandle = DomUtils.doLater( () => {
          const event = new CustomEvent('resize', { detail: { } });
          this.dispatchEvent(event);
          this._laterHandle = null;
        }, 40);
      }
    });
  }
  
  private _createNodes(): Node {
    const div = <HTMLDivElement> window.document.createElement('div');
    div.innerHTML = `<style>
      #${ID_CONTAINER} {
        position: absolute;
        top: 0px;
        left: 0px;
        display: block;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
      
      #${ID_SIZER} {
        ${this._css}
      }
      </style>
` +
`      <div id='${ID_CONTAINER}'>` +
`<div id='${ID_SIZER}'>mmmmmlllll<br />mmmmmlllll<br />mmmmmlllll</div>` +
`</div>`;
;

    const frag = window.document.createDocumentFragment();
    for (const kid of DomUtils.nodeListToArray(div.childNodes)) { 
      frag.appendChild(kid);
    }
    return frag;
  }
}
