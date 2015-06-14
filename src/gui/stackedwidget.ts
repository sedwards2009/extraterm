import util = require("./util");
"use strict";
const ID = "CbStackedWidgetTemplate";
const ID_CONTAINER = 'container';
const ATTR_INDEX = 'data-cb-index';

let registered = false;

/**
 * A widget which displays one of its DIV contents at a time.
 */
class CbStackedWidget extends HTMLElement {
  
  //-----------------------------------------------------------------------
  // Statics
  static TAG_NAME = 'cb-stackedwidget';
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbStackedWidget.TAG_NAME, {prototype: CbStackedWidget.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _currentIndex: number;
  
  private _initProperties(): void {
    this._currentIndex = 0;  
  }
  
  //-----------------------------------------------------------------------
  
  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplate>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplate>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `
<style>
.container {
  overflow: hidden;
  display: flex;
  width: 100%;
  height: 100%;
}

.container > DIV {
  width: 100%;
  height: 100%;
  
  flex-grow: 0;
  flex-shrink: 0;
  flex-basis: 100%;
  
  overflow: hidden;
  display: inline-block;
  vertical-align: top;
}

.visible {
  order: 0;
}

.hidden {
  order: 1;
  visibility: hidden;
}
</style>
<div id='${ID_CONTAINER}' class='container'></div>`;
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
    this._initProperties();
    
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.createPageHolders();
    
    this.showIndex(0);
  }
  
  // Override
  appendChild(newNode: Node): Node {
    const result = super.appendChild(newNode);
    this.createPageHolders();
    this.showIndex(this._currentIndex);
    return result;
  }
  
  // Override
  removeChild(oldNode: Node): Node {
    const result = super.removeChild(oldNode);
    this.createPageHolders();
    if (this._currentIndex >= this.childElementCount) {
      this._currentIndex = this.childElementCount - 1;
    }
    this.showIndex(this._currentIndex);
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
    const container = <HTMLDivElement>this.__getById('container');
    for (let i=0; i<container.children.length; i++) {
      const kid = <HTMLElement>container.children.item(i);
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
    const container = <HTMLDivElement>this.__getById('container');
    
    for (let i=0; i<this.children.length; i++) {
      const kid = this.children.item(i);
      kid.setAttribute(ATTR_INDEX, "" + i);
    }
    
    while (container.childElementCount < this.childElementCount) {
      const holderDiv = this.ownerDocument.createElement('div');
      const contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_INDEX + '="' + container.childElementCount + '"]');
      holderDiv.appendChild(contentElement);
      container.appendChild(holderDiv);
    }
    
    while (container.childElementCount > this.childElementCount) {
      container.removeChild(container.children.item(container.children.length-1));
    }
  }
}

export = CbStackedWidget;
