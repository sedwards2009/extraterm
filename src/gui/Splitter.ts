/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {ThemeableElementBase} from '../ThemeableElementBase';
import * as ThemeTypes from '../Theme';
import * as ResizeRefreshElementBase from '../ResizeRefreshElementBase';
import * as BulkDomOperation from '../BulkDomOperation';
import * as Util from './Util';
import * as DomUtils from '../DomUtils';
import * as _ from 'lodash';
import Logger from '../Logger';
import log from '../LogDecorator';

const ID = "EtSplitterTemplate";
let registered = false;

const ID_TOP = "ID_TOP";
const ID_CONTAINER = "ID_CONTAINER";
const ID_COVER = "ID_COVER";
const ID_INDICATOR = "ID_INDICATOR";

const CLASS_DIVIDER = "CLASS_DIVIDER";
const CLASS_PANE = "CLASS_PANE";
const CLASS_NORMAL = "CLASS_NORMAL";
const CLASS_DRAG = "CLASS_DRAG";

const DIVIDER_SIZE = 4;
const NOT_DRAGGING = -1;
const MIN_PANE_SIZE = 32;

/**
 * A widget to display panes of widgets separated by a moveable gap/bar.
 *
 */
export class Splitter extends ThemeableElementBase {
  
  /**
   * The HTML tag name of this element.
   */
  static TAG_NAME = "ET-SPLITTER";
  
  /**
   * Initialize the TabWidget class and resources.
   *
   * When TabWidget is imported into a render process, this static method
   * must be called before an instances may be created. This is can be safely
   * called multiple times.
   */
  static init(): void {
    if (registered === false) {
      window.document.registerElement(Splitter.TAG_NAME, {prototype: Splitter.prototype});
      registered = true;
    }
  }
  
  //-----------------------------------------------------------------------
  // WARNING: Fields like this will not be initialised automatically. See _initProperties().
  private _log: Logger;
  
  private _mutationObserver: MutationObserver;
  
  private _paneWidths: PaneSizes;

  private _dividerDrag: number; // The number of the divider currently being dragged. -1 means not dragging.

  private _dividerDragOffsetX: number;

  private _initProperties(): void {
    this._log = new Logger(Splitter.TAG_NAME, this);
    this._paneWidths = new PaneSizes();
    this._mutationObserver = null;
    this._dividerDrag = NOT_DRAGGING;
    this._dividerDragOffsetX = 0;
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
                                                           
  /**
   * Custom Element 'created' life cycle hook.
   */
  createdCallback() {
    this._initProperties();
    const shadow = this.attachShadow({ mode: 'open', delegatesFocus: false });
    const clone = this.createClone();
    shadow.appendChild(clone);

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_NORMAL);
    topDiv.addEventListener('mousedown', this._handleMouseDown.bind(this));
    topDiv.addEventListener('mouseup', this._handleMouseUp.bind(this));
    topDiv.addEventListener('mousemove', this._handleMouseMove.bind(this));

    const coverDiv = DomUtils.getShadowId(this, ID_COVER);
    coverDiv.addEventListener('mouseleave', this._handleMouseLeave.bind(this));

    const indicatorDiv = DomUtils.getShadowId(this, ID_INDICATOR);
    indicatorDiv.style.width = "" + DIVIDER_SIZE + "px";

    const rect = topDiv.getBoundingClientRect();
    const width = rect.width === 0 ? 1024 : rect.width;
    this._paneWidths = PaneSizes.equalPaneSizes(width, DomUtils.toArray(this.children));
    this._createLayout(this._paneWidths);

    this._mutationObserver = new MutationObserver(this._handleMutations.bind(this));
    this._mutationObserver.observe(this, { childList: true });

    this.updateThemeCss();
  }

  attachedCallback(): void {
    this._handleMutations([]);
  }

  protected _themeCssFiles(): ThemeTypes.CssFile[] {
    return [ThemeTypes.CssFile.GUI_CONTROLS, ThemeTypes.CssFile.GUI_SPLITTER];
  }
  
  //-----------------------------------------------------------------------

  
  bulkRefresh(level: ResizeRefreshElementBase.RefreshLevel): BulkDomOperation.BulkDOMOperation {

    if (DomUtils.getShadowRoot(this) === null) {
      return BulkDomOperation.nullOperation();
    } else {
      const superBulkRefresh = super.bulkRefresh;

      const generator = function* bulkRefreshGenerator(this: Splitter): IterableIterator<BulkDomOperation.GeneratorResult> {
        yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;

        if (level === ResizeRefreshElementBase.RefreshLevel.COMPLETE) {
          this._paneWidths = this._paneWidths.update(DomUtils.toArray(this.children));

          yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
          this._createLayout(this._paneWidths);

          yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
        }

        const topDiv = DomUtils.getShadowId(this, ID_TOP);
        const rect = topDiv.getBoundingClientRect();
        const newPaneWidths = this._paneWidths.updateTotalSize(rect.width);

        yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
        this._paneWidths = newPaneWidths;
        this._setSizes(newPaneWidths);

        yield { phase: BulkDomOperation.GeneratorPhase.BEGIN_FINISH, extraOperation: superBulkRefresh.call(this, level) };

        return BulkDomOperation.GeneratorPhase.DONE;
      };
      return BulkDomOperation.fromGenerator(generator.bind(this)(), this._log.getName());
    }
  }

  /**
   * 
   */
  private createClone() {
    let template = <HTMLTemplateElement>window.document.getElementById(ID);
    if (template === null) {
      template = <HTMLTemplateElement>window.document.createElement('template');
      template.id = ID;
      template.innerHTML = `<style id="${ThemeableElementBase.ID_THEME}"></style>
<div id='${ID_TOP}'>
<div id='${ID_CONTAINER}'></div>
<div id='${ID_COVER}'><div id='${ID_INDICATOR}'></div></div>
</div>`;
      window.document.body.appendChild(template);
    }
    
    return window.document.importNode(template.content, true);
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
    const containerDiv = DomUtils.getShadowId(this, ID_CONTAINER);
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
    this._dividerDragOffsetX = ev.offsetX;

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    topDiv.classList.add(CLASS_DRAG);
    topDiv.classList.remove(CLASS_NORMAL);

    const indicatorDiv = DomUtils.getShadowId(this, ID_INDICATOR);
    const topRect = topDiv.getBoundingClientRect();
    indicatorDiv.style.left = "" + (ev.clientX - topRect.left - this._dividerDragOffsetX) + "px";
  }

  private _handleMouseUp(ev: MouseEvent): void {
    if (this._dividerDrag === NOT_DRAGGING) {
      return;
    }
    
    const target = <HTMLElement> ev.target;

    ev.preventDefault();
    ev.stopPropagation();

    // Now actually move the divider.
    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    const indicatorDiv = DomUtils.getShadowId(this, ID_INDICATOR);
    const topRect = topDiv.getBoundingClientRect();
    const newIndicatorLeft = ev.clientX - topRect.left - this._dividerDragOffsetX;
    this._paneWidths = this._paneWidths.adjustPaneSize(this._dividerDrag, newIndicatorLeft);
    this._setSizes(this._paneWidths);

    this._stopDrag();

    // Refresh the kids.
    this.refresh(ResizeRefreshElementBase.RefreshLevel.RESIZE);
  }

  private _stopDrag(): void {
    const topDiv = DomUtils.getShadowId(this, ID_TOP);
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

    const topDiv = DomUtils.getShadowId(this, ID_TOP);
    const indicatorDiv = DomUtils.getShadowId(this, ID_INDICATOR);
    const topRect = topDiv.getBoundingClientRect();
    const newIndicatorLeft = ev.clientX - topRect.left - this._dividerDragOffsetX;
    const newPaneWidths = this._paneWidths.adjustPaneSize(this._dividerDrag, newIndicatorLeft);

    indicatorDiv.style.left = "" + newPaneWidths.getPaneNext(this._dividerDrag) + "px";
  }

  private _handleMouseLeave(ev: MouseEvent): void {
    this._stopDrag();
  }

  private _handleMutations(mutations: MutationRecord[]): void {
    this._paneWidths = this._paneWidths.update(DomUtils.toArray(this.children));

    this._createLayout(this._paneWidths);
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
                                          
  private _createLayout(paneWidths: PaneSizes): void {
    const topDiv = DomUtils.getShadowId(this, ID_CONTAINER);

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

    this._setSizes(paneWidths);
  }

  private _setSizes(paneWidths: PaneSizes): void {
    const topDiv = DomUtils.getShadowId(this, ID_CONTAINER);

    let x = 0;
    for (let i=0; i<paneWidths.length(); i++) {
      const kid = <HTMLElement> topDiv.children.item(i*2);
      const width = paneWidths.get(i);
      kid.style.left = "" + x + "px";
      kid.style.width = "" + width + "px";
      x += width;

      if (i < this.children.length-1) {
        const divider = <HTMLElement> topDiv.children.item(i*2+1);
        divider.style.left = "" + x + "px";
        divider.style.width = "" + DIVIDER_SIZE + "px";
        x += DIVIDER_SIZE;
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
    return new PaneSizes(newPaneSizes, newPanes);
  }
  
}
