/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { WebComponent } from 'extraterm-web-component-decorators';
import { ResizeNotifier } from 'extraterm-resize-notifier';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";

import * as ThemeTypes from '../../theme/Theme';
import * as DomUtils from '../DomUtils';
import { TemplatedElementBase } from './TemplatedElementBase';
import { RefreshLevel } from '../viewers/ViewerElementTypes';

const ID_TOP = "ID_TOP";
const ID_CONTAINER = "ID_CONTAINER";
const ID_COVER = "ID_COVER";
const ID_INDICATOR = "ID_INDICATOR";

const CLASS_DIVIDER = "CLASS_DIVIDER";
const CLASS_PANE = "CLASS_PANE";
const CLASS_NORMAL = "CLASS_NORMAL";
const CLASS_DRAG = "CLASS_DRAG";
const CLASS_VERTICAL = "CLASS_VERTICAL";
const CLASS_HORIZONTAL = "CLASS_HORIZONTAL";

const DIVIDER_SIZE = 4;
const NOT_DRAGGING = -1;
const MIN_PANE_SIZE = 32;

export enum SplitOrientation {
  VERTICAL,
  HORIZONTAL
}

/**
 * A widget to display panes of widgets separated by a moveable gap/bar.
 *
 */
@WebComponent({tag: "et-splitter"})
export class Splitter extends TemplatedElementBase {
  
  static TAG_NAME = "ET-SPLITTER";
  private static _resizeNotifier = new ResizeNotifier();
  
  private _log: Logger;
  private _mutationObserver: MutationObserver = null;
  private _orientation: SplitOrientation = SplitOrientation.VERTICAL;
  private _paneSizes: PaneSizes;
  private _dividerDrag: number = NOT_DRAGGING; // The number of the divider currently being dragged. -1 means not dragging.
  private _dividerDragOffset: number = 0;

  constructor() {
    super({ delegatesFocus: false });

    this._log = getLogger(Splitter.TAG_NAME, this);
    this._paneSizes = new PaneSizes();

    const topDiv = this._elementById(ID_TOP);
    topDiv.classList.add(CLASS_NORMAL);
    Splitter._resizeNotifier.observe(topDiv, (target: Element, contentRect: DOMRectReadOnly) => {
      this._refresh(RefreshLevel.COMPLETE);
    });
    topDiv.addEventListener('mousedown', this._handleMouseDown.bind(this));
    topDiv.addEventListener('mouseup', this._handleMouseUp.bind(this));
    topDiv.addEventListener('mousemove', this._handleMouseMove.bind(this));

    const coverDiv = this._elementById(ID_COVER);
    coverDiv.addEventListener('mouseleave', this._handleMouseLeave.bind(this));

    const indicatorDiv = this._elementById(ID_INDICATOR);
    indicatorDiv.style.width = "" + DIVIDER_SIZE + "px";

    const rect = topDiv.getBoundingClientRect();
    const width = rect.width === 0 ? 1024 : rect.width;
    this._paneSizes = PaneSizes.equalPaneSizes(width, DomUtils.toArray(this.children));

    topDiv.classList.add(CLASS_VERTICAL);

    this._mutationObserver = new MutationObserver(this._handleMutations.bind(this));
    this._mutationObserver.observe(this, { childList: true });

    this.updateThemeCss();
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GENERAL_GUI, ThemeTypes.CssFile.GUI_SPLITTER];
  }
  
  getSplitOrientation(): SplitOrientation {
    return this._orientation;
  }

  setSplitOrientation(orientation: SplitOrientation): void {
    if (this._orientation !== orientation) {
      this._orientation = orientation;
      const topDiv = this._elementById(ID_TOP);
      const rect = topDiv.getBoundingClientRect();

      const rectSize = this._orientation === SplitOrientation.VERTICAL ? rect.width : rect.height;
      const size = rectSize === 0 ? 1024 : rectSize;
      this._paneSizes = PaneSizes.equalPaneSizes(size, DomUtils.toArray(this.children));

      const indicatorDiv = this._elementById(ID_INDICATOR);
      if (this._orientation === SplitOrientation.HORIZONTAL) {
        indicatorDiv.style.width = null;
        indicatorDiv.style.height = "" + DIVIDER_SIZE + "px";

        topDiv.classList.remove(CLASS_VERTICAL);
        topDiv.classList.add(CLASS_HORIZONTAL);
      } else {
        indicatorDiv.style.width = "" + DIVIDER_SIZE + "px";
        indicatorDiv.style.height = null;

        topDiv.classList.remove(CLASS_HORIZONTAL);
        topDiv.classList.add(CLASS_VERTICAL);
      }

      this._createLayout(this._paneSizes);
    }
  }

  getDividerSize(): number {
    return DIVIDER_SIZE;
  }

  getPaneSizes(): number[] {
    const result: number[] = [];
    for (let i=0; i<this._paneSizes.length(); i++) {
      result.push(this._paneSizes.get(i));
    }
    return result;
  }
  
  private _refresh(level: RefreshLevel): void {
    if (DomUtils.getShadowRoot(this) !== null && DomUtils.isNodeInDom(this)) {
      // DOM read
      if (level === RefreshLevel.COMPLETE) {
        this._paneSizes = this._paneSizes.update(DomUtils.toArray(this.children));
        this._createLayout(this._paneSizes);
      }

      const topDiv = this._elementById(ID_TOP);
      const rect = topDiv.getBoundingClientRect();
      const size = this._orientation === SplitOrientation.VERTICAL ? rect.width : rect.height;
      if (size !== 0) {
        const newPaneSizes = this._paneSizes.updateTotalSize(size);

        this._paneSizes = newPaneSizes;
        this._setSizes(newPaneSizes, this._orientation);
      }
    }
  }

  protected _html(): string {
    return `<div id='${ID_TOP}'>
      <div id='${ID_CONTAINER}'></div>
      <div id='${ID_COVER}'><div id='${ID_INDICATOR}'></div></div>
    </div>`;
  }

  //-----------------------------------------------------------------------
  //
  //   #######                                   
  //   #       #    # ###### #    # #####  ####  
  //   #       #    # #      ##   #   #   #      
  //   #####   #    # #####  # #  #   #    ####  
  //   #       #    # #      #  # #   #        # 
  //   #        #  #  #      #   ##   #   #    # 
  //   #######   ##   ###### #    #   #    ####  
  //
  //-----------------------------------------------------------------------

  private _handleMouseDown(ev: MouseEvent): void {
    const target = <HTMLElement> ev.target;

    if ( ! target.classList.contains(CLASS_DIVIDER)) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    // Figure out which divider was hit.
    const containerDiv = this._elementById(ID_CONTAINER);
    let dividerIndex = -1;
    for (let i=0; i<containerDiv.children.length; i++) {
      if (containerDiv.children.item(i) === target) {
        dividerIndex = (i-1)/2;
        break;
      }
    }

    if (dividerIndex === -1) {
      return;
    }

    this._dividerDrag = dividerIndex;
    if (this._orientation === SplitOrientation.VERTICAL) {
      this._dividerDragOffset = ev.offsetX;
    } else {
      this._dividerDragOffset = ev.offsetY;
    }

    const topDiv = this._elementById(ID_TOP);
    topDiv.classList.add(CLASS_DRAG);
    topDiv.classList.remove(CLASS_NORMAL);

    const indicatorDiv = this._elementById(ID_INDICATOR);
    const topRect = topDiv.getBoundingClientRect();

    if (this._orientation === SplitOrientation.VERTICAL) {
      indicatorDiv.style.left = "" + (ev.clientX - topRect.left - this._dividerDragOffset) + "px";
    } else {
      indicatorDiv.style.top = "" + (ev.clientY - topRect.top - this._dividerDragOffset) + "px";
    }
  }

  private _handleMouseUp(ev: MouseEvent): void {
    if (this._dividerDrag === NOT_DRAGGING) {
      return;
    }
    
    ev.preventDefault();
    ev.stopPropagation();

    // Now actually move the divider.
    const topDiv = this._elementById(ID_TOP);
    const topRect = topDiv.getBoundingClientRect();

    let newIndicatorPosition = 0;
    if (this._orientation === SplitOrientation.VERTICAL) {
      newIndicatorPosition = ev.clientX - topRect.left - this._dividerDragOffset;
    } else {
      newIndicatorPosition = ev.clientY - topRect.top - this._dividerDragOffset;
    }

    this._paneSizes = this._paneSizes.adjustPaneSize(this._dividerDrag, newIndicatorPosition);
    this._setSizes(this._paneSizes, this._orientation);

    this._stopDrag();
  }

  private _stopDrag(): void {
    const topDiv = this._elementById(ID_TOP);
    if (this._dividerDrag === NOT_DRAGGING) {
      return;
    }

    topDiv.classList.remove(CLASS_DRAG);
    topDiv.classList.add(CLASS_NORMAL);
    this._dividerDrag = NOT_DRAGGING;
  }

  private _handleMouseMove(ev: MouseEvent): void {
    if (this._dividerDrag === NOT_DRAGGING) {
      return;
    }

    if ((ev.buttons & 1) === 0) {
      this._stopDrag();
      return;
    }

    const topDiv = this._elementById(ID_TOP);
    const indicatorDiv = this._elementById(ID_INDICATOR);
    const topRect = topDiv.getBoundingClientRect();

    let newIndicatorPosition = 0;
    if (this._orientation === SplitOrientation.VERTICAL) {
      newIndicatorPosition = ev.clientX - topRect.left - this._dividerDragOffset;
    } else {
      newIndicatorPosition = ev.clientY - topRect.top - this._dividerDragOffset;
    }

    const newPaneSizes = this._paneSizes.adjustPaneSize(this._dividerDrag, newIndicatorPosition);

    if (this._orientation === SplitOrientation.VERTICAL) {
      indicatorDiv.style.left = "" + newPaneSizes.getPaneNext(this._dividerDrag) + "px";
    } else {
      indicatorDiv.style.top = "" + newPaneSizes.getPaneNext(this._dividerDrag) + "px";
    }
  }

  private _handleMouseLeave(ev: MouseEvent): void {
    this._stopDrag();
  }

  private _handleMutations(mutations: MutationRecord[]): void {
    this._paneSizes = this._paneSizes.update(DomUtils.toArray(this.children));

    this._createLayout(this._paneSizes);
  }

  //-----------------------------------------------------------------------
  //
  //   #                                        
  //   #         ##   #   #  ####  #    # ##### 
  //   #        #  #   # #  #    # #    #   #   
  //   #       #    #   #   #    # #    #   #   
  //   #       ######   #   #    # #    #   #   
  //   #       #    #   #   #    # #    #   #   
  //   ####### #    #   #    ####   ####    #   
  //
  //-----------------------------------------------------------------------
                                          
  private _createLayout(paneSizes: PaneSizes): void {
    const topDiv = this._elementById(ID_CONTAINER);

    topDiv.innerHTML = "";

    for (let i=0; i<this.children.length; i++) {
      const kid = <HTMLElement>this.children.item(i);
      kid.slot = "slot" + i;

      const paneDiv  = this.ownerDocument.createElement("DIV");
      paneDiv.classList.add(CLASS_PANE);
      const slotElement = this.ownerDocument.createElement("SLOT");
      slotElement.setAttribute("name", "slot" + i);
      paneDiv.appendChild(slotElement);

      topDiv.appendChild(paneDiv);

      if (i < this.children.length-1) {
        const dividerDiv = this.ownerDocument.createElement("DIV");
        dividerDiv.classList.add(CLASS_DIVIDER);
        topDiv.appendChild(dividerDiv);
      }
    }

    this._setSizes(paneSizes, this._orientation);
  }

  private _setSizes(paneSizes: PaneSizes, orientation: SplitOrientation): void {
    const topDiv = this._elementById(ID_CONTAINER);

    let position = 0;
    for (let i=0; i<paneSizes.length(); i++) {
      const kid = <HTMLElement> topDiv.children.item(i*2);
      const size = paneSizes.get(i);
      if (orientation === SplitOrientation.VERTICAL) {
        kid.style.left = "" + position + "px";
        kid.style.width = "" + size + "px";
        kid.style.top = null;
        kid.style.height = null;
      } else {
        kid.style.top = "" + position + "px";
        kid.style.height = "" + size + "px";
        kid.style.left = null;
        kid.style.width = null;
      }

      position += size;

      if (i < this.children.length-1) {
        const divider = <HTMLElement> topDiv.children.item(i*2+1);
        if (orientation === SplitOrientation.VERTICAL) {
          divider.style.left = "" + position + "px";
          divider.style.width = "" + DIVIDER_SIZE + "px";
          divider.style.top = null;
          divider.style.height = null;
        } else {
          divider.style.top = "" + position + "px";
          divider.style.height = "" + DIVIDER_SIZE + "px";
          divider.style.left = null;
          divider.style.width = null;
        }
        position += DIVIDER_SIZE;
      }      
    }
  }

}

//-----------------------------------------------------------------------
//
//   ######                        #####
//   #     #   ##   #    # ###### #     # # ###### ######  ####
//   #     #  #  #  ##   # #      #       #     #  #      #
//   ######  #    # # #  # #####   #####  #    #   #####   ####
//   #       ###### #  # # #            # #   #    #           #
//   #       #    # #   ## #      #     # #  #     #      #    #
//   #       #    # #    # ######  #####  # ###### ######  ####
//
//-----------------------------------------------------------------------

class PaneSizes {

  private _paneSizes: number[];

  private _panes: Object[];

  static equalPaneSizes(totalSize: number, panes: Object[]) {
    // Distribute the panes evenly.
    const paneCount = panes.length;
    const paneSize = (totalSize - (paneCount-1) * DIVIDER_SIZE) / paneCount;
    const paneSizes: number[] = [];
    for (let i=0; i<paneCount; i++) {
      paneSizes.push(paneSize);
    }
    return new PaneSizes(paneSizes, panes);
  }

  constructor(paneSizeArray: number[] = null, panes: Object[] = null) {
    if (paneSizeArray == null) {
      this._paneSizes = [];
    } else {
      this._paneSizes = paneSizeArray;
    }
    this._panes = panes;
  }

  get(index: number): number {
    return this._paneSizes[index];
  }

  length(): number {
    return this._paneSizes.length;
  }

  adjustPaneSize(dividerIndex: number, indicatorLeft: number): PaneSizes {
    let delta = indicatorLeft - this.getPaneNext(dividerIndex);

    const sizeFirst = this._paneSizes[dividerIndex];
    const sizeSecond = this._paneSizes[dividerIndex+1];

    delta = sizeFirst+delta < MIN_PANE_SIZE ? -sizeFirst+MIN_PANE_SIZE : delta;
    delta = sizeSecond-delta < MIN_PANE_SIZE ? sizeSecond-MIN_PANE_SIZE : delta;

    const copy = this._paneSizes.slice();
    copy[dividerIndex] += delta;
    copy[dividerIndex+1] -= delta;
    
    return new PaneSizes(copy, this._panes);
  }

  getPaneNext(index: number): number {
    return this._paneSizes.slice(0, index+1).reduce( (accu, w) => accu+w, 0) + index * DIVIDER_SIZE;
  }

  updateTotalSize(newTotalSize: number): PaneSizes {
    return this._resizeSizes(newTotalSize);
  }

  update(newPanes: Object[]): PaneSizes {
    return this._updateRemovedPanes(newPanes)._updateAddedPanes(newPanes);
  }

  reverse(): PaneSizes {
    return new PaneSizes(this._paneSizes.slice().reverse(), this._panes.slice().reverse());
  }

  private _resizeSizes(newTotalSize: number): PaneSizes {
    const effectiveUsableSize = newTotalSize - (this._panes.length-1) * DIVIDER_SIZE;

    const currentTotalSize = this._paneSizes.reduce( (accu, s) => accu+s, 0);
    const distributableSpace = effectiveUsableSize - currentTotalSize;

    const newSizes: number[] = [];
    let usedExtraSpace = 0;
    for (let i=0; i<this._paneSizes.length; i++) {
      if (i !== this._paneSizes.length-1) {
        const delta = Math.round(this._paneSizes[i] / currentTotalSize * distributableSpace);
        usedExtraSpace += delta;
        newSizes.push(this._paneSizes[i] + delta);
      } else {
        // We do it this way to avoid rounding errors and ensure that distribute the exact amount of space.
        newSizes.push(this._paneSizes[i] + distributableSpace - usedExtraSpace);
      }
    }

    return new PaneSizes(newSizes, this._panes);
  }

  private _updateRemovedPanes(newPanes: Object[]): PaneSizes {
    // Handle any panes which have been removed.
    let spaceAccount = 0;
    const newPaneSizes: number[] = [];
    const tempPanes: Object[] = [];
    for (let i=0; i<this._paneSizes.length; i++) {
      if (newPanes.indexOf(this._panes[i]) === -1) {
        // This pane was removed.
        spaceAccount += this._paneSizes[i];
        spaceAccount += DIVIDER_SIZE;
      } else {
        // This pane still exists. Give it the spare space.
        newPaneSizes.push(this._paneSizes[i] + spaceAccount);
        tempPanes.push(this._panes[i]);
        spaceAccount = 0;
      }
    }

    if (newPaneSizes.length !== 0) {
      newPaneSizes[newPaneSizes.length-1] += spaceAccount;
    }

    return new PaneSizes(newPaneSizes, tempPanes);
  }

  private _updateAddedPanes(newPanes: Object[]): PaneSizes {
    if (this._paneSizes.length === 0) {  // Special case for going from 0 panes to >0.
      return PaneSizes.equalPaneSizes(1024, newPanes);
    }

    const tempPaneSizes = this._distributeAddedPanes(newPanes);
    if (tempPaneSizes._panes.length !== newPanes.length) {
      const reverseNewPanes = newPanes.slice().reverse();
      return tempPaneSizes.reverse()._distributeAddedPanes(reverseNewPanes).reverse();

    } else {
      return tempPaneSizes;
    }
  }

  private _distributeAddedPanes(newPanes: Object[]): PaneSizes {
    const newPaneSizes: number[] = [];
    const tempPanes: Object[] = [];
    for (let i=0; i<newPanes.length; i++) {
      const oldIndex = this._panes.indexOf(newPanes[i]);
      if (oldIndex === -1) {
        // New pane.
        if (newPaneSizes.length === 0) {
          // Let the reverse step fix this one.

        } else {
          const previousSize = newPaneSizes[newPaneSizes.length-1];
          const half = Math.floor((previousSize - DIVIDER_SIZE) / 2); // Avoid fractional widths.
          newPaneSizes[newPaneSizes.length-1] = previousSize - DIVIDER_SIZE - half;
          newPaneSizes.push(half);
          tempPanes.push(newPanes[i]);
        }

      } else {
        // Old pane.
        newPaneSizes.push(this._paneSizes[oldIndex]);
        tempPanes.push(newPanes[i]);
      }
    }
    return new PaneSizes(newPaneSizes, tempPanes);
  }
  
}
