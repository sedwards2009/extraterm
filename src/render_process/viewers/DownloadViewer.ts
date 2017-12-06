/**
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 */

import {WebComponent} from 'extraterm-web-component-decorators';
import Vue from 'vue';
import Component from 'vue-class-component';

import {BulkFileHandle} from '../bulk_file_handling/BulkFileHandle';
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

@Component(
{
  template: `<span>Download viewer</span>`
})
class DownloadUI extends Vue {

}

@WebComponent({tag: "et-download-viewer"})
export class DownloadViewer extends ViewerElement {

  static TAG_NAME = "et-download-viewer";

  private _log: Logger;
  private _bulkFileHandle: BulkFileHandle;
  private _ui: DownloadUI = null;

  constructor() {
    super();
    this._log = getLogger("et-download-viewer", this);
    this._setupDOM();

    this._ui = new DownloadUI();
    const component = this._ui.$mount();
    this.getContainerNode().appendChild(component.$el);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS];
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["application/octet-stream"].indexOf(mimeType) !== -1;
  }

  getTitle(): string {
    return "Download";
  }
  
  getAwesomeIcon(): string {
    return "download";
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): void {
    // this._loadBulkFile(handle);
  }

  //-------------------------------------------------------------------------------------
  private _rootElementHeight = -1;

  connectedCallback(): void {
    super.connectedCallback();
    DomUtils.doLater(() => {
      this._updateRootElementHeight();
      VirtualScrollAreaEmitResizeEvent(this);
    });
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

  setThemeCssMap(cssMap: Map<ThemeTypes.CssFile, string>): void {
    super.setThemeCssMap(cssMap);
    DomUtils.doLater(() => {
      this._updateRootElementHeight();
      VirtualScrollAreaEmitResizeEvent(this);
    });
  }

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
      this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
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
      this._log.debug("getVirtualHeight: ", this._rootElementHeight);
    }
    return this._rootElementHeight;
  }
  
  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }

  // FIXME supply and implementation which twiddles a class on the container.
  // setVisualState(newVisualState: VisualState): void {
  // getVisualState(): VisualState {
}
