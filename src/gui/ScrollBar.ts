/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import Logger from '../Logger';
import log from '../LogDecorator';

const ID = "EtScrollbarTemplate";
const ID_AREA = "ID_AREA";
const ID_CONTAINER = "ID_CONTAINER";

let registered = false;

/**
 * A scrollbar.
 */
export class ScrollBar extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'ET-SCROLLBAR';
  
  static ATTR_LENGTH = "length";
  
  static ATTR_POSITION = "position";
  
  static ATTR_THUMBSIZE = "thumbsize";
  
  /**
   * Initialize the Scrollbar class and resources.
   *
   * When Scrollbar is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(ScrollBar.TAG_NAME.toLowerCase(), ScrollBar);
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  private _position: number;
  
  private _length: number;

  private _log: Logger;

  private _initProperties(): void {
    this._position = 0;
    this._length = 1;
    this._log = new Logger(ScrollBar.TAG_NAME, this);
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
  }
  
  /**
   * Custom Element 'connected' life cycle hook.
   */
  connectedCallback(): void {
    super.connectedCallback();

    if (DomUtils.getShadowRoot(this) === null) {
      // Set up the structure in the shadow DOM.
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this._createClone();
      shadow.appendChild(clone);
      this.updateThemeCss();

      this._getById(ID_CONTAINER).addEventListener('scroll', (ev: Event) => {
        const container = this._getById(ID_CONTAINER);
        const top = container.scrollTop;
        this._position = top;
        
  // FIXME this should fire standard scroll events, not custom events.
        
        const event = new CustomEvent('scroll',
            { detail: {
              position: top,
              isTop: top === 0,
              isBottom: (container.scrollHeight - container.clientHeight) === top } });
        this.dispatchEvent(event);
      });
      
      this._updateLength(this.getAttribute(ScrollBar.ATTR_LENGTH));
      this._updatePosition(this.getAttribute(ScrollBar.ATTR_POSITION));

    } else {
      // Being reattached.
      this._updatePositionNumber(this._position);
    }
  }

  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case ScrollBar.ATTR_LENGTH:
        this._updateLength(newValue);
        break;

      case ScrollBar.ATTR_POSITION:
        this._updatePosition(newValue);
        break;
        
      default:
        break;
    }
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SCROLLBAR];
  }
  
  //-----------------------------------------------------------------------
  private _createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
<div id='${ID_CONTAINER}'><div id='${ID_AREA}'></div></div>`;
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>DomUtils.getShadowRoot(this).querySelector('#'+id);
  }

  setLength(value: number): void {
    if (value !== this._length) {
      this._length = Math.max(0, value);
      this._updateLengthNumber(this._length);
    }
  }
  
  getLength(): number {
    return this._getLength();
  }

  private _getLength() {
    return this._length;
  }
  
  private _updateLength(value: string): void {
    if (value === null || value === undefined) {
      return;
    }
    const numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + ScrollBar.ATTR_LENGTH + "' was NaN.");
      return;
    }
    this.setLength(numberValue);
  }
  
  private _updateLengthNumber(value: number): void {
    const areaElement = this._getById(ID_AREA);
    areaElement.style.height = value + "px";
  }
  
  // --- Position attribute ---
  setPosition(value: number): void {
    this._setPosition(value);
  }

  private _setPosition(value) {
    const container = this._getById(ID_CONTAINER);
    const cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
    if (cleanValue !== this._position) {
      this._position = cleanValue;
      this._updatePositionNumber(this._position);
    }
  }
  
  getPosition(): number {
    return this._getPosition();
  }

  private _getPosition() {
    return this._position;
  }
  
  private _updatePosition(value: string): void {
    if (value === null || value === undefined) {
      return;
    }
    const numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + ScrollBar.ATTR_LENGTH + "' was NaN.");
      return;
    }
    this.setPosition(numberValue);
  }
  
  private _updatePositionNumber(value: number): void {
    const containerElement = this._getById(ID_CONTAINER);
    containerElement.scrollTop = value;
  }
  
  // --- Thumbsize attribute ---
  setThumbSize(size: number): void {
    
  }
  
  getThumbSize(): number {
    return 7734;  // FIXME bogus.
  }

  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    this._updatePositionNumber(this._position);
  }
}
