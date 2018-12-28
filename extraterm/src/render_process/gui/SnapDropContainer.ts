/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';

import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import {ElementMimeType, FrameMimeType} from '../InternalMimeTypes';

import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import { TemplatedElementBase } from './TemplatedElementBase';


const ID = "EtSnapDropContainerTemplate";
const ID_TOP = "ID_TOP";
const ID_DRAG_COVER = "ID_DRAG_COVER";
const ID_CONTENTS = "ID_CONTENTS";
const CLASS_NOT_DRAGGING = "CLASS_NOT_DRAGGING";
const CLASS_DRAGGING = "CLASS_DRAGGING";
const CLASS_DROP_TARGET_MIDDLE = "CLASS_DROP_TARGET_MIDDLE";
const CLASS_DROP_TARGET_NORTH = "CLASS_DROP_TARGET_NORTH";
const CLASS_DROP_TARGET_SOUTH = "CLASS_DROP_TARGET_SOUTH";
const CLASS_DROP_TARGET_EAST = "CLASS_DROP_TARGET_EAST";
const CLASS_DROP_TARGET_WEST = "CLASS_DROP_TARGET_WEST";


export enum DropLocation {
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

const dropLocationToCss = new Map<DropLocation, string>();
dropLocationToCss.set(DropLocation.NORTH, CLASS_DROP_TARGET_NORTH);
dropLocationToCss.set(DropLocation.SOUTH, CLASS_DROP_TARGET_SOUTH);
dropLocationToCss.set(DropLocation.EAST, CLASS_DROP_TARGET_EAST);
dropLocationToCss.set(DropLocation.WEST, CLASS_DROP_TARGET_WEST);
dropLocationToCss.set(DropLocation.MIDDLE, CLASS_DROP_TARGET_MIDDLE);

const SUPPORTED_MIMETYPES = [ElementMimeType.MIMETYPE, FrameMimeType.MIMETYPE];

/**
 * A container which supports splitting and snapping for dragged items.
 */
@WebComponent({tag: "et-snapdropcontainer"})
export class SnapDropContainer extends TemplatedElementBase {
  
  static TAG_NAME = "ET-SNAPDROPCONTAINER";
  static EVENT_DROPPED = "snapdropcontainer-dropped";
  private _log: Logger;

  constructor() {
    super({ delegatesFocus: false });
    this._log = getLogger(SnapDropContainer.TAG_NAME, this);

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_NOT_DRAGGING);

    topDiv.addEventListener("dragenter", this._handleDragEnter.bind(this), true);
    topDiv.addEventListener("dragover", this._handleDragOver.bind(this), true);
    topDiv.addEventListener("dragleave", this._handleDragLeave.bind(this), true);
    topDiv.addEventListener("drop", this._handleDrop.bind(this), true);
  }

  protected _html(): string {
    return `<div id='${ID_TOP}'>
      <div id='${ID_CONTENTS}'><slot></slot></div>
      <div id='${ID_DRAG_COVER}'></div>
    </div>
    `;
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SNAP_DROP_CONTAINER];
  }

  private _handleDragEnter(ev: DragEvent): void {
    if (this._isSupportedDropMimeType(ev)) {
      ev.stopPropagation();
      this._showDragCover(ev);
    }
  }

  private _handleDragOver(ev: DragEvent): void {
    if (this._isSupportedDropMimeType(ev)) {
      ev.preventDefault();
      ev.stopPropagation();

      this._showDragCover(ev);
    }
  }

  private _handleDragLeave(ev: DragEvent): void {
    if (this._isSupportedDropMimeType(ev)) {
      ev.stopPropagation();
      if (ev.target == DomUtils.getShadowId(this, ID_DRAG_COVER)) {
        this._hideDragCover();
      }
    }
  }

  private _showDragCover(ev: DragEvent): void {
    const dragCoverDiv = DomUtils.getShadowId(this, ID_DRAG_COVER);
    DomUtils.removeAllClasses(dragCoverDiv);
    dragCoverDiv.classList.add(dropLocationToCss.get(this._cursorPositionToDropLocation(ev)));

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_DRAGGING);
    topDiv.classList.remove(CLASS_NOT_DRAGGING);
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

  private _hideDragCover(): void {
    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_NOT_DRAGGING);
    topDiv.classList.remove(CLASS_DRAGGING);
  }

  private _handleDrop(ev:DragEvent): void {
    this._hideDragCover();

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

  private _isSupportedDropMimeType(ev: DragEvent): boolean {
    for (let i=0; i < ev.dataTransfer.items.length; i++) {
      const item = ev.dataTransfer.items[i];
      if (SUPPORTED_MIMETYPES.indexOf(item.type) !== -1) {
        return true;
      }
    }
    return false;
  }

  private _getSupportedDropMimeTypeData(ev: DragEvent): {mimeType: string; data: string;} {
    for (const mimeType of SUPPORTED_MIMETYPES) {
      const data = ev.dataTransfer.getData(mimeType);
      if (data != null && data !== "") {
        return {mimeType, data};
      }
    }
    return {mimeType: null, data: null};
  }
}
