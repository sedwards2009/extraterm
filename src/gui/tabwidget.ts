/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
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
  
  //-----------------------------------------------------------------------
  // Statics
  static TAG_NAME = "cb-tabwidget";
  
  static init(): void {
    if (registered === false) {
      window.document.registerElement(CbTabWidget.TAG_NAME, {prototype: CbTabWidget.prototype});
      registered = true;
    }
  }
  
  static EVENT_TAB_SWITCH = "tab-switch";
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _mutationObserver: MutationObserver;
  
  private _initProperties(): void {
    this._mutationObserver = null;  
  }
  
  //-----------------------------------------------------------------------
  /**
   * 
   */
  createdCallback() {
    this._initProperties();
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
#top {
  display: flex;
  flex-direction: column;
  height: 100%;
}
#tabbar {
  display: flex;
  flex: 0 auto;
  flex-direction: row;
  
  cursor: default;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}

#tabbar > DIV.tab + DIV.tab,
#tabbar > DIV.tab + DIV.catch_all {
  margin-left: 2px;
}

DIV.tab {
  text-align: center;
  flex-basis: 15rem;
  flex-grow: 1;
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


#contents {
  flex: 1 1 auto;
  position: relative;
}
#contentsstack {
  /* This and the pos:relative above are needed to get this at the correct height. */
  /* See: https://stackoverflow.com/questions/15381172/css-flexbox-child-height-100 */
  position: absolute;
  height: 100%;
  width: 100%;
  
  display: block;
}

DIV.wrapper {
  height: 100%;
  width: 100%;  
}

DIV.catch_all {
  flex-grow: 1;
}

DIV.show_frame > #tabbar > DIV.tab_inactive {
  border-bottom: 1px solid #9daca9;
}

DIV.show_frame > #contentsstack {
  border: 1px solid #9daca9;
}
DIV.show_frame > #tabbar {
  position: relative;
  top: 1px;
}

</style>
<div id='top' class='top'>
<div id='tabbar' class='tabbar'></div>
<div id='contents'><cb-stackedwidget id='contentsstack' class='contentsstack'></cb-stackedwidget></div>
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
  
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case ATTR_SHOW_FRAME:
        this._showFrame(util.toBoolean(newValue));
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
    
    // Make sure that is a catch all element at the end.
    const catchAlls = tabbar.querySelectorAll(".catch_all");
    let catchAllDiv: HTMLDivElement = null;
    if (catchAlls.length === 0) {
      catchAllDiv = <HTMLDivElement> this.ownerDocument.createElement('DIV');
      catchAllDiv.classList.add('catch_all');
      const catchAll = this.ownerDocument.createElement('content');
      catchAll.setAttribute('select', '[' + ATTR_TAG + '="rest"]');
      catchAllDiv.appendChild(catchAll);
      tabbar.appendChild(catchAllDiv);
    } else {
      catchAllDiv = <HTMLDivElement> catchAlls[0];
    }
    
    let tabElementCount = tabbar.querySelectorAll(".tab").length;
    const selectTab = tabElementCount === 0;
    
    // Create tabs and content DIVs.
    while (tabElementCount < tabCount) {
      // The tab part.
      const tabDiv = this.ownerDocument.createElement('div');
      tabDiv.classList.add('tab');
      tabDiv.classList.add('tab_inactive');
      let contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="tab_' + tabElementCount + '"]');
      
      tabDiv.appendChild(contentElement);
      tabDiv.addEventListener('click', this._createTabClickHandler(tabElementCount));
      
      // Pages for the contents stack.
      const wrapperDiv = this.ownerDocument.createElement('div');
      wrapperDiv.classList.add('wrapper');
      contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="content_' + tabElementCount + '"]');
      
      tabbar.insertBefore(tabDiv, catchAllDiv);
      
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
    
    if (selectTab) {
      this.currentIndex = 0;
      this._showTab(0);
    }
  }
  
  _createTabClickHandler(index: number) {
    return () => {
      this.currentIndex = index;
    };
  }
  
  set currentIndex(index: number) {
    if (this._getContentsStack().currentIndex === index) {
      return;
    }
    
    this._getContentsStack().currentIndex = index;
    this._showTab(index);
    util.doLater(this._sendSwitchEvent.bind(this));
  }
  
  get currentIndex(): number {
    return this._getContentsStack().currentIndex;
  }
  
  set showFrame(value: boolean) {
    this.setAttribute(ATTR_SHOW_FRAME, "" + value);
  }
  
  get showFrame(): boolean {
    if (this.hasAttribute(ATTR_SHOW_FRAME)) {
      return util.toBoolean(this.getAttribute(ATTR_SHOW_FRAME));
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
  
  _sendSwitchEvent(): void {
    console.log("tab widget _sendSwitchEvent");
    const event = new CustomEvent(CbTabWidget.EVENT_TAB_SWITCH, { detail: null });
    this.dispatchEvent(event);
  }
}

export = CbTabWidget;
