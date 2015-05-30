import CbStackedWidget = require("./stackedwidget");
import util = require("./util");
"use strict";

CbStackedWidget.init();

const ID = "CbTabWidgetTemplate";
const ATTR_TAG = 'data-cb-tag';
const ATTR_SHOW_FRAME = "show-frame";

let registered = false;

/**
 * A stack of tabs.
 */
class CbTabWidget extends HTMLElement {
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement('cb-tabwidget', {prototype: CbTabWidget.prototype});
      registered = true;
    }
  }
  
  private _mutationObserver: MutationObserver;
  
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
DIV.top {
  display: flex;
  flex-direction: column;
}
DIV.tabbar {
  display: flex;
  flex: 0 auto;
  flex-direction: row;
  
  cursor: default;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}

DIV.tabbar > DIV.tab + DIV.tab,
DIV.tabbar > DIV.tab + DIV.catch_all {
  margin-left: 2px;
}

DIV.tab {
  text-align: center;
  flex-basis: 15rem;
  flex-grow: 0;
  text-overflow: ellipsis;
  white-space: pre;
  overflow: hidden;
}

DIV.tab_active {
  padding: 0 0.563rem;
  font-size: 0.875rem;
  line-height: 1.313rem;
  letter-spacing: 0;
  color: #454545;
  text-shadow: 0 1px #fff;
  vertical-align: top;
    
  background-color: #dfe2e2;

  box-shadow: inset 0 1px #fff;
  border: 1px solid #9daca9;
  border-bottom: 0px;
  border-radius: 4px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
}

DIV.tab_inactive {
  padding: 0 0.563rem;
  font-size: 0.875rem;
  line-height: 1.313rem;
  letter-spacing: 0;
  color: #454545;
  text-shadow: 0 1px #fff;
  vertical-align: top;
  background-color: #e5e9e8;
  box-shadow: inset 0 1px #fff;
  border: 1px solid #9daca9;
  border-bottom: 0px;
  border-radius: 4px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;

  background-color: #D2D6D6;

  margin-top: 3px;
}

DIV.tab_inactive:hover {
  background-color: #eff1f1;
}

DIV.catch_all {
  flex-grow: 1;
}

DIV.show_frame > DIV.tabbar > DIV.tab_inactive {
  border-bottom: 1px solid #9daca9;
}

DIV.show_frame > #contentsstack {
  border: 1px solid #9daca9;
}
DIV.show_frame > #tabbar {
  position: relative;
  top: 1px;
}

</style>\n
<div id='top' class='top'>
<div id='tabbar' class='tabbar'></div>
<cb-stackedwidget id='contentsstack' class='contentsstack'></cb-stackedwidget>
</div>
`;
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
  
  private _getTop(): HTMLDivElement {
    return <HTMLDivElement> this.__getById('top');
  }
  
  private _getTabbar(): HTMLDivElement {
    return <HTMLDivElement> this.__getById('tabbar');
  }
  
  private _getContentsStack(): CbStackedWidget {
    return <CbStackedWidget> this.__getById('contentsstack');
  }
  
  /**
   * 
   */
  createdCallback() {
    const shadow = util.createShadowRoot(this);
    const clone = this.createClone();
    shadow.appendChild(clone);
    
    this.createTabHolders();
    this.currentIndex = 0;
    this._showFrame(this.showFrame);
    
    this._mutationObserver = new MutationObserver( (mutations) => {
      this.createTabHolders();
    });
    this._mutationObserver.observe(this, { childList: true });
  }
  
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case ATTR_SHOW_FRAME:
        this._showFrame(toBoolean(newValue));
        break;
        
      default:
        break;
    }
  }

  private createTabHolders(): void {
    const tabbar = this._getTabbar();
    const contentsStack = this._getContentsStack();
    let tabCount = 0;
    let stateInTab = false;
    
    // Tag the source content as tabs or content so that we can distribute it over our shadow DOM.
    for (let i=0; i<this.children.length; i++) {
      const kid = <HTMLElement>this.children.item(i);
      if (kid.nodeName === "CB-TAB") {
        tabCount++;
        kid.setAttribute(ATTR_TAG, 'tab_' + (tabCount-1));
        stateInTab = true;
        
      } else if (kid.nodeName === "DIV" && stateInTab) {
        kid.setAttribute(ATTR_TAG, 'content_' + (tabCount-1));
        stateInTab = false;
      } else if (kid.nodeName=== "DIV") {
        kid.setAttribute(ATTR_TAG, 'rest');
      }
    }
    
    let tabElementCount = tabbar.querySelectorAll(".tab").length;
    
    // Create tabs and content DIVs.
    while (tabElementCount < tabCount) {
      // The tab part.
      const tabDiv = this.ownerDocument.createElement('div');
      tabDiv.classList.add('tab');
      tabDiv.classList.add('tab_inactive');
      let contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="tab_' + tabbar.childElementCount + '"]');
      
      tabDiv.appendChild(contentElement);
      tabDiv.addEventListener('click', this._createTabClickHandler(tabbar.childElementCount));
      
      // Pages for the contents stack.
      const wrapperDiv = this.ownerDocument.createElement('div');
      contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="content_' + tabbar.childElementCount + '"]');
      
      tabbar.appendChild(tabDiv);  
      
      wrapperDiv.appendChild(contentElement);
      contentsStack.appendChild(wrapperDiv);
      
      tabElementCount = tabbar.querySelectorAll(".tab").length;
    }
    
    // Delete any excess tab tags.
    let tabElements = tabbar.querySelectorAll(".tab");
    while (tabElements.length > tabCount) {
      const tabToDelete = tabElements[tabElements.length-1];
      tabbar.removeChild(tabToDelete);
      contentsStack.removeChild(contentsStack.children[contentsStack.children.length-1]);
      tabElements = tabbar.querySelectorAll(".tab");
    }
    
    // Make sure that is a catch all element at the end.
    const catchAllCount = tabbar.querySelectorAll(".catch_all").length;    
    if (catchAllCount === 0) {
      const catchAllDiv = this.ownerDocument.createElement('div');
      catchAllDiv.classList.add('catch_all');
      const catchAll = this.ownerDocument.createElement('content');
      catchAll.setAttribute('select', '[' + ATTR_TAG + '="rest"]');
      catchAllDiv.appendChild(catchAll);
      tabbar.appendChild(catchAllDiv);
    }    
  }
  
  _createTabClickHandler(index: number) {
    return () => {
      this.currentIndex = index;
    };
  }
  
  set currentIndex(index: number) {
    this._getContentsStack().currentIndex = index;
    this._showTab(index);
  }
  
  get currentIndex(): number {
    return this._getContentsStack().currentIndex;
  }
  
  set showFrame(value: boolean) {
    this.setAttribute(ATTR_SHOW_FRAME, "" + value);
  }
  
  get showFrame(): boolean {
    if (this.hasAttribute(ATTR_SHOW_FRAME)) {
      return toBoolean(this.getAttribute(ATTR_SHOW_FRAME));
    } else {
      return true;
    }
  }
  
  _showFrame(value: boolean): void {
    if (value) {
      this._getTop().classList.add('show_frame');
    } else {
      this._getTop().classList.remove('show_frame');          
    }
  }
  
  private _showTab(index: number): void {
    const tabbar = this._getTabbar();
    for (let i=0; i<tabbar.children.length; i++) {
      const item = <HTMLElement> tabbar.children.item(i);
      if (item.classList.contains('tab')) {
        if (i === index) {
          item.classList.remove('tab_inactive');
          item.classList.add('tab_active');
        } else {
          item.classList.remove('tab_active');
          item.classList.add('tab_inactive');
        }
      }
    }
  }  
}
/**
 * Parse a string as a boolean value
 * 
 * @param  value string to parse
 * @return the boolean value or false if it could not be parsed
 */
function toBoolean(value: any): boolean {
  if (value === true || value === false) {
    return value;
  }
  if (value === 0) {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return Boolean(value);
}

export = CbTabWidget;
