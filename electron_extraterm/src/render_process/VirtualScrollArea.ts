/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as _ from 'lodash';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";

const _log = getLogger("VirtualScrollableArea");

export interface VirtualScrollable {
  /**
   * Gets the minimum height which this object can be set to.
   *
   * @return the minimum height
   */
  getMinHeight(): number;

  /**
   * Gets the height of the scrollable contents on this element.
   *
   * @param containerHeight the current height of the container holding this
   *                            VirtualScrollable object
   * @return the virtual height
   */
  getVirtualHeight(containerHeight: number): number;

  /**
   * Gets the height of reserved vertial space inside the object's viewport.
   *
   * @param  containerHeight the current height of the container holding this
   *                            VirtualScrollable object
   * @return the reserved height
   */
  getReserveViewportHeight(containerHeight: number): number;

  /**
   * Set the dimensions and scroll for this scrollable.
   *
   * @param setterState information about the new state and context
   */
  setDimensionsAndScroll(setterState: SetterState): void;

  /**
   * Signal to this scrollable that it has been made (in)visible.
   *
   * @param visible true if this has been made visible, or false to indicate been not visible.
   */
  markVisible(visible: boolean): void;
}

export interface SetterState {
  height: number;
  heightChanged: boolean;
  yOffset: number;
  yOffsetChanged: boolean;
  physicalTop: number;
  physicalTopChanged: boolean;
  containerHeight: number;
  containerHeightChanged: boolean;
  visibleBottomOffset: number;
  visibleBottomOffsetChanged: boolean;
}

// The name of a custom event that VirtualScrollables should emit when they need to be resized.
export const EVENT_RESIZE = "scrollable-resize";

/**
 * Emit a resize event.
 *
 * This utility function is meant for use by VirtualScrollable objects.
 *
 * @param el The element and VirtualScrollable object which needs to be resized.
 */
export function emitResizeEvent(el: VirtualScrollable & HTMLElement): void {
  const event = new CustomEvent(EVENT_RESIZE, { bubbles: true });
  el.dispatchEvent(event);
}

// Describes the state of one Scrollable
export interface VirtualScrollableState {
  scrollable: VirtualScrollable;
  virtualHeight: number;
  minHeight: number;
  reserveViewportHeight: number;

  // Output - These values are set by the calculate() method.
  realHeight: number;
  realTop: number;
  virtualScrollYOffset: number;
  virtualTop: number;
  visible: boolean;
}

export interface VirtualAreaState {
  scrollbar: ScrollBar;
  virtualScrollYOffset: number;
  containerHeight: number;
  scrollFunction: (offset: number) => void;
  setTopFunction: (scrollable: VirtualScrollable, top: number) => void;
  markVisibleFunction: (scrollable: VirtualScrollable, visible: boolean) => void;
  visibleBottomOffset: number;

  // Output -
  containerScrollYOffset: number;
  scrollableStates: VirtualScrollableState[];

  intersectIndex: number;
  realScrollYOffset: number;
}

export interface ScrollBar {
  length: number;       // The size of the complete range.
  position: number;     // The position of the thumb inside the range.
  thumbSize: number;    // The size of the thumb.
}

export interface VirtualScrollableHeight {
  readonly scrollable: VirtualScrollable;
  height: number;
}

export interface Mutator {
  (newState: VirtualAreaState): void;
}

const emptyState: VirtualAreaState = {
  scrollbar: null,
  virtualScrollYOffset: 0,
  containerHeight: 0,
  scrollFunction: null,
  setTopFunction: null,
  markVisibleFunction: null,
  visibleBottomOffset: 0,

  containerScrollYOffset: 0,
  scrollableStates: [],

  intersectIndex: -1,
  realScrollYOffset: 0
};

export class VirtualScrollArea {

  protected _currentState: VirtualAreaState = null;

  private _log: Logger = null;

  constructor() {
    this._log = getLogger("VirtualScrollArea", this);
    this._currentState = emptyState;
  }

  getScrollYOffset(): number {
    return this._currentState.virtualScrollYOffset;
  }

  getScrollContainerHeight(): number {
    return this._currentState.containerHeight;
  }

  getScrollableTop(scrollable: VirtualScrollable): number {
    for (const s of this._currentState.scrollableStates) {
      if (s.scrollable === scrollable) {
        return s.virtualTop;
      }
    }
    return null;
  }

  getScrollableVisible(scrollable: VirtualScrollable): boolean {
    for (const s of this._currentState.scrollableStates) {
      if (s.scrollable === scrollable) {
        return s.visible;
      }
    }
    return null;
  }

  getScrollableVirtualHeight(scrollable: VirtualScrollable): number {
    for (const state of this._currentState.scrollableStates) {
      if (state.scrollable === scrollable) {
        return state.virtualHeight;
      }
    }
    return null;
  }

  getVirtualHeight(): number {
    return this._totalVirtualHeight(this._currentState);
  }

  getScrollableHeights(): VirtualScrollableHeight[] {
    return this._computeScrollableHeights(this._currentState.scrollableStates);
  }

  protected _computeScrollableHeights(vssList: VirtualScrollableState[]): VirtualScrollableHeight[] {
    return vssList.map<VirtualScrollableHeight>( (state): VirtualScrollableHeight => {
      const smallState: VirtualScrollableHeight = {
        scrollable: state.scrollable,
        height: state.virtualHeight + state.reserveViewportHeight
      };
      return smallState;
    });
  }

  //-----------------------------------------------------------------------
  //
  //  #####
  // #     # ###### #####    #    # #####
  // #       #        #      #    # #    #
  //  #####  #####    #      #    # #    #
  //       # #        #      #    # #####
  // #     # #        #      #    # #
  //  #####  ######   #       ####  #
  //
  //-----------------------------------------------------------------------

  appendScrollable(scrollable: VirtualScrollable): void {
    const minHeight = scrollable.getMinHeight();
    const virtualHeight = scrollable.getVirtualHeight(this.getScrollContainerHeight());
    const reserveViewportHeight = scrollable.getReserveViewportHeight(this.getScrollContainerHeight());

    this._updateAutoscrollBottom( (newState) => {
      newState.scrollableStates.push( {
        scrollable: scrollable,
        virtualHeight: virtualHeight,
        minHeight: minHeight,
        reserveViewportHeight: reserveViewportHeight,

        realHeight: 0,
        realTop: 0,
        virtualScrollYOffset: 0,
        virtualTop: 0,
        visible: false
      } );
    });
  }

  removeScrollable(scrollable: VirtualScrollable): void {
    this._updateAutoscrollBottom( (newState) => {

      let currentYOffset = newState.virtualScrollYOffset;
      let accu = 0;
      for (let i=0; i<newState.scrollableStates.length; i++) {
        const currentScrollableState = newState.scrollableStates[i];
        const currentHeight = currentScrollableState.virtualHeight + currentScrollableState.reserveViewportHeight;

        if (currentScrollableState.scrollable === scrollable) {

          if (currentYOffset >= accu) {
            if (currentYOffset < accu + currentHeight) {
              // currentYOffset is inside the scrollable we need to remove.
              currentYOffset = accu;
            } else {
              // currentYOffset is after the scrollable we need to remove.
              currentYOffset -= currentHeight;
            }
          }
          break;
        }

        accu += currentHeight;
      }

      newState.scrollableStates = newState.scrollableStates.filter( (state) => state.scrollable !== scrollable);
    });
  }

  replaceScrollable(oldScrollable: VirtualScrollable, newScrollable: VirtualScrollable): void {
    const minHeight = newScrollable.getMinHeight();
    const virtualHeight = newScrollable.getVirtualHeight(this.getScrollContainerHeight());
    const reserveViewportHeight = newScrollable.getReserveViewportHeight(this.getScrollContainerHeight());

    this._updateAutoscrollBottom( (newState) => {
      newState.scrollableStates.filter( (state) => state.scrollable === oldScrollable )
        .forEach( (state) => {
          state.scrollable = newScrollable;
          state.virtualHeight = virtualHeight;
          state.minHeight = minHeight;
          state.reserveViewportHeight = reserveViewportHeight;
          state.realHeight = 0;
          state.virtualScrollYOffset = 0;
        });
    });
  }

  setScrollFunction(scrollFunction: (offset: number) => void): void {
    this._update( (newState) => {
      newState.scrollFunction = scrollFunction;
    });
  }

  setScrollbar(scrollbar: ScrollBar): void {
    this._update( (newState) => {
      newState.scrollbar = scrollbar;
    });
  }

  /**
   * Set a function to be used for positioning the top of a scrollable.
   *
   * @param func function which should return a BulkDOMOperation which
   *              positions the given scrollable's top at the new top.
   */
  setSetTopFunction(func: (scrollable: VirtualScrollable, top: number) => void): void {
    this._update( (newState) => {
      newState.setTopFunction = func;
    });
  }

  setMarkVisibleFunction(func: (scrollable: VirtualScrollable, visible: boolean) => void): void {
    this._update( (newState) => {
      newState.markVisibleFunction = func;
    });
  }

  /**
   * Set the offset from the bottom of the viewport to the visible bottom of the window on screen.
   */
  setViewportBottomOffset(offset: number): void {
    this._update( (newState) => {
      newState.visibleBottomOffset = offset;
    });
  }

  //-----------------------------------------------------------------------
  //
  //    #
  //   # #    ####  ##### #  ####  #    #  ####
  //  #   #  #    #   #   # #    # ##   # #
  // #     # #        #   # #    # # #  #  ####
  // ####### #        #   # #    # #  # #      #
  // #     # #    #   #   # #    # #   ## #    #
  // #     #  ####    #   #  ####  #    #  ####
  //
  //-----------------------------------------------------------------------

  /**
   * Sets a new height for the container.
   *
   * @param containerHeight the new height of the container.
   */
  updateContainerHeight(containerHeight: number): void {
    this._updateAutoscrollBottom( (newState) => {
      newState.containerHeight = containerHeight;
    });
  }

  /**
   * Scrolls the area to the given Y offset.
   *
   * @param offset the desired Y offset
   * @return the actual offset used after clamping it into the valid range of offsets
   */
  scrollTo(offset: number): number {
    // Clamp the requested offset.
    const cleanOffset = Math.min(Math.max(0, offset),
                                 this._totalVirtualHeight(this._currentState) - this._currentState.containerHeight);
    this._update( (newState) => {
      newState.virtualScrollYOffset = cleanOffset;
    });
    return cleanOffset;
  }

  /**
   * Scroll down to the extreme bottom.
   *
   * @return the actual offset used after clamping it into the valid range of offsets
   */
  scrollToBottom(): number {
    if (this._currentState.scrollableStates.length === 0) {
      return 0;
    }
    return this.scrollTo(this._totalVirtualHeight(this._currentState) - this._currentState.containerHeight);
  }

  /**
   * Update the virtual height and minimum height for a scrollable and relayout.
   *
   * @param virtualScrollable the scrollable to update
   */
  updateScrollableSize(virtualScrollable: VirtualScrollable): void {
    const newMinHeight = virtualScrollable.getMinHeight();
    const newVirtualHeight = virtualScrollable.getVirtualHeight(this.getScrollContainerHeight());
    const newReserveViewportHeight = virtualScrollable.getReserveViewportHeight(this.getScrollContainerHeight());

    // Quickly check to see if anything really changed. Search from the newest back into the scrollback.
    for (let i=this._currentState.scrollableStates.length-1; i>=0; i--) {
      const ss = this._currentState.scrollableStates[i];
      if (ss.scrollable === virtualScrollable) {
        if (ss.virtualHeight === newVirtualHeight && ss.minHeight === newMinHeight &&
            ss.reserveViewportHeight === newReserveViewportHeight) {
          return; // Nothing needs to be done.
        } else {
          break;  // Get to work.
        }
      }
    }

    this._updateAutoscrollBottom( (newState: VirtualAreaState): void => {
      newState.scrollableStates.filter( (ss) => ss.scrollable === virtualScrollable )
        .forEach( (ss) => {
          ss.virtualHeight = newVirtualHeight;
          ss.minHeight = newMinHeight;
          ss.reserveViewportHeight = newReserveViewportHeight;
        });
    } );
  }

  /**
   * Update the virtual height and minimum height for all scrollables and then relayout.
   */
  updateScrollableSizes(scrollables: VirtualScrollable[]): void {
    const scrollablesSet = new Set(scrollables);

    this._updateAutoscrollBottom( (newState: VirtualAreaState): void => {
      newState.scrollableStates
        .forEach( (ss) => {
          if (scrollablesSet.has(ss.scrollable)) {
            const newMinHeight = ss.scrollable.getMinHeight();
            const newVirtualHeight = ss.scrollable.getVirtualHeight(this.getScrollContainerHeight());
            const newReserveViewportHeight = ss.scrollable.getReserveViewportHeight(this.getScrollContainerHeight());

            ss.virtualHeight = newVirtualHeight;
            ss.minHeight = newMinHeight;
            ss.reserveViewportHeight = newReserveViewportHeight;
          }
        });
    } );
  }

  /**
   * Scroll the view such that a range is visible.
   *
   * @param topY the Y offset of the top of the range
   * @param bottomY the Y offset of the bottom of the range
   * @return the actual offset used after clamping it into the valid range of offsets
   */
  scrollIntoView(topY: number, bottomY: number): number {
    const intersectedScrollable = this._currentState.scrollableStates[this._currentState.intersectIndex];
    const viewPortTop = this._currentState.virtualScrollYOffset + intersectedScrollable.reserveViewportHeight;

    let yOffset = this._currentState.virtualScrollYOffset;
    if (topY < viewPortTop) {
      yOffset -= viewPortTop - topY;
    }

    const viewPortBottom = this._currentState.virtualScrollYOffset + this._currentState.containerHeight;
    if (bottomY > viewPortBottom) {
      yOffset += bottomY - viewPortBottom;
    }
    if (yOffset !== this._currentState.virtualScrollYOffset) {
      return this.scrollTo(yOffset);
    } else {
      return this._currentState.virtualScrollYOffset;
    }
  }

  /**
   * Push the current state down to all of the VirtualScrollables and the scrollbar.
   */
  reapplyState(): void {
    const bogusState: VirtualAreaState = {
      scrollbar: null,
      virtualScrollYOffset: -1,
      containerHeight: -1,
      scrollFunction: null,
      setTopFunction: null,
      markVisibleFunction: null,

      visibleBottomOffset: 0,
      containerScrollYOffset: -1,
      scrollableStates: [],

      intersectIndex: -1,
      realScrollYOffset: -1
    };

    this._applyState(bogusState, this._currentState, this._log);
  }

  dumpState(): void {
    DumpState(this._currentState);
  }

  //-----------------------------------------------------------------------
  //
  // ######
  // #     # #####  # #    #   ##   ##### ######
  // #     # #    # # #    #  #  #    #   #
  // ######  #    # # #    # #    #   #   #####
  // #       #####  # #    # ######   #   #
  // #       #   #  #  #  #  #    #   #   #
  // #       #    # #   ##   #    #   #   ######
  //
  //-----------------------------------------------------------------------

  /**
   * Update the state and apply it to the DOM.
   *
   * @param  {VirtualAreaState} mutator [description]
   * @return {[type]}                   [description]
   */

  private _update(...mutator: Mutator[]): void {
    // Carefully clone our state without jumping into any references to external objects.
    const newState = _.clone(this._currentState);
    newState.scrollableStates = this._currentState.scrollableStates.map<VirtualScrollableState>(_.clone.bind(_));

    mutator.forEach( (m) => {
      m(newState);
      this._compute(newState);
    });

    this._applyState(this._currentState, newState, this._log);
    // DumpState(newState);
    this._currentState = newState;
  }

  protected _updateAutoscrollBottom(...mutator: Mutator[]): void {
    // Carefully clone our state without jumping into any references to external objects.
    const newState = _.clone(this._currentState);
    newState.scrollableStates = this._currentState.scrollableStates.map<VirtualScrollableState>(_.clone.bind(_));

    const virtualHeight = this._totalVirtualHeight(this._currentState);
    const TOLERANCE = 4;
    const isAtBottom = (this._currentState.virtualScrollYOffset + TOLERANCE) >= virtualHeight - this._currentState.containerHeight;

    for (let i=0; i<mutator.length; i++) {
      mutator[i](newState);
      this._compute(newState);
    }

    if (isAtBottom) {
      newState.virtualScrollYOffset = Math.max(0, this._totalVirtualHeight(newState) - newState.containerHeight);
      this._compute(newState);
    }

    this._applyState(this._currentState, newState, this._log);
    this._currentState = newState;
  }

  /**
   * Compute the scroll positions in a Scroll the contents of the terminal to the given position.
   *
   * @param state the state which needs to be recomputed
   */
  protected _compute(state: VirtualAreaState): void {
    if (state.scrollFunction === null) {
      return;
    }

    // We pretend that the scrollback is one very tall continous column of text etc. But this is fake.
    // Each code mirror viewer is only as tall as the terminal viewport. We scroll the contents of the
    // code mirrors to make it look like the user is scrolling through a big long list.
    //
    // The terminal contents can best be thought of as a stack of rectangles which contain a sliding 'viewport' box.
    // +-------+
    // |       | <- First code mirror viewer.
    // |       |
    // |       |
    // |       |
    // |+-----+|
    // ||     || <- This little box is the part which shown inside the code mirror view port.
    // |+-----+|    This is is 'pulled' to bottom in the direction of the scroll Y point
    // +-------+
    // +-------+
    // |       | <- second code mirror viewer.
    // |       |
    // |       |
    // |+-----+| ---+ virtual scroll Y point
    // ||     ||    | <-- The viewport is positioned aligned with the scroll Y point.
    // |+-----+| ---+    The scroller viewport is positioned at the top of the second code mirror viewer.
    // |       |
    // +-------+
    //
    // The view ports are 'attracted' to the virtual Y position that we want to show.

    const viewPortHeight = state.containerHeight;
    const pos = state.virtualScrollYOffset;
    let realScrollableTop = 0;    // As we loop below we keep track of where we are inside the 'real' container
    let virtualScrollableTop = 0; // As we loop below we keep track of where wa are inside the virtual space

    // Loop through each scrollable and up its virtual scroll Y offset and also
    // compute the 'real' scroll Y offset for the container.
    for (let i=0; i<state.scrollableStates.length; i++) {
      const scrollable = state.scrollableStates[i];
      scrollable.virtualTop = virtualScrollableTop;
      scrollable.realTop = realScrollableTop;

      // Each scrollable can be in one of a number of relationships with the viewport.
      // Our first task is to determine which relationship we have.

      if (scrollable.virtualHeight + scrollable.reserveViewportHeight <= viewPortHeight) {
        // This scrollable fits completely inside the viewport. It may actually be much smaller than the viewport.
        const realHeight = Math.max(scrollable.minHeight, scrollable.virtualHeight + scrollable.reserveViewportHeight);
        scrollable.realHeight = realHeight;

        // No virtual scrolling is ever needed if the scrollable fits entirely inside the viewport.
        scrollable.virtualScrollYOffset = 0;

        const virtualScrollableBottom = virtualScrollableTop + realHeight;
        if (pos >= virtualScrollableTop && pos <  virtualScrollableBottom) {
          // We can now compute the container scroll offset if the top of the viewport intersects the scrollable.
          state.containerScrollYOffset = realScrollableTop + pos - virtualScrollableTop;
          state.intersectIndex = i;
          state.realScrollYOffset = realScrollableTop;
          scrollable.visible = true;
        } else {
          const posBottom = pos + viewPortHeight;
          scrollable.visible = ! (pos >= virtualScrollableBottom || posBottom < virtualScrollableTop);
        }

      } else {
        // This scrollable is big enough to cover the viewport and needs to do virtual scrolling.
        const virtualScrollableHeight = Math.max(scrollable.minHeight,
          scrollable.virtualHeight + scrollable.reserveViewportHeight);
        const virtualScrollableBottom = virtualScrollableHeight + virtualScrollableTop;
        scrollable.realHeight = Math.max(scrollable.minHeight, viewPortHeight);

        if (pos < virtualScrollableBottom) {
          // The end of the current scrollable is lower/after the point we want to scroll to.

    // log(`1. heightInfo ${i}, element scrollTo=${scrollOffset}, el.scrollTop=${realYBase}`);
          if (pos >= virtualScrollableTop) {
            // +------------+
            // |            | ---+  <-- Viewport
            // | Scrollable |    |
            // |            |    |
            // +------------+    :
            state.intersectIndex = i;
            state.realScrollYOffset = realScrollableTop;

            if (pos + viewPortHeight >= virtualScrollableBottom) {
              // +------------+
              // |            | ---+  <-- Viewport
              // | Scrollable |    |
              // |            |    |
              // +------------+    |
              //                ---+
              scrollable.virtualScrollYOffset = pos - virtualScrollableTop;
              state.containerScrollYOffset = realScrollableTop + (pos + viewPortHeight - virtualScrollableBottom);

              scrollable.visible = pos < virtualScrollableBottom;

            } else {
              // +------------+
              // |            | ---+  <-- Viewport
              // | Scrollable |    |
              // |            | ---+
              // +------------+
              scrollable.virtualScrollYOffset = pos - virtualScrollableTop;
              // The top of the scrollable is aligned with the top of the viewport.
              state.containerScrollYOffset = realScrollableTop;
              scrollable.visible = true;
            }
          } else {
            //                ---+
            // +------------+    |
            // |            |    | <-- Viewport
            // | Scrollable |    |
            // |            | ---+
            // +------------+
            scrollable.virtualScrollYOffset = 0;

            const posBottom = pos + viewPortHeight;
            scrollable.visible = posBottom >= virtualScrollableTop;
          }

        } else {
            // +------------+
            // | Scrollable |
            // +------------+
            //                ---+
            //                   | <-- Viewport
          scrollable.virtualScrollYOffset = virtualScrollableHeight - (viewPortHeight - scrollable.reserveViewportHeight);
          scrollable.visible = false;

    // log(`2. heightInfo ${i}, element scrollTo=${currentScrollHeight}, el.scrollTop=${realYBase + pos - virtualYBase - currentScrollHeight}`);
          // if (pos >= virtualScrollableTop) {
          //   state.containerScrollYOffset = realScrollableTop + pos - virtualScrollableTop - virtualScrollableHeight;
          // }
        }
      }
      realScrollableTop += scrollable.realHeight;
      virtualScrollableTop += scrollable.virtualHeight + scrollable.reserveViewportHeight;
    }
  }

  /**
   * [TotalVirtualHeight description]
   * @param  {VirtualAreaState} state [description]
   * @return {number}                 [description]
   */
  protected _totalVirtualHeight(state: VirtualAreaState): number {
    const result = state.scrollableStates.reduce<number>(
      (accu: number, scrollable: VirtualScrollableState): number =>
        accu + Math.max(scrollable.minHeight, scrollable.virtualHeight + scrollable.reserveViewportHeight), 0);
    return result;
  }

  private _applyState(oldState: VirtualAreaState, newState: VirtualAreaState, log: Logger): void {
    this._applyScrollbarState(oldState, newState, log);

    // Index the list of previous Scrollables.
    const oldMap = new Map<VirtualScrollable, VirtualScrollableState>();
    oldState.scrollableStates.forEach( (scrollableState: VirtualScrollableState): void => {
      oldMap.set(scrollableState.scrollable, scrollableState);
    });

    const visibleBottomOffsetChanged = oldState.visibleBottomOffset !== newState.visibleBottomOffset;

    // Update each Scrollable if needed.
    newState.scrollableStates.forEach( (newScrollableState: VirtualScrollableState): void => {
      const oldScrollableState = oldMap.get(newScrollableState.scrollable);

      const heightChanged = oldScrollableState === undefined ||
                              oldScrollableState.realHeight !== newScrollableState.realHeight;
      const yOffsetChanged = oldScrollableState === undefined ||
          oldScrollableState.virtualScrollYOffset !== newScrollableState.virtualScrollYOffset;

      const newPhysicalTop = newState.containerScrollYOffset - newScrollableState.realTop;
      const physicalTopChanged = oldScrollableState === undefined ? true
                      : newPhysicalTop !== oldState.containerScrollYOffset - oldScrollableState.realTop;

      const containerHeightChanged = oldState.containerHeight !== newState.containerHeight;

      const visibleUpdateNeeded = (oldScrollableState === undefined ||
              oldScrollableState.visible !== newScrollableState.visible) && newState.markVisibleFunction != null;

      if (visibleUpdateNeeded && newScrollableState.visible) {
        // If the scrollable should be visible then do it now before the other update methods.
        // Those methods may assume that it is visible and in the DOM.
        newState.markVisibleFunction(newScrollableState.scrollable, true);
        newScrollableState.scrollable.markVisible(true);
      }

      if (heightChanged || yOffsetChanged || physicalTopChanged || containerHeightChanged || visibleBottomOffsetChanged) {
        const setterState: SetterState = {
          height: newScrollableState.realHeight,
          heightChanged,
          yOffset: newScrollableState.virtualScrollYOffset,
          yOffsetChanged,
          physicalTop: newPhysicalTop,
          physicalTopChanged,
          containerHeight: newState.containerHeight,
          containerHeightChanged,
          visibleBottomOffset: newState.visibleBottomOffset,
          visibleBottomOffsetChanged
        };
        newScrollableState.scrollable.setDimensionsAndScroll(setterState);
      }

      if (newState.setTopFunction != null && (oldScrollableState === undefined ||
          oldScrollableState.realTop !== newScrollableState.realTop)) {
        newState.setTopFunction(newScrollableState.scrollable, newScrollableState.realTop);
      }

      if (visibleUpdateNeeded && ! newScrollableState.visible) {
        newScrollableState.scrollable.markVisible(false);
        newState.markVisibleFunction(newScrollableState.scrollable, false);
      }
    });

    // Update the Y offset for the container.
    if (oldState.containerScrollYOffset !== newState.containerScrollYOffset) {
      newState.scrollFunction(newState.containerScrollYOffset);
    }
  }

  private _applyScrollbarState(oldState: VirtualAreaState, newState: VirtualAreaState, log: Logger): void {
    const oldTotalHeight = this._totalVirtualHeight(oldState);
    const newTotalHeight = this._totalVirtualHeight(newState);

    // Update the scrollbar.
    if (newState.scrollbar !== null) {
      if (oldState.scrollbar !== newState.scrollbar || oldTotalHeight !== newTotalHeight) {
        newState.scrollbar.length = newTotalHeight;
      }
      if (oldState.scrollbar !== newState.scrollbar || oldState.virtualScrollYOffset !== newState.virtualScrollYOffset) {
        newState.scrollbar.position = newState.virtualScrollYOffset;
      }
    }
  }
}

export function DumpState(state: VirtualAreaState): void {
  console.log(VirtualAreaStateToString(state));
}

function VirtualAreaStateToString(state: VirtualAreaState): string {
  return `{
    scrollbar: ${ElementToString(state.scrollbar)},
    virtualScrollYOffset: ${state.virtualScrollYOffset},
    containerHeight: ${state.containerHeight},

    // Output
    containerScrollYOffset: ${state.containerScrollYOffset},
    scrollableStates: [${state.scrollableStates.map(VirtualScrollableStateToString).join(',\n')}],
    intersectIndex: ${state.intersectIndex},
    realScrollYOffset: ${state.realScrollYOffset}
  }`;
}

function VirtualScrollableStateToString(state: VirtualScrollableState): string {
  return `    {
      scrollable: ${ElementToString(state.scrollable)},
      virtualHeight: ${state.virtualHeight},
      minHeight: ${state.minHeight},
      reserveViewportHeight: ${state.reserveViewportHeight},
      // Output
      realHeight: ${state.realHeight},
      realTop: ${state.realTop},
      virtualScrollYOffset: ${state.virtualScrollYOffset},
      virtualTop: ${state.virtualTop},
      visible: ${state.visible}
    }`;
}

function ElementToString(element: any): string {
  if (element === null || element === undefined) {
    return "null";
  }
  return (<any> element).tagName;
}
