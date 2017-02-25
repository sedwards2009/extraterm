/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as BulkDomOperation from '../BulkDomOperation';
import ThemeableElementBase from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import * as DomUtils from '../DomUtils';
import * as Util from './Util';

const ID = "CbStackedWidgetTemplate";
const ID_CONTAINER = 'ID_CONTAINER';
const ATTR_INDEX = 'data-cb-index';

let registered = false;

/**
 * A widget which displays one of its DIV contents at a time.
 */
export default class CbStackedWidget extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = 'CB-STACKEDWIDGET';
  
  /**
   * Initialize the CbStackedWidget class and resources.
   *
   * When CbStackedWidget is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
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
    this._currentIndex = -1;
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
  createdCallback() {
    this._initProperties();
  }
  
  attachedCallback(): void {
    super.attachedCallback();

    if (DomUtils.getShadowRoot(this) !== null) {
      return;
    }

    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    this.createPageHolders();
    
    this.showIndex(0);
  }
  
  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id='${ThemeableElementBase.ID_THEME}'></style>
<div id='${ID_CONTAINER}'></div>`;
      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  /**
   * 
   */
  private __getById(id:string): Element {
    return DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_STACKEDWIDGET];
  }
    
  //-----------------------------------------------------------------------

  // Override
  appendChild(newNode: Node): Node {
    const result = super.appendChild(newNode);
    this.createPageHolders();
    if (this._currentIndex === -1) {
      this._currentIndex = 0;
    }
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
  
  setCurrentIndex(index: number): void {
    if (index < 0 || index >= this.childElementCount) {
      return;
    }

    this._currentIndex = index;
    this.showIndex(index);
  }
  
  getCurrentIndex(): number {
    return this._currentIndex;
  }
  
  private showIndex(index: number): void {
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
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
    const container = <HTMLDivElement>this.__getById(ID_CONTAINER);
    
    for (let i=0; i<this.children.length; i++) {
      const kid = this.children.item(i);
      kid.slot = "" + i;
    }
    
    while (container.childElementCount < this.childElementCount) {
      const holderDiv = this.ownerDocument.createElement('div');
      const contentElement = this.ownerDocument.createElement('slot');
      contentElement.setAttribute('name', "" + container.childElementCount);
      holderDiv.appendChild(contentElement);
      container.appendChild(holderDiv);
    }
    
    while (container.childElementCount > this.childElementCount) {
      container.removeChild(container.children.item(container.children.length-1));
    }
  }
}
