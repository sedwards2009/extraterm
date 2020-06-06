/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";

const CLASS_CONTEXT_COVER_OPEN = "CLASS_CONTEXT_COVER_OPEN";
const CLASS_CONTEXT_COVER_CLOSED = "CLASS_CONTEXT_COVER_CLOSED";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";


/**
 * A Pop Down Dialog.
 */
@WebComponent({tag: "et-pop-down-dialog"})
export class PopDownDialog extends ThemeableElementBase {

  static TAG_NAME = "ET-POP-DOWN-DIALOG";
  static EVENT_CLOSE_REQUEST = "ET-POP-DOWN-DIALOG-CLOSE_REQUEST";

  private _isOpen = false;

  constructor() {
    super();

    this._handleContainerContextMenu = this._handleContainerContextMenu.bind(this);
    this._handleCoverMouseDown = this._handleCoverMouseDown.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: true });
    this._render();
  }

  private _handleContainerContextMenu(): void {
    this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
  }

  private _handleCoverMouseDown(): void {
    this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <div
        id="ID_COVER"
        class=${this._isOpen ? CLASS_COVER_OPEN : CLASS_COVER_CLOSED}
        @mousedown=${this._handleCoverMouseDown}
      >
      </div>
      <div
        id="ID_CONTEXT_COVER"
        class=${this._isOpen ? CLASS_CONTEXT_COVER_OPEN : CLASS_CONTEXT_COVER_CLOSED}
      >
        <div
          id="ID_CONTAINER"
          @contextmenu=${this._handleContainerContextMenu}
        >
          <div id="ID_TITLE_CONTAINER">
            <div id="ID_TITLE_PRIMARY">${this.titlePrimary}</div>
            <div id="ID_TITLE_SECONDARY">${this.titleSecondary}</div>
          </div>
          <slot></slot>
        </div>
      </div>`;

    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_POP_DOWN_DIALOG];
  }

  @Attribute({default: ""}) titlePrimary: string;
  @Attribute({default: ""}) titleSecondary: string;

  @Observe("titlePrimary", "titleSecondary")
  private _updateTitle(): void {
    this._render();
  }

  open(): void {
    this._isOpen = true;
    this._render();
  }

  close(): void {
    this._isOpen = false;
    this._render();
  }

  isOpen(): boolean {
    return this._isOpen;
  }
}
