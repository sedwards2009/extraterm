/*
 * Copyright 2019-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import { html, render, TemplateResult } from "extraterm-lit-html";
import { Attribute, Observe, CustomElement, Filter } from "extraterm-web-component-decorators";
import { classMap } from "extraterm-lit-html/directives/class-map.js";

import { doLater } from "extraterm-later";
import * as DomUtils from "../DomUtils";
import { log } from "extraterm-logging";
import { Logger, getLogger } from "extraterm-logging";
import { ResizeNotifier } from "extraterm-resize-notifier";

import * as ThemeTypes from "../../theme/Theme";
import { StackedWidget } from "./StackedWidget";
import { Tab } from "./Tab";
import { SnapDropContainer } from "./SnapDropContainer";
import { EVENT_DRAG_STARTED, EVENT_DRAG_ENDED } from "../GeneralEvents";
import { ElementMimeType, FrameMimeType } from "../InternalMimeTypes";
import { ThemeableElementBase } from "../ThemeableElementBase";

const ATTR_TAG_REST_LEFT = "rest-left";
const ATTR_TAG_REST_RIGHT = "rest";

const ID_TABBAR = "ID_TABBAR";
const ID_SNAP_DROP_CONTAINER = "ID_SNAP_DROP_CONTAINER";

const CLASS_TAB = "tab";
const CLASS_SHOW_BUTTONS = "show-buttons";
const CLASS_HIDE_BUTTONS = "hide-buttons";

const SCROLL_STEP = 40;
const MOUSEWHEEL_SCALE = 1;


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
@CustomElement("et-tab-widget")
export class TabWidget extends ThemeableElementBase {

  static TAG_NAME = "ET-TAB-WIDGET";
  static EVENT_SWITCH = "et-tab-widget_switch";
  static EVENT_DROPPED = "et-tab-widget_dropped";

  private _log: Logger;
  private _mutationObserver: MutationObserver = null;
  private static _resizeNotifier = new ResizeNotifier();
  private _showButtonsFlag = false;
  private _selectedIndex = -1;
  private _tabCount = 0;
  private _dropPointerIndex = -1;
  private _childNodes: Element[] = [];

  constructor() {
    super();

    this._log = getLogger(TabWidget.TAG_NAME, this);
    this._handleDragStart = this._handleDragStart.bind(this);
    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragEnter = this._handleDragEnter.bind(this);
    this._removeDropIndicator = this._removeDropIndicator.bind(this);
    this._removeDropIndicator = this._removeDropIndicator.bind(this);
    this._handleDragEnd = this._handleDragEnd.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
    this._handleButtonLeftClick = this._handleButtonLeftClick.bind(this);
    this._handleButtonRightClick = this._handleButtonRightClick.bind(this);
    this._handleTabbarMouseWheel = this._handleTabbarMouseWheel.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });
    this._render();
    this._applySlotAttributes();

    this._mutationObserver = new MutationObserver(this._syncDom.bind(this));
    this._mutationObserver.observe(this, { childList: true });

    TabWidget._resizeNotifier.observe(this._getTabbar(), this._handleTabbarResize.bind(this));

    this._setupDragAndDrop();
  }

  update(): void {
    this._syncDom();
  }

  private _syncDom(): void {
    const domChildren = this.children;
    if (this._isEqualElementLists(domChildren, this._childNodes)) {
      return;
    }

    this._childNodes = Array.from(domChildren);
    this._tabCount = this._childNodes.filter(n => n.nodeName === Tab.TAG_NAME).length;
    if (this.selectedIndex >= this._tabCount) {
      this.selectedIndex = this._tabCount - 1;
    }

    this._render();
    this._applySlotAttributes();
  }

  private _isEqualElementLists(htmlCollection: HTMLCollection, elementList: Element[]): boolean {
    if (htmlCollection.length !== elementList.length) {
      return false;
    }
    for (let i=0; i<elementList.length; i++) {
      if (htmlCollection.item(i) !== elementList[i]) {
        return false;
      }
    }
    return true;
  }

  private _handleButtonLeftClick(): void {
    this._scrollTabbar(-SCROLL_STEP);
  }

  private _handleButtonRightClick(): void {
    this._scrollTabbar(SCROLL_STEP);
  }

  private _scrollTabbar(delta: number): void {
    const tabbar = this._getTabbar();
    tabbar.scrollBy({
      left: delta,
    });
  }

  private _handleTabbarMouseWheel(ev: WheelEvent): void {
    ev.stopPropagation();
    ev.preventDefault();

    this._scrollTabbar(Math.round(ev.deltaY * MOUSEWHEEL_SCALE));
  }

  private _handleTabbarResize(target: Element, contentRect: DOMRectReadOnly): void {
    this._setShowButtons(target.scrollWidth > target.clientWidth);
  }

  private _setShowButtons(show: boolean): void {
    if (this._showButtonsFlag === show) {
      return;
    }
    this._showButtonsFlag = show;
    this._render();
  }

  @Attribute showTabs = true;

  @Observe("showTabs")
  private _observeShowTabs(target: string): void {
    this._syncDom();
  }

  @Attribute windowId = "";
  @Observe("windowId")
  private _observeWindowId(target: string): void {
    const snapDropContainer = <SnapDropContainer> DomUtils.getShadowId(this, ID_SNAP_DROP_CONTAINER);
    if (snapDropContainer == null) {
      return;
    }
    snapDropContainer.windowId = this.windowId;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.GUI_TABWIDGET, ThemeTypes.CssFile.TABS];
  }

  protected _render(): void {
    const handleTabbarMouseWheel = {
      handleEvent: this._handleTabbarMouseWheel,
      capture: true
    };

    const tabs: TemplateResult[] = [];
    if (this.showTabs) {
      for (let i=0; i<this._tabCount; i++) {
        if (i === this._dropPointerIndex) {
          tabs.push(html`<div id='ID_DROP_INDICATOR'></div>`);
        }

        const classes = {
            tab: true,
            active: i === this.selectedIndex,
        };
        tabs.push(html`<li
          class=${classMap(classes)}
          @click=${this._tabClickHandler.bind(this, i)}><slot name=${"tab_" + i}></slot></li>`);
      }

      if (this._dropPointerIndex >= this._tabCount) {
        tabs.push(html`<div id='ID_DROP_INDICATOR'></div>`);
      }
    }

    const tabContents: TemplateResult[] = [];
    for (let i=0; i<this._tabCount; i++) {
      tabContents.push(html`<div class='wrapper'><slot name=${'content_' + i}></slot></div>`);
    }

    const template = html`${this._styleTag()}
      <div id='ID_TOP' class=${classMap({show_frame: this.showFrame})}>
        <div id='ID_TABBAR_CONTAINER'>
          <div class='remainder-left'><slot name='${ATTR_TAG_REST_LEFT}'></slot></div>
          <ul
            id='${ID_TABBAR}'
            class="extraterm-tabs"
            @wheel=${handleTabbarMouseWheel}
            @dragstart=${this._handleDragStart}
            @dragover=${this._handleDragOver}
            @dragenter=${this._handleDragEnter}
            @dragexit=${this._removeDropIndicator}
            @dragleave=${this._removeDropIndicator}
            @dragend=${this._handleDragEnd}
            @drop=${this._handleDrop}
          >${tabs}</ul>
          <div id='ID_BUTTON_CONTAINER' class='${this._showButtonsFlag ? CLASS_SHOW_BUTTONS : CLASS_HIDE_BUTTONS}'>
            <button class='microtool quiet primary' @click=${this._handleButtonLeftClick}>
              <i class="fas fa-caret-left"></i>
            </button>
            <button class='microtool quiet primary' @click=${this._handleButtonRightClick}>
              <i class="fas fa-caret-right"></i>
            </button>
          </div>
          <div class='remainder'><slot name='${ATTR_TAG_REST_RIGHT}'></slot></div>
        </div>
        <div id='ID_CONTENTS'>
          <et-snap-drop-container id=${ID_SNAP_DROP_CONTAINER} windowId='${this.windowId}'>
            <et-stacked-widget id='ID_CONTENTSTACK' current-index=${this.selectedIndex}>${tabContents}</et-stacked-widget>
          </et-snap-drop-container>
        </div>
      </div>
      `;
    render(template, this.shadowRoot);
  }

  private _getTabbar(): HTMLDivElement {
    return <HTMLDivElement> DomUtils.getShadowId(this, ID_TABBAR);
  }

  private _applySlotAttributes(): number {
    let tabCount = 0;
    let stateInTab = false;

    // Tag the source content as tabs or content so that we can distribute it over our shadow DOM.
    let restAttr = ATTR_TAG_REST_LEFT;
    for (let i=0; i<this.children.length; i++) {
      const kid = <HTMLElement>this.children.item(i);
      if (kid.nodeName === Tab.TAG_NAME) {
        kid.slot = 'tab_' + tabCount;
        tabCount++;
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
    return tabCount;
  }

  private _tabClickHandler(index: number, ev: Event): void {
    // This handler may fire when a tab is removed during the click event bubble procedure. This check
    // supresses the event if the tab has been removed already.
    if ((<HTMLElement>ev.currentTarget).parentNode !== null) {
      this.selectedIndex = index;
      doLater(this._sendSwitchEvent.bind(this));
    }
  }

  @Attribute selectedIndex = 0;

  @Filter("selectedIndex")
  private _sanitizeSelectedIndex(index: number): number {
    this._syncDom();

    if (this._tabCount === 0) {
      return -1;
    }

    if (index < 0 || this._tabCount <= index) {
      this._log.warn("Out of range index given to the 'currentIndex' property.");
      return undefined;
    }

    return index;
  }

  @Observe("selectedIndex")
  private _observeSelectedIndex(target: string): void {
    if (this._selectedIndex === this.selectedIndex) {
      return;
    }

    this._selectedIndex = this.selectedIndex;
    this._render();
    this._scrollTabIntoView(this.selectedIndex);
  }

  private _getTabs(): Tab[] {
    return <Tab[]> DomUtils.toArray<Element>(this.children).filter( element => element.nodeName === Tab.TAG_NAME );
  }

  setSelectedTab(selectTab: Tab): void {
    this._syncDom();

    const index = _.findIndex(this._getTabs(), tab => tab === selectTab );
    if (index === -1) {
      return;
    }
    this.selectedIndex = index;
  }

  getSelectedTab(): Tab {
    if (this.selectedIndex === -1) {
      return null;
    }
    const currentTab = this._getTabs()[this.selectedIndex];
    return currentTab;
  }

  @Attribute showFrame = true;

  @Observe("showFrame")
  private _observeShowFrame(target: string): void {
    this._syncDom();
    this._render();
  }

  private _scrollTabIntoView(index: number): void {
    if ( ! this.showTabs) {
      return;
    }

    const tabbar = this._getTabbar();
    const item = <HTMLElement> tabbar.children.item(index);
    if (item == null) {
      this._log.warn(`_scrollTabIntoView(${index}) couldn't find the item.`);
      return;
    }
    item.scrollIntoView({
      inline: "nearest"
    });
  }

  private _sendSwitchEvent(): void {
    const event = new CustomEvent(TabWidget.EVENT_SWITCH, { detail: null, bubbles: true });
    this.dispatchEvent(event);
  }

  private _setupDragAndDrop(): void {
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

    const mimeTypeParams = this.windowId != null && this.windowId !== "" ? `;windowid=${this.windowId}` : "";
    ev.dataTransfer.setData(ElementMimeType.MIMETYPE + mimeTypeParams, ElementMimeType.elementToData(parentElement));
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

    this._dropPointerIndex = pointerTabIndex;
    this._render();

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
    const supportedMimeTypes: {
      MIMETYPE: string;
      dataTransferGetData(dataTransfer: DataTransfer, windowId: string): string;
    }[] = [
      ElementMimeType, FrameMimeType
    ];

    for (const mimeType of supportedMimeTypes) {
      const data = mimeType.dataTransferGetData(ev.dataTransfer, this.windowId);
      if (data != null && data !== "") {
        return {mimeType: mimeType.MIMETYPE, data};
      }
    }
    return {mimeType: null, data: null};
  }

  private _removeDropIndicator(): void {
    this._dropPointerIndex = -1;
    this._render();
  }

  private _handleDragEnd(ev: DragEvent): void {
    this._removeDropIndicator();

    const dragEndedEvent = new CustomEvent(EVENT_DRAG_ENDED, { bubbles: true });
    this.dispatchEvent(dragEndedEvent);
  }
}
