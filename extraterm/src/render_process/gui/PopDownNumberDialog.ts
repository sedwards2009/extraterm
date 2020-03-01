/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from '@extraterm/extraterm-extension-api';
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {doLater} from 'extraterm-later';
import {PopDownDialog} from './PopDownDialog';
import * as ThemeTypes from '../../theme/Theme';
import { TemplatedElementBase } from './TemplatedElementBase';

const ID_DIALOG = "ID_DIALOG";
const ID_INPUT = "ID_INPUT";

/**
 * A Pop Down Number Dialog
 */
@WebComponent({tag: "et-popdownnumberdialog"})
export class PopDownNumberDialog extends TemplatedElementBase {
  
  static TAG_NAME = "ET-POPDOWNNUMBERDIALOG";

  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  constructor() {
    super({ delegatesFocus: true });

    const dialog = <PopDownDialog> this._elementById(ID_DIALOG);
    dialog.titlePrimary = this.titlePrimary;
    dialog.titleSecondary = this.titleSecondary;
    dialog.addEventListener(PopDownDialog.EVENT_CLOSE_REQUEST, () => {
      this._okId(null);
    });

    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
  }
  
  protected _html(): string {
    return `
      <${PopDownDialog.TAG_NAME} id="${ID_DIALOG}">
        <div class="form-group"><input type="number" id="${ID_INPUT}" min="0" max="10" value="1" /></div>
      </${PopDownDialog.TAG_NAME}>
      `;
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
  @Observe("titlePrimary")
  private _updateTitlePrimary(target: string): void {
    const dialog = <PopDownDialog> this._elementById(ID_DIALOG);
    if (dialog != null) {
      dialog.titlePrimary = this.titlePrimary;
    }
  }

  @Attribute({default: ""}) titleSecondary: string;
  @Observe("titleSecondary")
  private _updateTitleSecondary(target: string): void {
    const dialog = <PopDownDialog> this._elementById(ID_DIALOG);
    if (dialog != null) {
      dialog.titleSecondary = this.titleSecondary;
    }
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

  private handleKeyDown(ev: KeyboardEvent) {
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
    const textInput = <HTMLInputElement> this._elementById(ID_INPUT);
    textInput.focus();

    const dialog = <PopDownDialog> this._elementById(ID_DIALOG);
    dialog.open();
  }

  close(): void {
    const dialog = <PopDownDialog> this._elementById(ID_DIALOG);
    dialog.close();
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
}
