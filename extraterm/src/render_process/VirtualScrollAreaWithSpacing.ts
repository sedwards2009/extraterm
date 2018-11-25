/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { VirtualScrollArea, VirtualAreaState, VirtualScrollableState, VirtualScrollable, SetterState, DumpState, VirtualScrollableHeight } from './VirtualScrollArea';
import { EmbeddedViewer } from './viewers/EmbeddedViewer';

const SPACING_PX = 30;


class Spacer implements VirtualScrollable {

  _spacing: number;

  constructor(spacing: number) {
    this._spacing = spacing;
  }

  setSpacing(spacing: number): void {
    this._spacing = spacing;
  }

  getMinHeight(): number {
    return this._spacing;
  }

  getVirtualHeight(containerHeight: number): number {
    return this._spacing;
  }

  getReserveViewportHeight(containerHeight: number): number {
    return 0;
  }

  setDimensionsAndScroll(setterState: SetterState): void {
  }

  markVisible(visible: boolean): void {
  }
}


export class VirtualScrollAreaWithSpacing extends VirtualScrollArea {

  private _spacer: Spacer;

  constructor() {
    super();
    this._spacer = new Spacer(SPACING_PX);
  }

  protected _totalVirtualHeight(state: VirtualAreaState): number {
    const previousList = state.scrollableStates;
    state.scrollableStates = this._makeStatesListWithSpacing(previousList);
    const result = super._totalVirtualHeight(state);
    state.scrollableStates = previousList;
    return result;
  }

  protected _compute(state: VirtualAreaState): void {
    const previousList = state.scrollableStates;
    state.scrollableStates = this._makeStatesListWithSpacing(previousList);
    super._compute(state);
    state.scrollableStates = previousList;
  }

  private _makeStatesListWithSpacing(scrollableStates: VirtualScrollableState[]): VirtualScrollableState[] {
    let lastIsFrame: boolean = null;

    const newStateList: VirtualScrollableState[] = [];
    for (let vss of scrollableStates) {
      const isFrame = vss.scrollable instanceof EmbeddedViewer;

      if (this._needsSpace(lastIsFrame, isFrame)) {
        const spacingVirtualScrollableState: VirtualScrollableState = {
          scrollable: this._spacer,
          virtualHeight: 0,
          minHeight: SPACING_PX,
          reserveViewportHeight: SPACING_PX,
        
          // Output - These values are set by the calculate() method.
          realHeight: 0,
          realTop: 0,
          virtualScrollYOffset: 0,
          virtualTop: 0,
          visible: true
        };

        newStateList.push(spacingVirtualScrollableState);
      }

      newStateList.push(vss);

      lastIsFrame = isFrame;
    }
    return newStateList;
  }

  private _needsSpace(previousWasFrame: boolean, currentIsFrame: boolean): boolean {
    /*
      This is the truth table we implement when deciding to add extra space.

      LastVSS \ vss | not-frame | frame
      --------------+-----------+-------
      null          |    -      |   -
      not-frame     |    -      | Add space
      frame         | Add space | Add space
    */
    if (previousWasFrame != null) {
      if ( ! (!previousWasFrame && !currentIsFrame)) {
        return true;
      }
    }
    return false;
  }

  getScrollableHeightsIncSpacing(): VirtualScrollableHeight[] {
    const heights = this.getScrollableHeights();

    let lastIsFrame: boolean = null;
    let i=0;
    for (let vss of this._currentState.scrollableStates) {
      const isFrame = vss.scrollable instanceof EmbeddedViewer;
      if (this._needsSpace(lastIsFrame, isFrame)) {
        heights[i].height += SPACING_PX;
      }

      i++;
      lastIsFrame = isFrame;
    }
    return heights;
  }
}
