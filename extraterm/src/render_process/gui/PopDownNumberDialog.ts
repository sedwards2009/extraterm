/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from 'extraterm-extension-api';
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {doLater} from '../../utils/DoLater';
import * as DomUtils from '../DomUtils';
import {PopDownDialog} from './PopDownDialog';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';

const ID = "EtPopDownNumberDialogTemplate";
const ID_DIALOG = "ID_DIALOG";
const ID_INPUT = "ID_INPUT";

/**
 * A Pop Down Number Dialog
 */
@WebComponent({tag: "et-popdownnumberdialog"})
export class PopDownNumberDialog extends ThemeableElementBase {
  
  static TAG_NAME = "ET-POPDOWNNUMBERDIALOG";

  private _laterHandle: Disposable = null;
  private _extraCssFiles: ThemeTypes.CssFile[] = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.installThemeCss();

    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    dialog.titlePrimary = this.titlePrimary;
    dialog.titleSecondary = this.titleSecondary;
    dialog.addEventListener(PopDownDialog.EVENT_CLOSE_REQUEST, () => {
      dialog.close();
    });

    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    textInput.addEventListener('keydown', (ev: KeyboardEvent) => { this.handleKeyDown(ev); });
  }
  
  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
        <${PopDownDialog.TAG_NAME} id="${ID_DIALOG}">
          <div class="form-group"><input type="number" id="${ID_INPUT}" min="0" max="10" class="form-control input-sm" value="1" /></div>
        </${PopDownDialog.TAG_NAME}>
        `;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ...this._extraCssFiles];
  }

  getValue(): number {
    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    return textInput.valueAsNumber;
  }

  setValue(value: number): void {
    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    textInput.valueAsNumber = value;
  }

  setMinimum(min: number): void {
    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    textInput.setAttribute("min", "" + min);
  }

  setMaximum(max: number): void {
    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    textInput.setAttribute("max", "" + max);
  }

  @Attribute({default: ""}) titlePrimary: string;
  @Observe("titlePrimary")
  private _updateTitlePrimary(target: string): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    if (dialog != null) {
      dialog.titlePrimary = this.titlePrimary;
    }
  }

  @Attribute({default: ""}) titleSecondary: string;
  @Observe("titleSecondary")
  private _updateTitleSecondary(target: string): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
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
      
      const filterInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
      this._okId(this.getValue());
    }
  }

  open(): void {
    const textInput = <HTMLInputElement> DomUtils.getShadowId(this, ID_INPUT);
    textInput.focus();

    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
    dialog.open();
  }

  close(): void {
    const dialog = <PopDownDialog> DomUtils.getShadowId(this, ID_DIALOG);
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
