/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_COVER = "ID_COVER";
const ID_CONTEXT_COVER = "ID_CONTEXT_COVER";
const ID_CONTAINER = "ID_CONTAINER";

const ID_TITLE_PRIMARY = "ID_TITLE_PRIMARY";
const ID_TITLE_SECONDARY = "ID_TITLE_SECONDARY";
const ID_TITLE_CONTAINER = "ID_TITLE_CONTAINER";

const CLASS_CONTEXT_COVER_OPEN = "CLASS_CONTEXT_COVER_OPEN";
const CLASS_CONTEXT_COVER_CLOSED = "CLASS_CONTEXT_COVER_CLOSED";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";


/**
 * A Pop Down Dialog.
 */
@WebComponent({tag: "et-pop-down-dialog"})
export class PopDownDialog extends TemplatedElementBase {

  static TAG_NAME = "ET-POP-DOWN-DIALOG";
  static EVENT_CLOSE_REQUEST = "ET-POP-DOWN-DIALOG-CLOSE_REQUEST";

  private _isOpen = false;

  constructor() {
    super({ delegatesFocus: true });

    const containerDiv = this._elementById(ID_CONTAINER);
    containerDiv.addEventListener('contextmenu', (ev) => {
      this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
    });

    const coverDiv = this._elementById(ID_COVER);
    coverDiv.addEventListener('mousedown', (ev) => {
      this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
    });
  }

  protected _html(): string {
    return `
      <div id='${ID_COVER}' class='${CLASS_COVER_CLOSED}'></div>
      <div id='${ID_CONTEXT_COVER}' class='${CLASS_CONTEXT_COVER_CLOSED}'>
        <div id='${ID_CONTAINER}'>
          <div id="${ID_TITLE_CONTAINER}"><div id="${ID_TITLE_PRIMARY}"></div><div id="${ID_TITLE_SECONDARY}"></div></div>
          <slot></slot>
        </div>
      </div>`;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_POP_DOWN_DIALOG];
  }

  @Attribute({default: ""}) titlePrimary: string;

  @Attribute({default: ""}) titleSecondary: string;

  @Observe("titlePrimary", "titleSecondary")
  private _updateTitle(): void {
    const titlePrimaryDiv = <HTMLDivElement> this._elementById(ID_TITLE_PRIMARY);
    const titleSecondaryDiv = <HTMLDivElement> this._elementById(ID_TITLE_SECONDARY);

    titlePrimaryDiv.innerText = this.titlePrimary;
    titleSecondaryDiv.innerText = this.titleSecondary;
  }

  open(): void {
    const container = <HTMLDivElement> this._elementById(ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_CLOSED);
    container.classList.add(CLASS_CONTEXT_COVER_OPEN);

    const cover = <HTMLDivElement> this._elementById(ID_COVER);
    cover.classList.remove(CLASS_COVER_CLOSED);
    cover.classList.add(CLASS_COVER_OPEN);

    this._isOpen = true;
  }

  close(): void {
    const cover = <HTMLDivElement> this._elementById(ID_COVER);
    cover.classList.remove(CLASS_COVER_OPEN);
    cover.classList.add(CLASS_COVER_CLOSED);

    const container = <HTMLDivElement> this._elementById(ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_OPEN);
    container.classList.add(CLASS_CONTEXT_COVER_CLOSED);

    this._isOpen = false;
  }

  isOpen(): boolean {
    return this._isOpen;
  }
}
