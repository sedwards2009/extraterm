/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import Vue from 'vue';
import Component from 'vue-class-component';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
import { doLater } from '../../utils/DoLater';
import * as DomUtils from '../DomUtils';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import * as ViewerElementTypes from '../viewers/ViewerElementTypes';
import {emitResizeEvent as VirtualScrollAreaEmitResizeEvent, SetterState, VirtualScrollable} from '../VirtualScrollArea';


const DEBUG_SIZE = false;

export const ID_CONTAINER = "ID_CONTAINER";

/**
 * A simple base class for Viewers which don't need to support virtual
 * scrolling and just want to display a normal DOM tree.
 */
export class SimpleViewerElement extends ViewerElement {

  private _simpleViewerElementLog: Logger;

  constructor() {
    super();
    this._simpleViewerElementLog = getLogger("et-download-viewer", this);
    this._setupDOM();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS];
  }

  private _rootElementHeight = -1;

  connectedCallback(): void {
    super.connectedCallback();
    if (this._updateRootElementHeight()) {
      doLater(() => {
        VirtualScrollAreaEmitResizeEvent(this);
      });
    }
  }

  private _styleElement: HTMLStyleElement = null;
  private _containerDivElement: HTMLDivElement = null;

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    this._styleElement = document.createElement("style");
    this._styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(this._styleElement);

    this._containerDivElement = document.createElement("div");
    this._containerDivElement.id = ID_CONTAINER;
    this.shadowRoot.appendChild(this._containerDivElement);

    this.updateThemeCss();
  }

  setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>, themeTimeStamp: number): void {
    super.setThemeCssMap(cssMap, themeTimeStamp);
    doLater(() => {
      this._updateRootElementHeight();
      VirtualScrollAreaEmitResizeEvent(this);
    });
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerNode(): HTMLDivElement {
    return this._containerDivElement;
  }

  private _updateRootElementHeight(): boolean {
    const rect = this._containerDivElement.getBoundingClientRect();
    if (this._rootElementHeight !== rect.height) {
      this._rootElementHeight = rect.height;
      return true;
    } else {
      return false;
    }
  }

  refresh(level: ResizeRefreshElementBase.RefreshLevel): void {
    if (this._containerDivElement == null) {
      return;
    }

    if (this._updateRootElementHeight() && this.parentNode !== null) {
      this.style.height = "" + this._rootElementHeight + "px";
      VirtualScrollAreaEmitResizeEvent(this);
    }
  }

  // VirtualScrollable
  getHeight(): number {
    return this._rootElementHeight;
  }
  
  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (DEBUG_SIZE) {
      this._simpleViewerElementLog.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
        setterState.yOffset, setterState.yOffsetChanged);
    }
    
    this.style.height = "" + setterState.height + "px";
  }

  // VirtualScrollable
  getMinHeight(): number {
    return this._rootElementHeight;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._simpleViewerElementLog.debug("getVirtualHeight: ", this._rootElementHeight);
    }
    return this._rootElementHeight;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._simpleViewerElementLog.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }

  // FIXME supply and implementation which twiddles a class on the container.
  // setVisualState(newVisualState: VisualState): void {
  // getVisualState(): VisualState {
}
