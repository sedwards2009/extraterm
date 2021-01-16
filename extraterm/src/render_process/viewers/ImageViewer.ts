/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

"use strict";
import { CustomElement } from 'extraterm-web-component-decorators';
import { BulkFileHandle, ViewerMetadata } from '@extraterm/extraterm-extension-api';
import { trimBetweenTags } from 'extraterm-trim-between-tags';
import { Logger, getLogger } from "extraterm-logging";
import { log } from "extraterm-logging";

import * as BulkFileUtils from '../bulk_file_handling/BulkFileUtils';
import {DebouncedDoLater} from 'extraterm-later';
import {ViewerElement} from './ViewerElement';
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import { VisualState, Mode, CursorMoveDetail } from './ViewerElementTypes';
import { emitResizeEvent, SetterState } from '../VirtualScrollArea';
import { newImmediateResolvePromise } from '../../utils/ImmediateResolvePromise';
import { ResizeNotifier } from 'extraterm-resize-notifier';

const ID = "EtImageViewerTemplate";
const ID_CONTAINER = "ID_CONTAINER";
const ID_CURSOR = "ID_CURSOR";
const ID_IMAGE = "ID_IMAGE";
const CLASS_FORCE_FOCUSED = "force-focused";
const CLASS_FORCE_UNFOCUSED = "force-unfocused";
const CLASS_FOCUS_AUTO = "focus-auto";

const DEBUG_SIZE = false;


@CustomElement("et-image-viewer")
export class ImageViewer extends ViewerElement {

  static TAG_NAME = "ET-IMAGE-VIEWER";
  private static _resizeNotifier = new ResizeNotifier();

  /**
   * Type guard for detecting a EtTerminalViewer instance.
   *
   * @param  node the node to test
   * @return      True if the node is a EtTerminalViewer.
   */
  static is(node: Node): node is ImageViewer {
    return node !== null && node !== undefined && node instanceof ImageViewer;
  }

  private _log: Logger;
  private _bulkFileHandle: BulkFileHandle = null;
  private _metadataEventDoLater: DebouncedDoLater = null;
  private _mimeType: string = null;
  private _imageWidth = -1;
  private _imageHeight = -1;
  private _cursorTop = 0;
  private _height = 0;
  private _mode: Mode = Mode.DEFAULT;
  private _visualState: VisualState = VisualState.UNFOCUSED;

  // The current element height. This is a cached value used to prevent touching the DOM.
  private _currentElementHeight = -1;

  constructor() {
    super();
    this._log = getLogger(ImageViewer.TAG_NAME, this);

    this._metadataEventDoLater = new DebouncedDoLater(() => {
      const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
      this.dispatchEvent(event);
    });
  }

  getMetadata(): ViewerMetadata {
    const metadata = super.getMetadata();

    if (this._bulkFileHandle !== null && this._bulkFileHandle.metadata["filename"] != null) {
      metadata.title = <string> this._bulkFileHandle.metadata["filename"];
    } else {
      metadata.title = "Image";
    }

    metadata.icon = "fa fa-file-image";
    return metadata;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (DomUtils.getShadowRoot(this) == null) {
      const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
      const clone = this.createClone();
      shadow.appendChild(clone);
      this.updateThemeCss();

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      this.style.height = "0px";

      containerDiv.addEventListener('focus', (ev) => {
        const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
        this._cursorTop = containerDiv.scrollTop;
      } );

      const imgElement = <HTMLImageElement> DomUtils.getShadowId(this, ID_IMAGE);
      imgElement.addEventListener('load', () => this._handleImageLoad());
      ImageViewer._resizeNotifier.observe(imgElement, (target: Element, contentRect: DOMRectReadOnly) => {
        this._handleResize();
      });

      this._applyVisualState(this._visualState);

      if (this._bulkFileHandle !== null) {
        this._setImageUrl(this._bulkFileHandle.url);
      }

      this._adjustHeight(this._height);
    }
    this._handleResize();
  }

  private _handleResize(): void {
    if ( ! this.isConnected) {
      return;
    }
    emitResizeEvent(this);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.IMAGE_VIEWER];
  }

  dispose(): void {
    if (this._bulkFileHandle !== null) {
      this._bulkFileHandle.deref();
      this._bulkFileHandle = null;
    }
    super.dispose();
  }

  getSelectionText(): string {
    return null;
  }

  focus(): void {
    if (DomUtils.getShadowRoot(this) === null) {
      return;
    }
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
    DomUtils.focusWithoutScroll(containerDiv);
  }

  hasFocus(): boolean {
    const hasFocus = this === DomUtils.getShadowRoot(this).activeElement; // FIXME
    return hasFocus;
  }

  setVisualState(newVisualState: VisualState): void {
    if (newVisualState !== this._visualState) {
      if (DomUtils.getShadowRoot(this) !== null) {
        this._applyVisualState(newVisualState);
      }
      this._visualState = newVisualState;
    }
  }

  getVisualState(): VisualState {
    return this._visualState;
  }

  setMimeType(mimeType: string): void {
    this._mimeType = mimeType;
  }

  getMimeType(): string {
    return this._mimeType;
  }

  getBulkFileHandle(): BulkFileHandle {
    return this._bulkFileHandle;
  }

  setBulkFileHandle(handle: BulkFileHandle): Promise<void> {
    const {mimeType, charset} = BulkFileUtils.guessMimetype(handle);
    this.setMimeType(mimeType);

    if (this._bulkFileHandle !== null) {
      this._bulkFileHandle.deref();
    }

    this._bulkFileHandle = handle;
    handle.ref();
    this._metadataEventDoLater.trigger();

    if (DomUtils.getShadowRoot(this) !== null) {
      this._setImageUrl(handle.url);
    }
    return newImmediateResolvePromise();
  }

  setMode(newMode: Mode): void {
    this._mode = newMode;
  }

  getMode(): Mode {
    return this._mode;
  }

  setEditable(editable: boolean): void {
  }

  getEditable(): boolean {
    return false;
  }

  // VirtualScrollable
  setDimensionsAndScroll(setterState: SetterState): void {
    if (setterState.heightChanged || setterState.yOffsetChanged) {
      if (DEBUG_SIZE) {
        this._log.debug("setDimensionsAndScroll(): ", setterState.height, setterState.heightChanged,
          setterState.yOffset, setterState.yOffsetChanged);
      }
      this._adjustHeight(setterState.height);

      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      if (containerDiv !== null) {
        containerDiv.scrollTop = setterState.yOffset;
      }
    }
  }

  // VirtualScrollable
  getMinHeight(): number {
    return 0;
  }

   // VirtualScrollable
  getVirtualHeight(containerHeight: number): number {
    // const result = this.getVirtualTextHeight();
    let result = 0;
    if (this._imageHeight > 0) {
      result = this._imageHeight;
    }

    if (DEBUG_SIZE) {
      this._log.debug("getVirtualHeight: ",result);
    }
    return result;
  }

  // VirtualScrollable
  getReserveViewportHeight(containerHeight: number): number {
    if (DEBUG_SIZE) {
      this._log.debug("getReserveViewportHeight: ", 0);
    }
    return 0;
  }

  getCursorPosition(): CursorMoveDetail {
    const detail: CursorMoveDetail = {
      left: 0,
      top: this._cursorTop,
      bottom: this._cursorTop + this._height,
      viewPortTop: this._cursorTop
    };
    return detail;
  }

  setCursorPositionTop(ch: number): boolean {
    this._cursorTop = 0;
    this.focus();
    return true;
  }

  setCursorPositionBottom(ch: number): boolean {
    this._cursorTop = this._imageHeight - this._height;
    this.focus();
    return true;
  }

  // From viewerelementtypes.SupportsMimeTypes
  static supportsMimeType(mimeType): boolean {
    return ["image/x-bmp", "image/bmp", "image/png", "image/gif", "image/jpeg",  "image/webp"].indexOf(mimeType) !== -1;
  }

  private createClone(): Node {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = trimBetweenTags(`
        <style id="${ThemeableElementBase.ID_THEME}"></style>
        <div id="${ID_CONTAINER}" class="${CLASS_FORCE_UNFOCUSED}" tabindex="-1">
          <div id="${ID_CURSOR}"></div>
          <img id="${ID_IMAGE}" />
        </div>`);

      window.document.body.appendChild(template);
    }

    return window.document.importNode(template.content, true);
  }

  private _applyVisualState(visualState: VisualState): void {
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);

    containerDiv.classList.remove(CLASS_FORCE_FOCUSED);
    containerDiv.classList.remove(CLASS_FORCE_UNFOCUSED);
    containerDiv.classList.remove(CLASS_FOCUS_AUTO);

    switch (visualState) {
      case VisualState.AUTO:
        containerDiv.classList.add(CLASS_FOCUS_AUTO);
        break;

      case VisualState.FOCUSED:
        containerDiv.classList.add(CLASS_FORCE_FOCUSED);
        break;

      case VisualState.UNFOCUSED:
        containerDiv.classList.add(CLASS_FORCE_UNFOCUSED);
        break;
    }
  }

  private _setImageUrl(url: string): void {
    const imageEl = DomUtils.getShadowId(this, ID_IMAGE);
    imageEl.setAttribute("src", url);
  }
  private _handleImageLoad(): void {
    const imgElement = <HTMLImageElement> DomUtils.getShadowId(this, ID_IMAGE);
    this._imageWidth = imgElement.width;
    this._imageHeight = imgElement.height;

    const cursorDiv = DomUtils.getShadowId(this, ID_CURSOR);
    cursorDiv.style.height = "" + imgElement.height + "px";
    emitResizeEvent(this);
  }

  public dispatchEvent(ev: Event): boolean {
    if (ev.type === 'keydown' || ev.type === 'keypress') {
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      return containerDiv.dispatchEvent(ev);
    } else {
      return super.dispatchEvent(ev);
    }
  }

  private _adjustHeight(newHeight: number): void {
    this._height = newHeight;
    if (this.parentNode === null || DomUtils.getShadowRoot(this) === null) {
      return;
    }
    if (newHeight !== this._currentElementHeight) {
      this._currentElementHeight = newHeight;
      this.style.height = "" + newHeight + "px";
      const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
      containerDiv.style.height = "" + newHeight + "px";
    }
  }
}

