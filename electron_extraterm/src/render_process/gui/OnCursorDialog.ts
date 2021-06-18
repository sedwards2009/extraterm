/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, CustomElement } from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";
import { styleMap } from "extraterm-lit-html/directives/style-map";

import { log, Logger, getLogger } from "extraterm-logging";

import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";

const CLASS_CONTEXT_COVER_OPEN = "CLASS_CONTEXT_COVER_OPEN";
const CLASS_CONTEXT_COVER_CLOSED = "CLASS_CONTEXT_COVER_CLOSED";
const CLASS_COVER_CLOSED = "CLASS_COVER_CLOSED";
const CLASS_COVER_OPEN = "CLASS_COVER_OPEN";
const CLASS_ABOVE_CURSOR = "CLASS_ABOVE_CURSOR";
const CLASS_BELOW_CURSOR = "CLASS_BELOW_CURSOR";


/**
 * On Cursor Dialog.
 */
@CustomElement("et-on-cursor-dialog")
export class OnCursorDialog extends ThemeableElementBase {

  static TAG_NAME = "ET-ON-CURSOR-DIALOG";
  static EVENT_CLOSE_REQUEST = "et-on-cursor-dialog_close-request";

  private _log: Logger = null;

  constructor() {
    super();
    this._log = getLogger(OnCursorDialog.TAG_NAME, this);

    this._handleContainerContextMenu = this._handleContainerContextMenu.bind(this);
    this._handleCoverMouseDown = this._handleCoverMouseDown.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: true });
    this._render();
  }

  private _handleContainerContextMenu(): void {
    this.dispatchEvent(new CustomEvent(OnCursorDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
  }

  private _handleCoverMouseDown(): void {
    this.dispatchEvent(new CustomEvent(OnCursorDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
  }

  protected _render(): void {
    const styles ={};
    styles["--cursor-left"] = `${this.cursorLeft}px`;
    styles["--cursor-top"] = `${this.cursorTop}px`;
    styles["--cursor-bottom"] = `${this.cursorBottom}px`;

    const thisRect = this.getBoundingClientRect();
    const orientationClass = (this.cursorTop > (thisRect.height / 2)) ? CLASS_ABOVE_CURSOR : CLASS_BELOW_CURSOR;

    const template = html`${this._styleTag()}
      <div
        id="ID_COVER"
        class=${this.open ? CLASS_COVER_OPEN : CLASS_COVER_CLOSED}
        @mousedown=${this._handleCoverMouseDown}
      >
      </div>
      <div
        id="ID_CONTEXT_COVER"
        style=${styleMap(styles)}
      >
        <div
          id="ID_CONTAINER"
          class=${orientationClass}
          @contextmenu=${this._handleContainerContextMenu}
        >
          <slot></slot>
        </div>
      </div>`;

    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_ON_CURSOR_DIALOG];
  }

  @Attribute open = false;
  @Attribute cursorLeft = 0;
  @Attribute cursorTop = 0;
  @Attribute cursorBottom = 0;

  @Observe("open", "cursorLeft", "cursorTop", "cursorBottom")
  private _updateTitle(): void {
    this._render();
  }
}
