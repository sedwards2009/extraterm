/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_CONTAINER = 'ID_CONTAINER';


/**
 * A widget which displays one of its DIV contents at a time.
 */
@WebComponent({tag: "et-stacked-widget"})
export class StackedWidget extends TemplatedElementBase {

  static TAG_NAME = 'ET-STACKED-WIDGET';

  private _currentIndex: number;
  private _initialized = false;

  constructor() {
    super({ delegatesFocus: false });
    this._currentIndex = -1;
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this.createPageHolders();
    this.showIndex(0);
  }

  protected _html(): string {
    return `<div id='${ID_CONTAINER}'></div>`;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_STACKEDWIDGET];
  }

  //-----------------------------------------------------------------------

  // Override
  appendChild<T extends Node>(newNode: T): T {
    const result = super.appendChild(newNode);

    this.createPageHolders();
    if (this._currentIndex === -1) {
      this._currentIndex = 0;
    }
    this.showIndex(this._currentIndex);
    return result;
  }

  // Override
  removeChild<T extends Node>(oldNode: T): T {
    const result = super.removeChild(oldNode);
    this.createPageHolders();
    if (this._currentIndex >= this.childElementCount) {
      this._currentIndex = this.childElementCount - 1;
    }
    this.showIndex(this._currentIndex);
    return result;
  }

  @Attribute({default: -1}) currentIndex: number;

  @Filter("currentIndex")
  private _filterCurrentIndex(index: number): number {
    if (index < 0 || index >= this.childElementCount) {
      return undefined;
    }
    return index;
  }

  @Observe("currentIndex")
  private _observeCurrentIndex(target: string): void {
    this.showIndex(this.currentIndex);
  }

  private showIndex(index: number): void {
    const container = <HTMLDivElement>this._elementById(ID_CONTAINER);
    for (let i=0; i<container.children.length; i++) {
      const kid = <HTMLElement>container.children.item(i);
      if (i === index) {
        kid.classList.add('visible');
        kid.classList.remove('hidden');
      } else {
        kid.classList.remove('visible');
        kid.classList.add('hidden');
      }
    }
  }

  private createPageHolders(): void {
    const container = <HTMLDivElement>this._elementById(ID_CONTAINER);

    for (let i=0; i<this.children.length; i++) {
      const kid = this.children.item(i);
      kid.slot = "" + i;
    }

    while (container.childElementCount < this.childElementCount) {
      const holderDiv = this.ownerDocument.createElement('div');
      const contentElement = this.ownerDocument.createElement('slot');
      contentElement.setAttribute('name', "" + container.childElementCount);
      holderDiv.appendChild(contentElement);
      container.appendChild(holderDiv);
    }

    while (container.childElementCount > this.childElementCount) {
      container.removeChild(container.children.item(container.children.length-1));
    }
  }
}
