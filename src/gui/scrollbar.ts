/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./util');

const ID = "CbScrollbarTemplate";
const ID_AREA = "area";
const ID_CONTAINER = "container";

let registered = false;

class CbScrollbar extends HTMLElement {
  
  static TAG_NAME = 'cb-scrollbar';
  
  static ATTR_SIZE = "size";
  
  static ATTR_POSITION = "position";
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbScrollbar.TAG_NAME, {prototype: CbScrollbar.prototype});
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  private _position: number;
  
  private _size: number;
  
  private _css() {
    return `
      :host {
          display: block;
          color: transparent;
      }
      #container {
        width: 17px;
        height: 100%;
        overflow-x: hidden;
        overflow-y: scroll;
      }
      #area {
        width: 1px;
        background-color: red;
        height: 1px;
      }`;
  }

  private _html(): string {
    return `<div id='${ID_CONTAINER}'><div id='${ID_AREA}'></div></div>`;
  }
  
  private _initProperties(): void {
    this._position = 0;
    this._size = 1;
  }
  
  createdCallback(): void {
    this._initProperties(); // Initialise our properties. The constructor was not called.
    
    var shadow = util.createShadowRoot(this);
    var clone = this._createClone();
    shadow.appendChild(clone);
    this._getById(ID_CONTAINER).addEventListener('scroll', (ev: Event) => {
      var container = this._getById(ID_CONTAINER);
      var top = container.scrollTop;
      this._position = top;
      var event = new CustomEvent('scroll',
          { detail: {
            position: top,
            isTop: top === 0,
            isBottom: (container.scrollHeight - container.clientHeight) === top } });
      this.dispatchEvent(event);
    });
    
    this._updateSize(this.getAttribute(CbScrollbar.ATTR_SIZE));
    this._updatePosition(this.getAttribute(CbScrollbar.ATTR_POSITION));
  }
  
  private _createClone(): Node {
    var template: HTMLTemplate = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>" + this._css() + "</style>\n" + this._html();
      window.document.body.appendChild(template);
    }
    return window.document.importNode(template.content, true);
  }

  private _getById(id: string): HTMLElement {
    return <HTMLElement>util.getShadowRoot(this).querySelector('#'+id);
  }


  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case CbScrollbar.ATTR_SIZE:
        this._updateSize(newValue);
        break;

      case CbScrollbar.ATTR_POSITION:
        this._updatePosition(newValue);
        break;
        
      default:
        break;
    }
  }
  
  // --- Size attribute ---
  set size(value: number) {
    if (value !== this._size) {
      this._size = Math.max(0, value);
      this._updateSizeNumber(this._size);
    }
  }
  
  get size(): number {
    return this._size;
  }
  
  private _updateSize(value: string): void {
    if (value === null || value === undefined) {
      return;
    }
    var numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + CbScrollbar.ATTR_SIZE + "' was NaN.");
      return;
    }
    this.size = numberValue;
  }
  
  private _updateSizeNumber(value: number): void {
    var areaElement = this._getById(ID_AREA);
    areaElement.style.height = value + "px";
  }
  
  // --- Position attribute ---
  set position(value: number) {
    var container = this._getById(ID_CONTAINER);
    var cleanValue = Math.min(container.scrollHeight-container.clientHeight, Math.max(0, value));
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
    var numberValue = parseInt(value, 10);
    if (isNaN(numberValue)) {
      console.warn("Value '" + value + "'to scrollbar attribute '" + CbScrollbar.ATTR_SIZE + "' was NaN.");
      return;
    }
    this.position = numberValue;
  }
  
  private _updatePositionNumber(value: number): void {
    var containerElement = this._getById(ID_CONTAINER);
    containerElement.scrollTop = value;
  }
}

export = CbScrollbar;
