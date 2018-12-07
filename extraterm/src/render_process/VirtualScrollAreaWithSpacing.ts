/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { VirtualScrollArea, VirtualAreaState, VirtualScrollableState, VirtualScrollable, SetterState, DumpState, VirtualScrollableHeight, Mutator } from './VirtualScrollArea';
import { EmbeddedViewer } from './viewers/EmbeddedViewer';


export class Spacer implements VirtualScrollable {

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

enum ScrollableType {
  NOTHING,
  NON_FRAME,
  FRAME,
  RUNNING_FRAME
}


export class VirtualScrollAreaWithSpacing extends VirtualScrollArea {

  private _spacer: Spacer;
  private _spacing: number;

  constructor(spacing: number) {
    super();
    this._spacer = new Spacer(spacing);
    this._spacing = spacing;
  }

  setSpacing(spacing: number): void {
    this._spacing = spacing;
    this._spacer.setSpacing(spacing);
  }

  protected _updateAutoscrollBottom(...mutator: Mutator[]): void {
    const patchedMutators = mutator.map(func => {
      return (newState: VirtualAreaState): void => {
        func(newState);
        newState.scrollableStates = this._makeStatesListWithSpacing(newState.scrollableStates);
      };
    });

    super._updateAutoscrollBottom(...patchedMutators);
  }

  private _makeStatesListWithSpacing(scrollableStates: VirtualScrollableState[]): VirtualScrollableState[] {
    let lastScrollableType = ScrollableType.NOTHING;

    const newStateList: VirtualScrollableState[] = [];
    for (let vss of scrollableStates) {
      if (vss.scrollable instanceof Spacer) {
        continue;
      }

      let currentScrollableType = ScrollableType.NOTHING;
      if (vss.scrollable instanceof EmbeddedViewer) {
        if (vss.scrollable.getViewerElement() == null) {
          currentScrollableType = ScrollableType.RUNNING_FRAME;
        } else {
          currentScrollableType = ScrollableType.FRAME;
        }
      } else {
        currentScrollableType = ScrollableType.NON_FRAME;
      }

      if (this._needsSpace(lastScrollableType, currentScrollableType)) {
        const spacingVirtualScrollableState: VirtualScrollableState = {
          scrollable: this._spacer,
          virtualHeight: 0,
          minHeight: this._spacing,
          reserveViewportHeight: this._spacing,
        
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

      lastScrollableType = currentScrollableType;
    }
    return newStateList;
  }

  private _needsSpace(previousType: ScrollableType, currentType: ScrollableType): boolean {
    /*
      This is the truth table we implement when deciding to add extra space.

      Previous \ Current | NOTHING | NON_FRAME | FRAME     | RUNNING_FRAME
      -------------------+---------+-----------+-----------+---------------
      NOTHING            |    -    |     -     |     -     |     -
      NON_FRAME          |    -    |     -     | add space | add space
      FRAME              |    -    | add space | add space | add space
      RUNNING_FRAME      |    -    |     -     | add space | add space
    */
    if (previousType === ScrollableType.NOTHING || currentType === ScrollableType.NOTHING) {
      return false;
    }
    if (currentType === ScrollableType.NON_FRAME) {
      return previousType === ScrollableType.FRAME;
    } else {
      return true;
    }
  }

  getScrollableHeightsIncSpacing(): VirtualScrollableHeight[] {
    const heights = this.getScrollableHeights();

    const result: VirtualScrollableHeight[] = [];
    let lastHeightInfo: VirtualScrollableHeight = null;
    for (let heightInfo of heights) {
      if (heightInfo.scrollable instanceof Spacer) {
        lastHeightInfo.height += this._spacing;
      } else {
        result.push(heightInfo);
      }

      lastHeightInfo = heightInfo;
    }

    return result;
  }
}
