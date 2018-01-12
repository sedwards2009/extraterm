/*
 * Copyright 2016-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from 'extraterm-extension-api';
import {WebComponent} from 'extraterm-web-component-decorators';

import * as DomUtils from './DomUtils';
import {doLater} from '../utils/DoLater';
import {Logger, getLogger} from '../logging/Logger';
import ElementResizeDetectorMaker = require('element-resize-detector');

const ID = "ExtratermResizeCanaryTemplate";
const ID_SIZER = "ID_SIZER";
const ID_CONTAINER = "ID_CONTAINER";

@WebComponent({tag: "et-resize-canary"})
export class ResizeCanary extends HTMLElement {
  
  static TAG_NAME = "ET-RESIZE-CANARY";

  private _log: Logger = null;
  private _erd: any; //ElementResizeDetector.Detector;
  private _laterHandle: Disposable = null;
  private _css: string = "";

  setCss(css: string): void {
    this._css = css;
  }
  
  constructor() {
    super();
    this._log = getLogger(ResizeCanary.TAG_NAME, this);
  }

  connectedCallback(): void {
    if (DomUtils.getShadowRoot(this) != null) {
      return;
    }

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    shadow.appendChild(this._createNodes());
    this._erd = ElementResizeDetectorMaker(); // Use the 'object' strategy, 'scroll' doesn't work here.
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_SIZER);
    
    this._erd.listenTo(container, (el: HTMLElement) => {
      if (this._laterHandle === null) {
        this._laterHandle = doLater( () => {
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
