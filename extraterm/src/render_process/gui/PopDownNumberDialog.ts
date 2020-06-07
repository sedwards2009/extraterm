/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from "@extraterm/extraterm-extension-api";
import {Attribute, Observe, WebComponent} from "extraterm-web-component-decorators";
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
@WebComponent({tag: "et-pop-down-number-dialog"})
export class PopDownNumberDialog extends ThemeableElementBase {

  static TAG_NAME = "ET-POP-DOWN-NUMBER-DIALOG";

  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];
  private _open = false;

  constructor() {
    super();
    this._handleDialogCloseRequest = this._handleDialogCloseRequest.bind(this);
    this._handleTextInputKeyDown = this._handleTextInputKeyDown.bind(this);
    this.attachShadow({ mode: "open", delegatesFocus: true });
    this._render();
  }

  protected _render(): void {
    const template = html`${this._styleTag()}
      <et-pop-down-dialog
        id="ID_DIALOG"
        title-primary=${this.titlePrimary}
        title-secondary=${this.titleSecondary}
        open=${this._open}
        @ET-POP-DOWN-DIALOG-CLOSE_REQUEST=${this._handleDialogCloseRequest}
      >
        <div class="form-group"><input type="number" id=${ID_INPUT} @keydown=${this._handleTextInputKeyDown} min="0" max="10" value="1" /></div>
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

  getValue(): number {
    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    return textInput.valueAsNumber;
  }

  setValue(value: number): void {
    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.valueAsNumber = value;
  }

  setMinimum(min: number): void {
    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.setAttribute("min", "" + min);
  }

  setMaximum(max: number): void {
    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.setAttribute("max", "" + max);
  }

  @Attribute({default: ""}) titlePrimary: string;
  @Attribute({default: ""}) titleSecondary: string;

  @Observe("titlePrimary", "titleSecondary")
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

  private _handleTextInputKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      this._okId(null);
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();

      this._okId(this.getValue());
    }
  }

  open(): void {
    this._open = true;
    this._render();

    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.focus();
  }

  close(): void {
    this._open = false;
    this._render();
  }

  private _okId(value: number): void {
    if (this._laterHandle === null) {
      this._laterHandle = doLater( () => {
        this.close();
        this._laterHandle = null;
        const event = new CustomEvent("selected", { detail: {value: value } });
        this.dispatchEvent(event);
      });
    }
  }

  private _elementById(id: string): HTMLElement {
    return DomUtils.getShadowId(this, id);
  }
}
