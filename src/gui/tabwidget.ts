/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import CbStackedWidget = require('./stackedwidget');
import CbTab = require('./tab');
import util = require('./util');
import domutils = require('../domutils');
import _ = require('lodash');

CbStackedWidget.init();

const ID = "CbTabWidgetTemplate";
const ATTR_TAG = 'data-cb-tag';
const ATTR_SHOW_FRAME = "show-frame";

let registered = false;

/**
 * A widget to display a stack of tabs.
 *
 * See CbTab.
 */
class CbTabWidget extends HTMLElement {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "CB-TABWIDGET";
  
  /**
   * Initialize the CbTabWidget class and resources.
   *
   * When CbTabWidget is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
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
    const shadow = domutils.createShadowRoot(this);
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
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case ATTR_SHOW_FRAME:
        this._showFrame(util.toBoolean(newValue));
        break;
        
      default:
        break;
    }
  }
  
  //-----------------------------------------------------------------------

  update(): void {
    this.createTabHolders();
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
    return domutils.getShadowRoot(this).querySelector('#'+id);
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

  private createTabHolders(): void {
    const tabbar = this._getTabbar();
    const contentsStack = this._getContentsStack();
    let tabCount = 0;
    let stateInTab = false;
    
    // Tag the source content as tabs or content so that we can distribute it over our shadow DOM.
    for (let i=0; i<this.children.length; i++) {
      const kid = <HTMLElement>this.children.item(i);
      if (kid.nodeName === CbTab.TAG_NAME) {
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
    const selectTab = tabElementCount === 0 ? 0 : this.currentIndex;
    
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
    
    this.currentIndex = selectTab;
    this._showTab(selectTab);
  }
  
  private _createTabClickHandler(index: number) {
    return () => {
      this.currentIndex = index;
      domutils.doLater(this._sendSwitchEvent.bind(this));
    };
  }
  
  set currentIndex(index: number) {
    if (this._getContentsStack().currentIndex === index) {
      return;
    }
    
    this._getContentsStack().currentIndex = index;
    this._showTab(index);
  }
  
  get currentIndex(): number {
    return this._getContentsStack().currentIndex;
  }
  
  private _getCbTabs(): CbTab[] {
    return <CbTab[]> domutils.toArray<Element>(this.children).filter( element => element.nodeName === CbTab.TAG_NAME );
  }
  
  set currentTab(selectTab: CbTab) {
    const index = _.findIndex(this._getCbTabs(), tab => tab === selectTab );
    if (index === -1) {
      return;
    }
    this.currentIndex = index;
  }
  
  get currentTab(): CbTab {
    const currentIndex = this.currentIndex;
    if (currentIndex === -1) {
      return null;
    }
    const currentTab = this._getCbTabs()[currentIndex];
    return currentTab;
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
  
  private _showFrame(value: boolean): void {
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
  
  private _sendSwitchEvent(): void {
    const event = new CustomEvent(CbTabWidget.EVENT_TAB_SWITCH, { detail: null });
    this.dispatchEvent(event);
  }
}

export = CbTabWidget;
