/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import ThemeableElementBase = require('../themeableelementbase');
import ThemeTypes = require('../theme');
import domutils = require('../domutils');
import util = require('./util');

const ID = "CbScrollbarTemplate";
const ID_AREA = "ID_AREA";
const ID_CONTAINER = "ID_CONTAINER";

let registered = false;

/**
 * A scrollbar.
 */
class CbScrollbar extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-SCROLLBAR';
  
  static ATTR_LENGTH = "length";
  
  static ATTR_POSITION = "position";
  
  static ATTR_THUMBSIZE = "thumbsize";
  
  /**
   * Initialize the CbScrollbar class and resources.
   *
   * When CbScrollbar is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbScrollbar.TAG_NAME, {prototype: CbScrollbar.prototype});
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  private _position: number;
  
  private _length: number;
  
  private _initProperties(): void {
    this._position = 0;
    this._length = 1;
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
  
  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
  }
  
  /**
   * Custom Element 'attached' life cycle hook.
   */
  attachedCallback(): void {
    super.attachedCallback();

    if (domutils.getShadowRoot(this) !== null) {
      return;
    }

    const shadow = domutils.createShadowRoot(this);
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
    
    this._updateLength(this.getAttribute(CbScrollbar.ATTR_LENGTH));
    this._updatePosition(this.getAttribute(CbScrollbar.ATTR_POSITION));
  }
  
  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case CbScrollbar.ATTR_LENGTH:
        this._updateLength(newValue);
        break;

      case CbScrollbar.ATTR_POSITION:
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
    return <HTMLElement>domutils.getShadowRoot(this).querySelector('#'+id);
  }

  // --- Length attribute ---
  set length(value: number) {
    if (value !== this._length) {
      this._length = Math.max(0, value);
      this._updateLengthNumber(this._length);
    }
  }
  
  get length(): number {
    return this._length;
  }
  
  private _updateLength(value: string): void {
    if (value === null || value === undefined) {
      return;
    }
    const numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + CbScrollbar.ATTR_LENGTH + "' was NaN.");
      return;
    }
    this.length = numberValue;
  }
  
  private _updateLengthNumber(value: number): void {
    const areaElement = this._getById(ID_AREA);
    areaElement.style.height = value + "px";
  }
  
  // --- Position attribute ---
  set position(value: number) {
    const container = this._getById(ID_CONTAINER);
    const cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
    if (cleanValue !== this._position) {
      this._position = cleanValue;
      this._updatePositionNumber(this._position);
    }
  }
  
  get position(): number {
    return this._position;
  }
  
  private _updatePosition(value: string): void {
    if (value === null || value === undefined) {
      return;
    }
    const numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + CbScrollbar.ATTR_LENGTH + "' was NaN.");
      return;
    }
    this.position = numberValue;
  }
  
  private _updatePositionNumber(value: number): void {
    const containerElement = this._getById(ID_CONTAINER);
    containerElement.scrollTop = value;
  }
  
  // --- Thumbsize attribute ---
  set thumbSize(size: number) {
    
  }
  
  get thumbSize(): number {
    return 7734;  // FIXME bogus.
  }
}

export = CbScrollbar;
