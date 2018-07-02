/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as DomUtils from '../DomUtils';
import * as Util from './Util';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { WebComponent } from 'extraterm-web-component-decorators';

/**
 * Holds the contents of one tab inside a TabWidget tag.
 */
@WebComponent({tag: "et-tab"})
export class Tab extends HTMLElement {
  
  static TAG_NAME = "ET-TAB";

  private _log: Logger;
  private _mutationObserver: MutationObserver;

  constructor() {
    super();
    this._log = getLogger(Tab.TAG_NAME, this);

    this._mutationObserver = new MutationObserver( (mutations) => {
      this._applyDraggable();
    });
    this._mutationObserver.observe(this, { childList: true });
  }

  connectedCallback(): void {
    this._applyDraggable();
  }

  private _applyDraggable(): void {
    for (const kid of this.childNodes) {
      if (kid instanceof HTMLElement) {
        kid.setAttribute("draggable", "true");
      }
    }
  }
}
