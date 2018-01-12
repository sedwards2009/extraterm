/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';

const ID = "EtPopDownDialogTemplate";
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

const ATTR_DATA_ID = "data-id";


/**
 * A Pop Down Dialog.
 */
@WebComponent({tag: "et-popdowndialog"})
export class PopDownDialog extends ThemeableElementBase {
  
  static TAG_NAME = "ET-POPDOWNDIALOG";
  static EVENT_CLOSE_REQUEST = "ET-POPDOWNDIALOG-CLOSE_REQUEST";
  
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();

    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    containerDiv.addEventListener('contextmenu', (ev) => {
      this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
    }); 

    const coverDiv = DomUtils.getShadowId(this, ID_COVER);
    coverDiv.addEventListener('mousedown', (ev) => {
      this.dispatchEvent(new CustomEvent(PopDownDialog.EVENT_CLOSE_REQUEST, {bubbles: false}));
    });
  }
  
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id='${ID_COVER}' class='${CLASS_COVER_CLOSED}'></div>
        <div id='${ID_CONTEXT_COVER}' class='${CLASS_CONTEXT_COVER_CLOSED}'>
          <div id='${ID_CONTAINER}'>
            <div id="${ID_TITLE_CONTAINER}"><div id="${ID_TITLE_PRIMARY}"></div><div id="${ID_TITLE_SECONDARY}"></div></div>
            <slot></slot>
          </div>
        </div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.FONT_AWESOME, ThemeTypes.CssFile.GUI_POP_DOWN_DIALOG];
  }

  @Attribute({default: ""}) titlePrimary: string;

  @Attribute({default: ""}) titleSecondary: string;

  @Observe("titlePrimary", "titleSecondary")
  private _updateTitle(): void {
    const titlePrimaryDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_TITLE_PRIMARY);
    const titleSecondaryDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_TITLE_SECONDARY);

    titlePrimaryDiv.innerText = this.titlePrimary;
    titleSecondaryDiv.innerText = this.titleSecondary;
  }

  open(x: number, y: number, width: number, height: number): void {
    // Nuke any style like 'display: none' which can be use to prevent flicker.
    this.setAttribute('style', '');
    
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_CLOSED);
    container.classList.add(CLASS_CONTEXT_COVER_OPEN);
  
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
  
    const cover = <HTMLDivElement> DomUtils.getShadowId(this, ID_COVER);
    cover.classList.remove(CLASS_COVER_CLOSED);
    cover.classList.add(CLASS_COVER_OPEN);
  }

  close(): void {
    const cover = <HTMLDivElement> DomUtils.getShadowId(this, ID_COVER);
    cover.classList.remove(CLASS_COVER_OPEN);
    cover.classList.add(CLASS_COVER_CLOSED);
  
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_OPEN);
    container.classList.add(CLASS_CONTEXT_COVER_CLOSED);
  }
}
