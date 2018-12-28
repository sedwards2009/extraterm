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
@WebComponent({tag: "et-dropdown"})
export class DropDown extends TemplatedElementBase {
  
  static TAG_NAME = 'ET-DROPDOWN';

  constructor() {
    super( {delegatesFocus: false} );

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
