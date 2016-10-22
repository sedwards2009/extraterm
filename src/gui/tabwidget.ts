/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import ThemeableElementBase = require('../themeableelementbase');
import ThemeTypes = require('../theme');
import CbStackedWidget = require('./stackedwidget');
import CbTab = require('./tab');
import ResizeRefreshElementBase = require('../ResizeRefreshElementBase');
import util = require('./util');
import domutils = require('../domutils');
import _ = require('lodash');
import Logger = require('../logger');
import LogDecorator = require('../logdecorator');
const log = LogDecorator;

CbStackedWidget.init();

const ID = "CbTabWidgetTemplate";
const ATTR_TAG = 'data-cb-tag';
const ATTR_SHOW_FRAME = "show-frame";

const ATTR_TAG_REST_LEFT = "rest-left";
const ATTR_TAG_REST_RIGHT = "rest";

let registered = false;

const ID_TOP = "ID_TOP";
const ID_TABBAR = "ID_TABBAR";
const ID_CONTENTSTACK = "ID_CONTENTSTACK";
const ID_CONTENTS = "ID_CONTENTS";
const CLASS_REMAINDER_LEFT = "remainder-left";
const CLASS_REMAINDER_RIGHT = "remainder";
const CLASS_ACTIVE = "active";
const CLASS_TAB = "tab";

/**
 * A widget to display a stack of tabs.
 *
 * See CbTab.
 */
class CbTabWidget extends ThemeableElementBase {
  
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
  private _log: Logger;
  
  private _mutationObserver: MutationObserver;
  
  private _initProperties(): void {
    this._mutationObserver = null;
    this._log = new Logger(CbTabWidget.TAG_NAME);
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
    this.updateThemeCss();
    
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
  
  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.GUI_TABWIDGET];
  }
  
  //-----------------------------------------------------------------------

  update(): void {
    this.createTabHolders();
  }  
  
  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    const contentsStack = this._getContentsStack();
    if (contentsStack === null) {
      return;
    }
    contentsStack.refresh(level);
    super.refresh(level);
  }

  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
<div id='${ID_TOP}'>
<ul id='${ID_TABBAR}' class="extraterm-tabs"></ul>
<div id='${ID_CONTENTS}'><cb-stackedwidget id='${ID_CONTENTSTACK}'></cb-stackedwidget></div>
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
    return <HTMLDivElement> this.__getById(ID_TOP);
  }
  
  private _getTabbar(): HTMLDivElement {
    return <HTMLDivElement> this.__getById(ID_TABBAR);
  }
  
  private _getContentsStack(): CbStackedWidget {
    return <CbStackedWidget> this.__getById(ID_CONTENTSTACK);
  }
  
  private createTabHolders(): void {
    const tabbar = this._getTabbar();
    const contentsStack = this._getContentsStack();
    let tabCount = 0;
    let stateInTab = false;
    
    // Tag the source content as tabs or content so that we can distribute it over our shadow DOM.
    let restAttr = ATTR_TAG_REST_LEFT;
    for (let i=0; i<this.children.length; i++) {
      const kid = <HTMLElement>this.children.item(i);
      if (kid.nodeName === CbTab.TAG_NAME) {
        tabCount++;
        kid.setAttribute(ATTR_TAG, 'tab_' + (tabCount-1));
        stateInTab = true;
        
      } else if (kid.nodeName === "DIV" && stateInTab) {
        kid.setAttribute(ATTR_TAG, 'content_' + (tabCount-1));
        stateInTab = false;
        restAttr = ATTR_TAG_REST_RIGHT;

      } else if (kid.nodeName=== "DIV") {
        kid.setAttribute(ATTR_TAG, restAttr);
        restAttr = ATTR_TAG_REST_RIGHT;
      }
    }
    
    // Make sure that there is 'rest' element at the front.
    if (tabbar.firstElementChild === null || ! tabbar.firstElementChild.classList.contains(CLASS_REMAINDER_LEFT)) {
      const restAllLi = <HTMLLIElement> this.ownerDocument.createElement('LI');
      restAllLi.classList.add(CLASS_REMAINDER_LEFT);

      const catchAll = this.ownerDocument.createElement('content');
      catchAll.setAttribute('select', `[${ATTR_TAG}="${ATTR_TAG_REST_LEFT}"]`);
      restAllLi.appendChild(catchAll);
      tabbar.insertAdjacentElement('afterbegin', restAllLi);
    }

    // Make sure that there is a catch all element at the end.
    const catchAlls = tabbar.querySelectorAll("." + CLASS_REMAINDER_RIGHT);
    let catchAllLi: HTMLLIElement = null;
    if (catchAlls.length === 0) {
      catchAllLi = <HTMLLIElement> this.ownerDocument.createElement('LI');
      catchAllLi.classList.add(CLASS_REMAINDER_RIGHT);
            
      const catchAll = this.ownerDocument.createElement('content');
      catchAll.setAttribute('select', `[${ATTR_TAG}="${ATTR_TAG_REST_RIGHT}"]`);
      catchAllLi.appendChild(catchAll);
      tabbar.appendChild(catchAllLi);
    } else {
      catchAllLi = <HTMLLIElement> catchAlls[0];
    }
    
    let tabElementCount = tabbar.querySelectorAll("." + CLASS_TAB).length;
    
    // Create tabs and content DIVs.
    while (tabElementCount < tabCount) {
      // The tab part.
      const tabLi = this.ownerDocument.createElement('li');
      tabLi.classList.add(CLASS_TAB);
      
      let contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="tab_' + tabElementCount + '"]');
      
      tabLi.appendChild(contentElement);
      tabLi.addEventListener('click', this._tabClickHandler.bind(this, tabLi, tabElementCount));
      
      // Pages for the contents stack.
      const wrapperDiv = this.ownerDocument.createElement('div');
      wrapperDiv.classList.add('wrapper');
      contentElement = this.ownerDocument.createElement('content');
      contentElement.setAttribute('select', '[' + ATTR_TAG + '="content_' + tabElementCount + '"]');
      
      tabbar.insertBefore(tabLi, catchAllLi);
      
      wrapperDiv.appendChild(contentElement);
      contentsStack.appendChild(wrapperDiv);
      
      tabElementCount = tabbar.querySelectorAll("." + CLASS_TAB).length;
    }
    
    // Delete any excess tab tags.
    let tabElements = tabbar.querySelectorAll("." + CLASS_TAB);
    while (tabElements.length > tabCount) {
      const tabToDelete = tabElements[tabElements.length-1];
      tabbar.removeChild(tabToDelete);
      contentsStack.removeChild(contentsStack.children[contentsStack.children.length-1]);
      tabElements = tabbar.querySelectorAll("." + CLASS_TAB);
    }
    
    // Try to find the previously active tab and take note of its index.
    let selectTab = -1;
    tabElements = tabbar.querySelectorAll("." + CLASS_TAB);
    for (let i=0; i<tabElements.length; i++) {
      if (tabElements[i].classList.contains(CLASS_ACTIVE)) {
        selectTab = i;
        break;
      }
    }
    
    if (selectTab === -1) {
      selectTab = Math.min(this.currentIndex, tabCount-1);
    }
    
    this.currentIndex = selectTab;
    this._showTab(selectTab);
  }
  
  private _tabClickHandler(tabElement: HTMLElement, index: number) {
    // This handler may fire when a tab is removed during the click event bubble procedure. This check
    // supresses the event if the tab has been removed already.
    if (tabElement.parentNode !== null) {
      this.currentIndex = index;
      domutils.doLater(this._sendSwitchEvent.bind(this));
    }
  }
  
  set currentIndex(index: number) {
    if (index < 0 || this._getContentsStack().children.length <= index) {
      this._log.warn("Out of range index given to the 'currentIndex' property.");
      return;
    }
    
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
    let tabCounter = 0;
    for (let i=0; i<tabbar.children.length; i++) {
      const item = <HTMLElement> tabbar.children.item(i);
      if (item.classList.contains('tab')) {
        if (tabCounter === index) {
          item.classList.add(CLASS_ACTIVE);
        } else {
          item.classList.remove(CLASS_ACTIVE);
        }
        tabCounter++;
      }
    }
  }
  
  private _sendSwitchEvent(): void {
    const event = new CustomEvent(CbTabWidget.EVENT_TAB_SWITCH, { detail: null });
    this.dispatchEvent(event);
  }
}

export = CbTabWidget;
