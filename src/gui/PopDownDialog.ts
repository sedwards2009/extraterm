/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
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

let registered = false;

/**
 * A Pop Down Dialog.
 */
export class PopDownDialog extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-POPDOWNDIALOG";

  static EVENT_CLOSE_REQUEST = "ET-POPDOWNDIALOG-CLOSE_REQUEST";

  /**
   * Initialize the PopDownDialog class and resources.
   *
   * When PopDownDialog is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(PopDownDialog.TAG_NAME.toLowerCase(), PopDownDialog);
      registered = true;
    }
  }
  
  private _titlePrimary: string;

  private _titleSecondary: string;

  private _laterHandle: DomUtils.LaterHandle;
  
  private _initProperties(): void {
    this._laterHandle = null;
    this._titlePrimary = "";
    this._titleSecondary = "";
  }

  setTitlePrimary(text: string): void {
    this._titlePrimary = text;
    this._updateTitle();
  }

  getTitlePrimary(): string {
    return this._titlePrimary;
  }

  setTitleSecondary(text: string): void {
    this._titleSecondary = text;
    this._updateTitle();
  }

  getTitleSecondary(): string {
    return this._titleSecondary;
  }

  //-----------------------------------------------------------------------
  //
  //   #                                                         
  //   #       # ###### ######  ####  #   #  ####  #      ###### 
  //   #       # #      #      #    #  # #  #    # #      #      
  //   #       # #####  #####  #        #   #      #      #####  
  //   #       # #      #      #        #   #      #      #      
  //   #       # #      #      #    #   #   #    # #      #      
  //   ####### # #      ######  ####    #    ####  ###### ###### 
  //
  //-----------------------------------------------------------------------
  constructor() {
    super();
    this._initProperties(); // Initialise our properties. The constructor was not called.
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
  
  /**
   * 
   */
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
  
  //-----------------------------------------------------------------------

  private _updateTitle(): void {
    const titlePrimaryDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_TITLE_PRIMARY);
    const titleSecondaryDiv = <HTMLDivElement> DomUtils.getShadowId(this, ID_TITLE_SECONDARY);

    titlePrimaryDiv.innerText = this._titlePrimary;
    titleSecondaryDiv.innerText = this._titleSecondary;
  }

  /**
   * 
   */
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

  /**
   * 
   */
  close(): void {
    const cover = <HTMLDivElement> DomUtils.getShadowId(this, ID_COVER);
    cover.classList.remove(CLASS_COVER_OPEN);
    cover.classList.add(CLASS_COVER_CLOSED);
  
    const container = <HTMLDivElement> DomUtils.getShadowId(this, ID_CONTEXT_COVER);
    container.classList.remove(CLASS_CONTEXT_COVER_OPEN);
    container.classList.add(CLASS_CONTEXT_COVER_CLOSED);
  }
}
