import util = require('./util');

var ID = "CbScrollbarTemplate";

var ATTR_SIZE = "size";
var ATTR_POSITION = "position";
var ID_AREA = "area";
var ID_CONTAINER = "container";

var registered = false;

class CbScrollbar extends HTMLElement {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-scrollbar', {prototype: CbScrollbar.prototype});
      registered = true;
    }
  }
  
  // WARNING: Fields like this will not be initialised automatically.
  private _position: number;
  
  private _size: number;
  
  private _css() {
    return ":host {\n" +
      "    display: block;\n" +
      "    color: transparent;\n" +
      "}\n" +

      "#container {\n" +
      "  width: 15px;\n" +
      "  height: 100%;\n"+
      "  overflow-x: hidden;" +
      "  overflow-y: scroll;" +
      "}\n" +
      
      "#area {\n" +
      "  width: 1px;" +
      "  background-color: red;" +
      "  height: 1px;" +
      "}\n";
  }

  private _html(): string {
    return "<div id='" + ID_CONTAINER + "'>" +
      "<div id='" + ID_AREA + "'></div>" +
      "</div>";
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
    
    this._updateSize(this.getAttribute(ATTR_SIZE));
    this._updatePosition(this.getAttribute(ATTR_POSITION));
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
      case ATTR_SIZE:
        this._updateSize(newValue);
        break;

      case ATTR_POSITION:
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
      console.warn("Value '" + value + "'to scrollbar attribute '" + ATTR_SIZE + "' was NaN.");
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
      console.warn("Value '" + value + "'to scrollbar attribute '" + ATTR_SIZE + "' was NaN.");
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
