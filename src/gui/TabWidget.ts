/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import {StackedWidget} from './StackedWidget';
import {Tab} from './Tab';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as Util from './Util';
import * as DomUtils from '../DomUtils';
import * as _ from 'lodash';
import Logger from '../Logger';
import log from '../LogDecorator';

StackedWidget.init();

const ID = "EtTabWidgetTemplate";
const ATTR_TAG = 'data-et-tag';
const ATTR_SHOW_FRAME = "show-frame";

const ATTR_TAG_REST_LEFT = "rest-left";
const ATTR_TAG_REST_RIGHT = "rest";

let registered = false;

const ID_TOP = "ID_TOP";
const ID_TABBAR = "ID_TABBAR";
const ID_TABBAR_CONTAINER = "ID_TABBAR_CONTAINER";
const ID_CONTENTSTACK = "ID_CONTENTSTACK";
const ID_CONTENTS = "ID_CONTENTS";
const ID_DRAG_INDICATOR_CONTAINER = "ID_DRAG_INDICATOR_CONTAINER";
const ID_DRAG_INDICATOR = "ID_DRAG_INDICATOR";

const CLASS_INDICATOR_HIDE = "CLASS_INDICATOR_HIDE";
const CLASS_INDICATOR_SHOW = "CLASS_INDICATOR_SHOW";
const CLASS_REMAINDER_LEFT = "remainder-left";
const CLASS_REMAINDER_RIGHT = "remainder";
const CLASS_ACTIVE = "active";
const CLASS_TAB = "tab";
const MIMETYPE_ELEMENT = "application/x-element";


interface TabDroppedEventDetail {
  tabId: string;
  targetTabWidget: TabWidget;
  tabIndex: number;
}

/**
 * A widget to display a stack of tabs.
 *
 * See Tab.
 */
export class TabWidget extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-TABWIDGET";
  
  /**
   * Initialize the TabWidget class and resources.
   *
   * When TabWidget is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(TabWidget.TAG_NAME.toLowerCase(), TabWidget);
      registered = true;
    }
  }
  
  static EVENT_TAB_SWITCH = "tab-switch";
  
  static EVENT_TAB_DROPPED = "tabwidget-tab-dropped";

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _mutationObserver: MutationObserver;
  
  private _showTabs: boolean;

  private _initProperties(): void {
    this._log = new Logger(TabWidget.TAG_NAME, this);
    this._mutationObserver = null;
    this._showTabs = true;
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
                                                           
  constructor() {
    super();

    this._initProperties();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);
    this.updateThemeCss();
    
    this.createTabHolders();
    this.setSelectedIndex(0);
    this._showFrame(this.getShowFrame());
    
    this._mutationObserver = new MutationObserver( (mutations) => {
      this.createTabHolders();
    });
    this._mutationObserver.observe(this, { childList: true });

    const dragIndicatorContainer = DomUtils.getShadowId(this, ID_DRAG_INDICATOR_CONTAINER);
    dragIndicatorContainer.classList.add(CLASS_INDICATOR_HIDE);

    this._setupDragAndDrop();
  }

  static get observedAttributes(): string[] {
    return [ATTR_SHOW_FRAME];
  }
  
  /**
   * Custom Element 'attribute changed' hook.
   */
  attributeChangedCallback(attrName: string, oldValue: string, newValue: string): void {
    switch (attrName) {
      case ATTR_SHOW_FRAME:
        this._showFrame(Util.toBoolean(newValue));
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
    if (contentsStack !== null) {
      super.refresh(level);
      contentsStack.refresh(level);
    }
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
<div id='${ID_TABBAR_CONTAINER}'>
<ul id='${ID_TABBAR}' class="extraterm-tabs"></ul>
<div id='${ID_DRAG_INDICATOR_CONTAINER}'><div id='${ID_DRAG_INDICATOR}'></div></div>
</div>
<div id='${ID_CONTENTS}'><${StackedWidget.TAG_NAME} id='${ID_CONTENTSTACK}'></${StackedWidget.TAG_NAME}></div>
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
    return DomUtils.getShadowRoot(this).querySelector('#'+id);
  }
  
  private _getTop(): HTMLDivElement {
    return <HTMLDivElement> this.__getById(ID_TOP);
  }
  
  private _getTabbar(): HTMLDivElement {
    return <HTMLDivElement> this.__getById(ID_TABBAR);
  }
  
  private _getContentsStack(): StackedWidget {
    return <StackedWidget> this.__getById(ID_CONTENTSTACK);
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
      if (kid.nodeName === Tab.TAG_NAME) {
        tabCount++;
        kid.slot = 'tab_' + (tabCount-1);
        stateInTab = true;
        
      } else if (kid.nodeName === "DIV" && stateInTab) {
        kid.slot = 'content_' + (tabCount-1);
        stateInTab = false;
        restAttr = ATTR_TAG_REST_RIGHT;

      } else if (kid.nodeName=== "DIV") {
        kid.slot = restAttr;
        restAttr = ATTR_TAG_REST_RIGHT;
      }
    }
    
    // Make sure that there is 'rest' element at the front.
    if (tabbar.firstElementChild === null || ! tabbar.firstElementChild.classList.contains(CLASS_REMAINDER_LEFT)) {
      const restAllLi = <HTMLLIElement> this.ownerDocument.createElement('LI');
      restAllLi.classList.add(CLASS_REMAINDER_LEFT);

      const catchAll = this.ownerDocument.createElement('slot');
      catchAll.setAttribute('name', ATTR_TAG_REST_LEFT);
      restAllLi.appendChild(catchAll);
      tabbar.insertAdjacentElement('afterbegin', restAllLi);
    }

    // Make sure that there is a catch all element at the end.
    const catchAlls = tabbar.querySelectorAll("." + CLASS_REMAINDER_RIGHT);
    let catchAllLi: HTMLLIElement = null;
    if (catchAlls.length === 0) {
      catchAllLi = <HTMLLIElement> this.ownerDocument.createElement('LI');
      catchAllLi.classList.add(CLASS_REMAINDER_RIGHT);
            
      const catchAll = this.ownerDocument.createElement('slot');
      catchAll.setAttribute('name', ATTR_TAG_REST_RIGHT);
      catchAllLi.appendChild(catchAll);
      tabbar.appendChild(catchAllLi);
    } else {
      catchAllLi = <HTMLLIElement> catchAlls[0];
    }
    if (this._showTabs) {
      // Create tabs.
      let tabElementCount = tabbar.querySelectorAll("." + CLASS_TAB).length;
      while (tabElementCount < tabCount) {
        // The tab part.
        const tabLi = this.ownerDocument.createElement('li');
        tabLi.classList.add(CLASS_TAB);

        const contentElement = this.ownerDocument.createElement('slot');
        contentElement.setAttribute('name', 'tab_' + tabElementCount);
        
        tabLi.appendChild(contentElement);
        tabLi.addEventListener('click', this._tabClickHandler.bind(this, tabLi, tabElementCount));
        tabbar.insertBefore(tabLi, catchAllLi);

        tabElementCount = tabbar.querySelectorAll("." + CLASS_TAB).length;
      }

      // Delete any excess tab tags.
      const tabElements = DomUtils.toArray(tabbar.querySelectorAll("." + CLASS_TAB));
      if (tabElements.length > tabCount) {
        tabElements.slice(tabCount).forEach( el => tabbar.removeChild(el));
      }
    } else {
      // Delete all tab tags. We don't need to show them.
      const tabElements = DomUtils.toArray(tabbar.querySelectorAll("." + CLASS_TAB));
      tabElements.forEach( el => tabbar.removeChild(el));
    }

    // Create content holders
    let contentWrapperElementCount = contentsStack.children.length;
    while (contentWrapperElementCount < tabCount) {
      // Pages for the contents stack.
      const wrapperDiv = this.ownerDocument.createElement('div');
      wrapperDiv.classList.add('wrapper');
      const contentElement = this.ownerDocument.createElement('slot');
      contentElement.setAttribute('name', 'content_' + contentWrapperElementCount);
            
      wrapperDiv.appendChild(contentElement);
      contentsStack.appendChild(wrapperDiv);

      contentWrapperElementCount++;
    }
        
    while (contentsStack.children.length > tabCount) {
      contentsStack.removeChild(contentsStack.children[contentsStack.children.length-1]);
    }

    // Try to find the previously active tab and take note of its index.
    let selectTab = -1;
    const tabElements = DomUtils.toArray(tabbar.querySelectorAll("." + CLASS_TAB));
    for (let i=0; i<tabElements.length; i++) {
      if (tabElements[i].classList.contains(CLASS_ACTIVE)) {
        selectTab = i;
        break;
      }
    }
    
    if (tabCount > 0) {
      selectTab = selectTab === -1 ? 0 : selectTab;
      
      this.setSelectedIndex(selectTab);
      this._showTab(selectTab);
    }
  }
  
  private _tabClickHandler(tabElement: HTMLElement, index: number) {
    // This handler may fire when a tab is removed during the click event bubble procedure. This check
    // supresses the event if the tab has been removed already.
    if (tabElement.parentNode !== null) {
      this.setSelectedIndex(index);
      DomUtils.doLater(this._sendSwitchEvent.bind(this));
    }
  }

  //-----------------------------------------------------------------------
  //
  //   ######                                
  //   #     # #    # #####  #      #  ####  
  //   #     # #    # #    # #      # #    # 
  //   ######  #    # #####  #      # #      
  //   #       #    # #    # #      # #      
  //   #       #    # #    # #      # #    # 
  //   #        ####  #####  ###### #  ####  
  //
  //-----------------------------------------------------------------------

  setSelectedIndex(index: number) {
    if (this._getContentsStack().children.length === 0) {
      return;
    }

    if (index < 0 || this._getContentsStack().children.length <= index) {
      this._log.warn("Out of range index given to the 'currentIndex' property.");
      return;
    }
    
    if (this._getContentsStack().getCurrentIndex() === index) {
      return;
    }
    this._getContentsStack().setCurrentIndex(index);
    this._showTab(index);
  }
  
  getSelectedIndex(): number {
    return this._getContentsStack().getCurrentIndex();
  }
  
  private _getTabs(): Tab[] {
    return <Tab[]> DomUtils.toArray<Element>(this.children).filter( element => element.nodeName === Tab.TAG_NAME );
  }

  setSelectedTab(selectTab: Tab): void {
    const index = _.findIndex(this._getTabs(), tab => tab === selectTab );
    if (index === -1) {
      return;
    }
    this.setSelectedIndex(index);
  }
  
  getSelectedTab(): Tab {
    const currentIndex = this.getSelectedIndex();
    if (currentIndex === -1) {
      return null;
    }
    const currentTab = this._getTabs()[currentIndex];
    return currentTab;
  }
  
  setShowFrame(value: boolean): void {
    this.setAttribute(ATTR_SHOW_FRAME, "" + value);
  }
  
  getShowFrame(): boolean {
    if (this.hasAttribute(ATTR_SHOW_FRAME)) {
      return Util.toBoolean(this.getAttribute(ATTR_SHOW_FRAME));
    } else {
      return true;
    }
  }
  
  setShowTabs(show: boolean): void {
    if (show !== this._showTabs) {
      this._showTabs = show;
      this.update();
    }
  }

  getShowTabs(): boolean {
    return this._showTabs;
  }

  //-----------------------------------------------------------------------
  private _showFrame(value: boolean): void {
    if (value) {
      this._getTop().classList.add('show_frame');
    } else {
      this._getTop().classList.remove('show_frame');          
    }
  }
  
  private _showTab(index: number): void {
    if (this._showTabs) {
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
  }
  
  private _sendSwitchEvent(): void {
    const event = new CustomEvent(TabWidget.EVENT_TAB_SWITCH, { detail: null, bubbles: true });
    this.dispatchEvent(event);
  }

  //-----------------------------------------------------------------------
  //
  //  ######                            ##       ######                       
  //  #     # #####    ##    ####      #  #      #     # #####   ####  #####  
  //  #     # #    #  #  #  #    #      ##       #     # #    # #    # #    # 
  //  #     # #    # #    # #          ###       #     # #    # #    # #    # 
  //  #     # #####  ###### #  ###    #   # #    #     # #####  #    # #####  
  //  #     # #   #  #    # #    #    #    #     #     # #   #  #    # #      
  //  ######  #    # #    #  ####      ###  #    ######  #    #  ####  #      
  //                                                                         
  //-----------------------------------------------------------------------
  private _setupDragAndDrop(): void {
    const tabBar = this._getTabbar();
    tabBar.addEventListener("dragstart", this._handleDragStart.bind(this));
    tabBar.addEventListener("dragover", this._handleDragOver.bind(this));
    tabBar.addEventListener("dragenter", this._handleDragEnter.bind(this));
    tabBar.addEventListener("dragexit", this._hideDragIndicator.bind(this));
    tabBar.addEventListener("dragleave", this._hideDragIndicator.bind(this));
    tabBar.addEventListener("dragend", this._hideDragIndicator.bind(this));
    tabBar.addEventListener("drop", this._handleDrop.bind(this));
  }

  private _handleDragStart(ev: DragEvent): void {
    ev.stopPropagation();

    // Only let the 'tab' elements be dragged and not our LIs.
    const target = <HTMLElement>ev.target;
    const parentElement = target.parentElement;
    if (target.getAttribute("draggable") === null || ! (parentElement instanceof Tab)) {
      ev.preventDefault();
      return;
    }

    ev.dataTransfer.setData(MIMETYPE_ELEMENT, parentElement.id);
  }

  private _handleDragEnter(ev: DragEvent): void {
    ev.preventDefault();
  }

  private  _handleDragOver(ev: DragEvent): void {
    const pointerTabIndex = this._pointToTabIndex(ev);

    // Position the drop indicator.
    const dragIndicatorContainer = DomUtils.getShadowId(this, ID_DRAG_INDICATOR_CONTAINER);
    let indicatorX = 0;

    const tabBar = this._getTabbar();
    const childElements = DomUtils.toArray(tabBar.children).filter(kid => kid.classList.contains(CLASS_TAB));
    const rect = this.getBoundingClientRect();
    if (pointerTabIndex === 0) {
      // Left end of the tab bar.
      const kid = childElements[pointerTabIndex];
      const kidRect = kid.getBoundingClientRect();
      indicatorX = Math.floor((kidRect.left + rect.left ) / 2);

    } else if (pointerTabIndex < childElements.length) {
      // Somewhere in the middle.
      const kidLeft = childElements[pointerTabIndex-1];
      const kidRight = childElements[pointerTabIndex];

      const rectLeft = kidLeft.getBoundingClientRect();
      const rectRight = kidRight.getBoundingClientRect();
      indicatorX = Math.floor((rectLeft.right + rectRight.left) / 2);

    } else {
      // Right of the tab bar.
      const kid = childElements[childElements.length-1];
      const kidRect = kid.getBoundingClientRect();
      indicatorX = Math.floor((kidRect.right + rect.right) /2);
    }

    indicatorX -= rect.left;
    dragIndicatorContainer.style.left = "" + indicatorX + "px";
    dragIndicatorContainer.classList.add(CLASS_INDICATOR_SHOW);
    dragIndicatorContainer.classList.remove(CLASS_INDICATOR_HIDE);

    ev.preventDefault();
    ev.stopPropagation();
  }

  private _pointToTabIndex(ev: DragEvent): number {
    // Figure out which tabs the drop indicator should appear in between.
    const rect = this.getBoundingClientRect();
    const pointXInPageCoords = ev.pageX - rect.left;

    const tabBar = this._getTabbar();
    let index = 0;
    const childElements = DomUtils.toArray(tabBar.children).filter(kid => kid.classList.contains(CLASS_TAB));
    for (const kid of childElements) {
      const rect = kid.getBoundingClientRect();
      if (pointXInPageCoords <= rect.left + rect.width/2) {
        break;
      }
      index++;
    }
    return index;
  }

  private _handleDrop(ev: DragEvent): void {
    this._hideDragIndicator();

    const data = ev.dataTransfer.getData(MIMETYPE_ELEMENT);
    if (data != null && data !== "") {
      if (this.id == null || this.id === "") {
        this._log.warn("A drop occurred on a TabWidget with no ID set.");
        return;
      }
      const pointerTabIndex = this._pointToTabIndex(ev);

      const detail: TabDroppedEventDetail = {
        targetTabWidget: this,
        tabIndex: pointerTabIndex,
        tabId: data
      };
      const tabDropEvent = new CustomEvent(TabWidget.EVENT_TAB_DROPPED, { bubbles: true, detail: detail });
      this.dispatchEvent(tabDropEvent);
    }
  }

  private _hideDragIndicator(): void {
    const dragIndicatorContainer = DomUtils.getShadowId(this, ID_DRAG_INDICATOR_CONTAINER);
    dragIndicatorContainer.classList.remove(CLASS_INDICATOR_SHOW);
    dragIndicatorContainer.classList.add(CLASS_INDICATOR_HIDE);
  }
}
