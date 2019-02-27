/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { ResizeNotifier } from 'extraterm-resize-notifier';

import * as ThemeTypes from '../../theme/Theme';
import {ThemeableElementBase} from '../ThemeableElementBase';
import {ViewerElement} from '../viewers/ViewerElement';
import { SetterState, emitResizeEvent } from '../VirtualScrollArea';

const DEBUG_SIZE = false;

/**
 * A simple base class for Viewers which don't need to support virtual
 * scrolling and just want to display a normal DOM tree.
 */
export class SimpleViewerElement extends ViewerElement {

  private _simpleViewerElementLog: Logger;
  private static _resizeNotifier = new ResizeNotifier();
  private _containerHeight = -1;
  private _styleElement: HTMLStyleElement = null;
  private _containerElement: HTMLDivElement = null;

  constructor() {
    super();
    this._simpleViewerElementLog = getLogger("SimpleViewerElement", this);
    this._setupDOM();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._handleResize();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI];
  }

  private _setupDOM(): void {
    this.attachShadow({ mode: 'open', delegatesFocus: false });

    this._styleElement = document.createElement("style");
    this._styleElement.id = ThemeableElementBase.ID_THEME;
    this.shadowRoot.appendChild(this._styleElement);

    this._containerElement = document.createElement("div");
    SimpleViewerElement._resizeNotifier.observe(this._containerElement,
      (target: Element, contentRect: DOMRectReadOnly) => {
        this._handleResize();
      });
    this.shadowRoot.appendChild(this._containerElement);

    this.updateThemeCss();
  }

  private _handleResize(): void {
    if ( ! this.isConnected) {
      return;
    }  
    const rect = this._containerElement.getBoundingClientRect();
    this._containerHeight = rect.height;
    emitResizeEvent(this);
  }

  /**
   * Get the node where the element's DOM nodes should be placed.
   */
  getContainerNode(): HTMLDivElement {
    return this._containerElement;
  }

  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
  }

  // VirtualScrollable
  getMinHeight(): number {
    return this._containerHeight;
  }

  // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._simpleViewerElementLog.debug("getVirtualHeight: ", this._containerHeight);
    }
    return this._containerHeight;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._simpleViewerElementLog.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }
}
