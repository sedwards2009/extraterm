///<reference path='../chrome_lib.d.ts'/>
import util = require("./util");

var ID = "CbStackedWidgetTemplate";
var ID_CONTAINER_ = 'container';
var ATTR_INDEX = 'data-cb-index';

var registered = false;

/**
 * A widget which displays one of its DIV contents at a time.
 */
class CbStackedWidget extends HTMLElement {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-stackedwidget', {prototype: CbStackedWidget.prototype});
      registered = true;
    }
  }
  
  private _currentIndex: number;
  
  /**
   * 
   */
  private createClone() {
    var template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = "<style>\n" +
        ".container {\n" +
        "}\n" +

        ".visible {\n" +
        "}\n" +

        ".hidden {\n" +
        "  display: none;\n" +
        "}\n" +
        "</style>\n" +
        "<div id='" + ID_CONTAINER_ + "' class='container'></div>";
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private __getById(id:string): Element {
    return util.getShadowRoot(this).querySelector('#'+id);
  }
  
  /**
   * 
   */
  createdCallback() {
    this._currentIndex = 0;
    
    var shadow = util.createShadowRoot(this);
    var clone = this.createClone();
    shadow.appendChild(clone);
    this.createPageHolders();
    
    this.showIndex(0);
  }
  
  // Override
  appendChild(newNode: Node): Node {
    var result = super.appendChild(newNode);
    this.createPageHolders();
    return result;
  }
  
  // Override
  removeChild(oldNode: Node): Node {
    var result = super.removeChild(oldNode);
    this.createPageHolders();
    return result;
  }
  
  set currentIndex(index: number) {
    this._currentIndex = index;
    this.showIndex(index);
  }
  
  get currentIndex(): number {
    return this._currentIndex;
  }
  
  private showIndex(index: number): void {
    var container = <HTMLDivElement>this.__getById('container');
    for (var i=0; i<container.children.length; i++) {
      var kid = <HTMLElement>container.children.item(i);
      if (i === index) {
        kid.classList.add('visible');
        kid.classList.remove('hidden');
      } else {
        kid.classList.remove('visible');
        kid.classList.add('hidden');        
      }
    }
  }

  private createPageHolders(): void {
    var container = <HTMLDivElement>this.__getById('container');
    
    for (var i=0; i<this.children.length; i++) {
      var kid = this.children.item(i);
      kid.setAttribute(ATTR_INDEX, "" + i);
    }
    
    while (container.childElementCount < this.childElementCount) {
      var holderDiv = this.ownerDocument.createElement('div');
      var contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', 'div[' + ATTR_INDEX + '="' + container.childElementCount + '"]');
      holderDiv.appendChild(contentElement);
      container.appendChild(holderDiv);
    }
    
    while (container.childElementCount > this.childElementCount) {
      container.removeChild(container.children.item(container.children.length-1));
    }
  }
}

export = CbStackedWidget;
