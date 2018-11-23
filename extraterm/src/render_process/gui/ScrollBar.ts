/*
 * Copyright 2014-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Attribute, Filter, Observe, WebComponent} from 'extraterm-web-component-decorators';

import * as DomUtils from '../DomUtils';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';


const ID = "EtScrollbarTemplate";
const ID_AREA = "ID_AREA";
const ID_CONTAINER = "ID_CONTAINER";


/**
 * A scrollbar.
 */
@WebComponent({tag: "et-scrollbar"})
export class ScrollBar extends ThemeableElementBase {

  static TAG_NAME = 'ET-SCROLLBAR';
  
  private _log: Logger;

  constructor() {
    super();
    this._log = getLogger(ScrollBar.TAG_NAME, this);

    // Set up the structure in the shadow DOM.
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this._createClone();
    shadow.appendChild(clone);

    this.installThemeCss();

    this._getById(ID_CONTAINER).addEventListener('scroll', (ev: Event) => {
      const container = this._getById(ID_CONTAINER);
      const top = container.scrollTop;
      this.position = top;
      
// FIXME this should fire standard scroll events, not custom events.
      
      const event = new CustomEvent('scroll',
          { detail: {
            position: top,
            isTop: top === 0,
            isBottom: (container.scrollHeight - container.clientHeight) === top } });
      this.dispatchEvent(event);
    });

    this._updateLengthNumber("length");
    this._updatePosition("position");
  }
  
  connectedCallback(): void {
    super.connectedCallback();
    this._updatePosition("position");
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SCROLLBAR];
  }
  
  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>` +
        `<div id='${ID_CONTAINER}'><div id='${ID_AREA}'></div></div>`;
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>DomUtils.getShadowRoot(this).querySelector('#'+id);
  }

  @Attribute length = 1;

  @Filter("length")
  private _sanitizeLength(value: number): number {
    if (value == null) {
      return undefined;
    }
    
    if (isNaN(value)) {
      console.warn("Value '" + value + "'to scrollbar attribute 'length' was NaN.");
      return undefined;
    }

    return Math.max(0, value);
  }

  @Observe("length")
  private _updateLengthNumber(target: string): void {
    const areaElement = this._getById(ID_AREA);
    areaElement.style.height = this.length + "px";
  }

  setLength(length: number): void {
    this.length = length;
  }

  getLength(): number {
    return this.length;
  }

  @Attribute position = 0;

  @Filter("position")
  private _sanitizePosition(value: number): number {
    const container = this._getById(ID_CONTAINER);
    const cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
    return cleanValue !== this.position ? cleanValue : undefined;
  }

  @Observe("position")
  private _updatePosition(target: string): void {
    const containerElement = this._getById(ID_CONTAINER);
    containerElement.scrollTop = this.position;
  }

  setPosition(pos: number): void {
    this.position = pos;
  }

  getPosition(): number {
    return this.position;
  }

  setThumbSize(size: number): void {
  }
  
  getThumbSize(): number {
    return 7734;  // FIXME bogus.
  }

  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._updatePosition("position");
  }
}
