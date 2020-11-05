/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { html, render, parts } from "extraterm-lit-html";
import { log, Logger, getLogger} from "extraterm-logging";
import { CustomElement, Attribute, Observe } from 'extraterm-web-component-decorators';

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import {ElementMimeType, FrameMimeType} from '../InternalMimeTypes';
import { disassembleDOMTree } from "../DomUtils";


const ID_TOP = "ID_TOP";
const ID_DRAG_COVER = "ID_DRAG_COVER";
const ID_CONTENTS = "ID_CONTENTS";
const CLASS_NOT_DRAGGING = "CLASS_NOT_DRAGGING";
const CLASS_DRAGGING = "CLASS_DRAGGING";

export enum DropLocation {
  NONE,
  NORTH,
  SOUTH,
  EAST,
  WEST,
  MIDDLE
}

export interface DroppedEventDetail {
  dropLocation: DropLocation;
  mimeType: string;
  dropData: string;
}

const dropLocationToCss = {
  [DropLocation.NONE]: null,
  [DropLocation.NORTH]: "CLASS_DROP_TARGET_NORTH",
  [DropLocation.SOUTH]: "CLASS_DROP_TARGET_SOUTH",
  [DropLocation.EAST]: "CLASS_DROP_TARGET_EAST",
  [DropLocation.WEST]: "CLASS_DROP_TARGET_WEST",
  [DropLocation.MIDDLE]: "CLASS_DROP_TARGET_MIDDLE",
};

const SUPPORTED_MIMETYPES = [ElementMimeType.MIMETYPE, FrameMimeType.MIMETYPE];

/**
 * A container which supports splitting and snapping for dragged items.
 */
@CustomElement("et-snap-drop-container")
export class SnapDropContainer extends ThemeableElementBase {

  static TAG_NAME = "ET-SNAP-DROP-CONTAINER";
  static EVENT_DROPPED = "snapdropcontainer-dropped";
  private _log: Logger;
  private _supportedMimeTypes: string[] = [];
  private _dropLocation: DropLocation = DropLocation.NONE;

  constructor() {
    super();
    this._log = getLogger(SnapDropContainer.TAG_NAME, this);
    this._handleDragEnter = this._handleDragEnter.bind(this);
    this._handleDragOver = this._handleDragOver.bind(this);
    this._handleDragLeave = this._handleDragLeave.bind(this);
    this._handleDrop = this._handleDrop.bind(this);

    this.attachShadow({ mode: "open", delegatesFocus: false });

    this._render();
    this.updateThemeCss();

    this._updateSupportedMimeTypes();
  }

  private _updateSupportedMimeTypes(): void {
    const mimeTypeParams = this.windowId != null && this.windowId !== "" ? `;windowid=${this.windowId}` : "";
    this._supportedMimeTypes = SUPPORTED_MIMETYPES.map(mt => mt + mimeTypeParams);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    parts.set(this.shadowRoot, undefined);
    disassembleDOMTree(this.shadowRoot);
  }

  @Attribute windowId = "";
  @Observe("windowId")
  private _observeWindowId(target: string): void {
    this._updateSupportedMimeTypes();
  }

  protected _render(): void {
    const dragEnterHandler = {
      handleEvent: this._handleDragEnter,
      capture: true
    };
    const dragOverHandler = {
      handleEvent: this._handleDragOver,
      capture: true
    };
    const dragLeaveHandler = {
      handleEvent: this._handleDragLeave,
      capture: true
    };
    const dropHandler = {
      handleEvent: this._handleDrop,
      capture: true
    };

    const template = html`${this._styleTag()}
      <div
          id='${ID_TOP}'
          class=${this._dropLocation === DropLocation.NONE ? CLASS_NOT_DRAGGING : CLASS_DRAGGING}
          @dragenter=${dragEnterHandler}
          @dragover=${dragOverHandler}
          @dragleave=${dragLeaveHandler}
          @drop=${dropHandler}
        >
        <div id='${ID_CONTENTS}'><slot></slot></div>
        <div id='${ID_DRAG_COVER}' class=${dropLocationToCss[this._dropLocation]} ></div>
      </div>`;
    render(template, this.shadowRoot);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SNAP_DROP_CONTAINER];
  }

  private _handleDragEnter(ev: DragEvent): void {
    if (this._isSupportedDropPayload(ev)) {
      ev.stopPropagation();
      this._dropLocation = this._cursorPositionToDropLocation(ev);
      this._render();
    }
  }

  private _handleDragOver(ev: DragEvent): void {
    if (this._isSupportedDropPayload(ev)) {
      ev.preventDefault();
      ev.stopPropagation();
      this._dropLocation = this._cursorPositionToDropLocation(ev);
      this._render();
    }
  }

  private _handleDragLeave(ev: DragEvent): void {
    if (this._isSupportedDropPayload(ev)) {
      ev.stopPropagation();
      if (ev.target === DomUtils.getShadowId(this, ID_DRAG_COVER)) {
        this._dropLocation = DropLocation.NONE;
        this._render();
      }
    }
  }

  // The drag over regions are north, south, east and west.
  // There is a neutral square in the middle of the drop area.
  //
  //  +-----+
  //  |\___/|
  //  | |_| |
  //  |/   \|
  //  +-----+

  private _cursorPositionToDropLocation(ev: DragEvent): DropLocation {
    const widgetRect = this.getBoundingClientRect();
    const pointXInUnitSpace = (ev.pageX - widgetRect.left) / widgetRect.width;
    const pointYInUnitSpace = (ev.pageY - widgetRect.top) / widgetRect.height;

    const inMiddle = pointXInUnitSpace > 1/3 && pointXInUnitSpace < 2/3 &&
                      pointYInUnitSpace > 1/3 && pointYInUnitSpace < 2/3;
    if (inMiddle) {
      return DropLocation.MIDDLE;
    }

    const oneOneVectorSide = pointXInUnitSpace < pointYInUnitSpace;
    const reverseOneOneVectorSide = -pointXInUnitSpace+1 < pointYInUnitSpace;
    if (oneOneVectorSide) {
      if (reverseOneOneVectorSide) {
        return DropLocation.SOUTH;
      } else {
        return DropLocation.WEST;
      }
    } else {
      if (reverseOneOneVectorSide) {
        return DropLocation.EAST;
      } else {
        return DropLocation.NORTH;
      }
    }
  }

  private _handleDrop(ev:DragEvent): void {
    this._dropLocation = DropLocation.NONE;
    this._render();

    const {mimeType, data} = this._getSupportedDropMimeTypeData(ev);
    if (mimeType != null) {
      const detail: DroppedEventDetail = {
        dropLocation: this._cursorPositionToDropLocation(ev),
        mimeType: mimeType,
        dropData: data
      };
      const customDropEvent = new CustomEvent(SnapDropContainer.EVENT_DROPPED, { bubbles: true, detail: detail });
      this.dispatchEvent(customDropEvent);
    }
  }

  private _isSupportedDropPayload(ev: DragEvent): boolean {
    for (let i=0; i < ev.dataTransfer.items.length; i++) {
      const item = ev.dataTransfer.items[i];
      if (this._supportedMimeTypes.indexOf(item.type) !== -1) {
        return true;
      }
    }
    return false;
  }

  private _getSupportedDropMimeTypeData(ev: DragEvent): {mimeType: string; data: string;} {
    for (const mimeType of this._supportedMimeTypes) {
      const data = ev.dataTransfer.getData(mimeType);
      if (data != null && data !== "") {
        return {mimeType, data};
      }
    }
    return {mimeType: null, data: null};
  }
}
