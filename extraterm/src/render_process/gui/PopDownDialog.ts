/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, CustomElement } from "extraterm-web-component-decorators";
import { html, parts, render } from "extraterm-lit-html";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";
import { disassembleDOMTree } from "../DomUtils";

const CLASS_CONTEXT_COVER_OPEN = "CLASS_CONTEXT_COVER_OPEN";
const CLASS_CONTEXT_COVER_CLOSED = "CLASS_CONTEXT_COVER_CLOSED";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";


/**
 * A Pop Down Dialog.
 */
@CustomElement("et-pop-down-dialog")
export class PopDownDialog extends ThemeableElementBase {

  static TAG_NAME = "ET-POP-DOWN-DIALOG";
  static EVENT_CLOSE_REQUEST = "ET-POP-DOWN-DIALOG-CLOSE_REQUEST";

  constructor() {
    super();

    this._handleContainerContextMenu = this._handleContainerContextMenu.bind(this);
    this._handleCoverMouseDown = this._handleCoverMouseDown.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: true });
    this._render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    parts.set(this.shadowRoot, undefined);
    disassembleDOMTree(this.shadowRoot);
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
        class=${this.open ? CLASS_COVER_OPEN : CLASS_COVER_CLOSED}
        @mousedown=${this._handleCoverMouseDown}
      >
      </div>
      <div
        id="ID_CONTEXT_COVER"
        class=${this.open ? CLASS_CONTEXT_COVER_OPEN : CLASS_CONTEXT_COVER_CLOSED}
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

  @Attribute titlePrimary = "";
  @Attribute titleSecondary = "";

  @Observe("titlePrimary", "titleSecondary")
  private _updateTitle(): void {
    this._render();
  }

  @Attribute open = false;
  @Observe("open")
  private _observeOpen(target: string): void {
    this._render();
  }
}
