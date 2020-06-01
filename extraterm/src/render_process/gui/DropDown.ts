/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';

import {ContextMenu} from './ContextMenu';
import { TemplatedElementBase } from './TemplatedElementBase';


const SLOT_CONTEXTMENU = "et-contextmenu";

/**
 * A Drop Down menu.
 *
 * The contents of a DropDown should be a ContextMenu element and another
 * element like a button which emits a click event. When the user activates
 * the button, the ContextMenu is displayed.
 */
@WebComponent({tag: "et-drop-down"})
export class DropDown extends TemplatedElementBase {

  static TAG_NAME = 'ET-DROP-DOWN';

  constructor() {
    super( {delegatesFocus: false} );

    const clickHandler = (ev: MouseEvent) => {
      const cm = <ContextMenu>this.querySelector(ContextMenu.TAG_NAME);
      cm.openAround(<HTMLElement> ev.target);
    };

    const childChangeCallback: MutationCallback = (mutationsList, observer) => {
      for(const mutation of mutationsList) {
        if (mutation.type === "childList") {
          this._assignSlotContent();
          return;
        }
      }
    };

    const observer = new MutationObserver(childChangeCallback);
    const config = { attributes: true, childList: true, subtree: true };
    observer.observe(this, config);

    this.addEventListener('click', clickHandler);
    this.addEventListener('selected', (ev: MouseEvent) => {
      const event = new CustomEvent('selected', { detail: ev.detail });
      this.dispatchEvent(event);
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._assignSlotContent();
  }

  protected _html(): string {
    return `<div><slot name='${SLOT_CONTEXTMENU}'></slot></div><div><slot></slot></div>`;
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
