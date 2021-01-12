/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from "@extraterm/extraterm-extension-api";
import { Attribute, Observe, CustomElement } from "extraterm-web-component-decorators";
import { html, render } from "extraterm-lit-html";

import * as DomUtils from "../DomUtils";
import {doLater} from "extraterm-later";
import {PopDownDialog} from "./PopDownDialog";
import * as ThemeTypes from "../../theme/Theme";
import { ThemeableElementBase } from "../ThemeableElementBase";

const ID_INPUT = "ID_INPUT";

/**
 * A Pop Down Number Dialog
 */
@CustomElement("et-pop-down-number-dialog")
export class PopDownNumberDialog extends ThemeableElementBase {

  static TAG_NAME = "ET-POP-DOWN-NUMBER-DIALOG";

  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  constructor() {
    super();
    this._handleDialogCloseRequest = this._handleDialogCloseRequest.bind(this);
    this._handleTextInputKeyDown = this._handleTextInputKeyDown.bind(this);
    this._handleInputChange = this._handleInputChange.bind(this);
    this.attachShadow({ mode: "open", delegatesFocus: true });
    this._render();
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <et-pop-down-dialog
        id="ID_DIALOG"
        title-primary=${this.titlePrimary}
        title-secondary=${this.titleSecondary}
        ?open=${this.open}
        @ET-POP-DOWN-DIALOG-CLOSE_REQUEST=${this._handleDialogCloseRequest}
      >
        <div class="form-group"><input
          type="number"
          id=${ID_INPUT}
          @keydown=${this._handleTextInputKeyDown}
          min=${this.min}
          max=${this.max}
          @change=${this._handleInputChange}
          value=${this.value} /></div>
      </et-pop-down-dialog>
      `;
    render(template, this.shadowRoot);
  }

  private _handleDialogCloseRequest(): void {
    this._okId(null);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    const extraCssFiles = this._extraCssFiles == null ? [] : this._extraCssFiles;
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.FONT_AWESOME,
            ThemeTypes.CssFile.GUI_POP_DOWN_NUMBER_DIALOG, ...extraCssFiles];
  }

  @Attribute value = 0;
  @Attribute min = 0;
  @Attribute max = 10;
  @Attribute titlePrimary = "";
  @Attribute titleSecondary = "";

  @Observe("min", "max", "titlePrimary", "titleSecondary", "value")
  private _observeTitles(target: string): void {
    this._render();
  }

  /**
   * Specify extra Css files to load into this element.
   *
   * @param extraCssFiles extra Css files which should be loaded along side the default set.
   */
  addExtraCss(extraCssFiles: ThemeTypes.CssFile[]): void {
    this._extraCssFiles = [...this._extraCssFiles, ...extraCssFiles];
    this.updateThemeCss();
  }

  private _handleInputChange(ev: Event): void {
    this.value = (<HTMLInputElement>ev.target).valueAsNumber;
  }

  private _handleTextInputKeyDown(ev: KeyboardEvent): void {
    if (ev.key === "Escape") {
      this._okId(null);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();

      this._okId(this.value);
    }
  }

  @Attribute open = false;
  @Observe("open")
  private _observeOpen(): void {
    this._render();
    if (this.open) {
      const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
      textInput.focus();
    }
  }

  private _okId(value: number): void {
    if (this._laterHandle === null) {
      this._laterHandle = doLater( () => {
        this.open = false;
        this._laterHandle = null;
        const event = new CustomEvent("selected", { detail: {selected: value } });
        this.dispatchEvent(event);
      });
    }
  }

  private _elementById(id: string): HTMLElement {
    return DomUtils.getShadowId(this, id);
  }
}
