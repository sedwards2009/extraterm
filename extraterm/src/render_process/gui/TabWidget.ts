/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import {Attribute, Observe, WebComponent} from 'extraterm-web-component-decorators';

import {doLater} from 'extraterm-later';
import * as DomUtils from '../DomUtils';
import { log } from "extraterm-logging";
import {Logger, getLogger} from "extraterm-logging";
import * as ThemeTypes from '../../theme/Theme';
import {StackedWidget} from './StackedWidget';
import {Tab} from './Tab';
import {SnapDropContainer, DroppedEventDetail as SnapDroppedEventDetail} from './SnapDropContainer';
import {EVENT_DRAG_STARTED, EVENT_DRAG_ENDED} from '../GeneralEvents';
import {ElementMimeType, FrameMimeType} from '../InternalMimeTypes';
import { TemplatedElementBase } from './TemplatedElementBase';
import { trimBetweenTags } from 'extraterm-trim-between-tags';

const ATTR_TAG_REST_LEFT = "rest-left";
const ATTR_TAG_REST_RIGHT = "rest";

const ID_TOP = "ID_TOP";
const ID_TABBAR = "ID_TABBAR";
const ID_TABBAR_CONTAINER = "ID_TABBAR_CONTAINER";
const ID_CONTENTSTACK = "ID_CONTENTSTACK";
const ID_SNAP_DROP_CONTAINER = "ID_SNAP_DROP_CONTAINER";
const ID_CONTENTS = "ID_CONTENTS";
const ID_DROP_INDICATOR = "ID_DROP_INDICATOR";

const CLASS_REMAINDER_LEFT = "remainder-left";
const CLASS_REMAINDER_RIGHT = "remainder";
const CLASS_ACTIVE = "active";
const CLASS_TAB = "tab";


export interface DroppedEventDetail {
  targetTabWidget: TabWidget;
  tabIndex: number;
  mimeType: string;
  dropData: string;
}

/**
 * A widget to display a stack of tabs.
 *
 * See Tab.
 */
@WebComponent({tag: "et-tabwidget"})
export class TabWidget extends TemplatedElementBase {
  
  static TAG_NAME = "ET-TABWIDGET";
  static EVENT_TAB_SWITCH = "tab-switch";
  static EVENT_DROPPED = "tabwidget-dropped";

  private _log: Logger;
  private _mutationObserver: MutationObserver = null;

  constructor() {
    super({ delegatesFocus: false });

    this._log = getLogger(TabWidget.TAG_NAME, this);
    
    this.createTabHolders();
    this.setSelectedIndex(0);
    this._showFrame(this.showFrame);
    
    this._mutationObserver = new MutationObserver( (mutations) => {
      this.createTabHolders();
    });
    this._mutationObserver.observe(this, { childList: true });

    this._setupDragAndDrop();
  }

  @Attribute({default: true}) showTabs: boolean;

  @Observe("showTabs")
  private _observeShowTabs(target: string): void {
    this.update();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.GUI_TABWIDGET, ThemeTypes.CssFile.TABS];
  }
  
  update(): void {
    this.createTabHolders();
  }  
  
  protected _html(): string {
    return trimBetweenTags(`
      <div id='${ID_TOP}'>
        <div id='${ID_TABBAR_CONTAINER}'>
          <ul id='${ID_TABBAR}' class="extraterm-tabs"></ul>
        </div>
        <div id='${ID_CONTENTS}'>
          <${SnapDropContainer.TAG_NAME} id='${ID_SNAP_DROP_CONTAINER}'>
            <${StackedWidget.TAG_NAME} id='${ID_CONTENTSTACK}'></$ {StackedWidget.TAG_NAME}>
          </${SnapDropContainer.TAG_NAME}>
        </div>
      </div>
      `);
  }

  private _getTop(): HTMLDivElement {
    return <HTMLDivElement> this._elementById(ID_TOP);
  }
  
  private _getTabbar(): HTMLDivElement {
    return <HTMLDivElement> this._elementById(ID_TABBAR);
  }
  
  private _getContentsStack(): StackedWidget {
    return <StackedWidget> this._elementById(ID_CONTENTSTACK);
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
    if (this.showTabs) {
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
      doLater(this._sendSwitchEvent.bind(this));
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
    
    if (this._getContentsStack().currentIndex === index) {
      return;
    }
    this._getContentsStack().currentIndex = index;
    this._showTab(index);
  }
  
  getSelectedIndex(): number {
    return this._getContentsStack().currentIndex;
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
  
  @Attribute({default: true}) showFrame: boolean;

  private _observeShowFrame(target: string): void {
    this._showFrame(this.showFrame);
  }

  private _showFrame(value: boolean): void {
    if (value) {
      this._getTop().classList.add('show_frame');
    } else {
      this._getTop().classList.remove('show_frame');          
    }
  }
  
  private _showTab(index: number): void {
    if (this.showTabs) {
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
    tabBar.addEventListener("dragexit", this._removeDropIndicator.bind(this));
    tabBar.addEventListener("dragleave", this._removeDropIndicator.bind(this));
    tabBar.addEventListener("dragend", this._handleDragEnd.bind(this));
    tabBar.addEventListener("drop", this._handleDrop.bind(this));

    const snapDropContainer = DomUtils.getShadowId(this, ID_SNAP_DROP_CONTAINER);
    DomUtils.addCustomEventResender(snapDropContainer, SnapDropContainer.EVENT_DROPPED, this);
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

    ev.dataTransfer.setData(ElementMimeType.MIMETYPE, ElementMimeType.elementToData(parentElement));
    ev.dataTransfer.setDragImage(parentElement, -10, -10);
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.dropEffect = 'move';

    const dragStartedEvent = new CustomEvent(EVENT_DRAG_STARTED, { bubbles: true });
    this.dispatchEvent(dragStartedEvent);
  }

  private _handleDragEnter(ev: DragEvent): void {
    ev.preventDefault();
  }

  private _handleDragOver(ev: DragEvent): void {
    const pointerTabIndex = this._pointToTabIndex(ev);
    this._showDropIndicator(pointerTabIndex);

    ev.preventDefault();
    ev.stopPropagation();
  }

  private _pointToTabIndex(ev: DragEvent): number {
    // Figure out which tabs the drop indicator should appear in between.
    const widgetRect = this.getBoundingClientRect();
    const pointXInPageCoords = ev.pageX - widgetRect.left;
    const tabBar = this._getTabbar();
    const childElements = DomUtils.toArray(tabBar.children).filter(kid => kid.classList.contains(CLASS_TAB));

    let index = 0;
    for (const kid of childElements) {
      const kidRect = kid.getBoundingClientRect();
      const midPoint = kidRect.left - widgetRect.left + kidRect.width/2;
      if (pointXInPageCoords <= midPoint) {
        break;
      }
      index++;
    }
    return index;
  }

  private _showDropIndicator(pointerTabIndex: number): void {
    let dropIndicator = DomUtils.getShadowId(this, ID_DROP_INDICATOR);
    if (dropIndicator == null) {
      dropIndicator = document.createElement("li");
      dropIndicator.id = ID_DROP_INDICATOR;
    }

    const tabBar = this._getTabbar();
    const tabElements = DomUtils.toArray(tabBar.children).filter(kid => kid.classList.contains(CLASS_TAB));

    if (tabElements.length === 0) {
      if (tabBar.firstElementChild != null) {
        const position = tabBar.firstElementChild.classList.contains(CLASS_REMAINDER_LEFT) ? 'afterend' : 'beforebegin';
        tabBar.firstElementChild.insertAdjacentElement(position, dropIndicator);
      } else {
        tabBar.appendChild(dropIndicator);
      }
    } else {
      if (pointerTabIndex < tabElements.length) {
        tabElements[pointerTabIndex].insertAdjacentElement('beforebegin', dropIndicator);
      } else {
        tabElements[tabElements.length-1].insertAdjacentElement('afterend', dropIndicator);
      }
    }
  }

  private _handleDrop(ev: DragEvent): void {
    this._removeDropIndicator();

    const {mimeType, data} = this._getSupportedDropMimeTypeData(ev);
    if (mimeType != null) {
      if (this.id == null || this.id === "") {
        this._log.warn("A drop occurred on a TabWidget with no ID set.");
        return;
      }
      const pointerTabIndex = this._pointToTabIndex(ev);

      const dragEndedEvent = new CustomEvent(EVENT_DRAG_ENDED, { bubbles: true });
      this.dispatchEvent(dragEndedEvent);

      const detail: DroppedEventDetail = {
        targetTabWidget: this,
        tabIndex: pointerTabIndex,
        mimeType: mimeType,
        dropData: data
      };
      const tabDropEvent = new CustomEvent(TabWidget.EVENT_DROPPED, { bubbles: true, detail: detail });
      this.dispatchEvent(tabDropEvent);
    }
  }

  private _getSupportedDropMimeTypeData(ev: DragEvent): {mimeType: string; data: string;} {
    for (const mimeType of [ElementMimeType.MIMETYPE, FrameMimeType.MIMETYPE]) {
      const data = ev.dataTransfer.getData(mimeType);
      if (data != null && data !== "") {
        return {mimeType, data};
      }
    }
    return {mimeType: null, data: null};
  }

  private _removeDropIndicator(): void {
    const dropIndicator = DomUtils.getShadowId(this, ID_DROP_INDICATOR);
    if (dropIndicator != null) {
      dropIndicator.parentElement.removeChild(dropIndicator);
    }
  }

  private _handleDragEnd(ev: DragEvent): void {
    this._removeDropIndicator();

    const dragEndedEvent = new CustomEvent(EVENT_DRAG_ENDED, { bubbles: true });
    this.dispatchEvent(dragEndedEvent);
  }
}
