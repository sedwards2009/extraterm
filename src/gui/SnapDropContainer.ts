/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import * as DomUtils from '../DomUtils';
import {ElementMimeType, FrameMimeType} from '../InternalMimeTypes';

import Logger from '../Logger';
import log from '../LogDecorator';


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

let registered = false;


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


/**
 * A container which supports splitting and snapping for dragged items.
 */
export class SnapDropContainer extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-SNAPDROPCONTAINER";

  static EVENT_DROPPED = "snapdropcontainer-dropped";

  /**
   * Initialize the SnapDropContainer class and resources.
   *
   * When SnapDropContainer is imported into a render process, this static
   * method must be called before an instances may be created. This is can
   * be safely called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.customElements.define(SnapDropContainer.TAG_NAME.toLowerCase(), SnapDropContainer);
      registered = true;
    }
  }

  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;

  private _initProperties(): void {
    this._log = new Logger(SnapDropContainer.TAG_NAME, this);
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

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_NOT_DRAGGING);

    topDiv.addEventListener("dragenter", this._handleDragEnter.bind(this));
    topDiv.addEventListener("dragover", this._handleDragOver.bind(this));
    topDiv.addEventListener("dragleave", this._handleDragLeave.bind(this));
    topDiv.addEventListener("drop", this._handleDrop.bind(this));
  }

  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
<div id='${ID_TOP}'>
  <div id='${ID_CONTENTS}'><slot></slot></div>
  <div id='${ID_DRAG_COVER}'></div>
</div>
`;
      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_SNAP_DROP_CONTAINER];
  }

  private _handleDragEnter(ev: DragEvent): void {
    ev.stopPropagation();
    this._showDragCover(ev);
  }

  private _handleDragOver(ev: DragEvent): void {
    ev.stopPropagation();
    this._showDragCover(ev);
  }

  private _handleDragLeave(ev: DragEvent): void {
    ev.stopPropagation();
    if (ev.target == DomUtils.getShadowId(this, ID_DRAG_COVER)) {
      this._hideDragCover();
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
      const tabDropEvent = new CustomEvent(SnapDropContainer.EVENT_DROPPED, { bubbles: true, detail: detail });
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
}
