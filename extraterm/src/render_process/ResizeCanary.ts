/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { CustomElement } from "extraterm-web-component-decorators";
import { ResizeNotifier } from "extraterm-resize-notifier";
import {Logger, getLogger} from "extraterm-logging";

import { trimBetweenTags } from "extraterm-trim-between-tags";
import { htmlToFragment, getShadowRoot, getShadowId } from "./DomUtils";

const ID_SIZER = "ID_SIZER";
const ID_CONTAINER = "ID_CONTAINER";

@CustomElement("et-resize-canary")
export class ResizeCanary extends HTMLElement {

  static TAG_NAME = "ET-RESIZE-CANARY";
  private static _resizeNotifier = new ResizeNotifier();

  private _log: Logger = null;
  private _css: string = "";

  setCss(css: string): void {
    this._css = css;
  }

  constructor() {
    super();
    this._log = getLogger(ResizeCanary.TAG_NAME, this);
  }

  connectedCallback(): void {
    if (getShadowRoot(this) != null) {
      return;
    }

    const shadow = this.attachShadow({ mode: "open", delegatesFocus: false });
    shadow.appendChild(this._createNodes());
    const container = <HTMLDivElement> getShadowId(this, ID_SIZER);
    ResizeCanary._resizeNotifier.observe(container,  (target: Element, contentRect: DOMRectReadOnly) => {
      if ( ! this.isConnected) {
        return;
      }
      const event = new CustomEvent("resize", { detail: { } });
      this.dispatchEvent(event);
    });
  }

  private _createNodes(): Node {
    return htmlToFragment(trimBetweenTags(`<style>
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
      <div id="${ID_CONTAINER}">
        <div id="${ID_SIZER}">mmmmmlllll<br />mmmmmlllll<br />mmmmmlllll</div>
      </div>`));
  }
}
