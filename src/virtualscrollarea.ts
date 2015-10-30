/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import util = require('./gui/util');
import _  = require('lodash');

export interface VirtualScrollable {
  setHeight(height: number): void;
  setScrollOffset(y: number): void;
}

// Describes the state of one Scrollable
interface VirtualScrollableState {
  scrollable: VirtualScrollable;
  virtualHeight: number;
  minHeight: number;

  // Output - These values are set by the calculate() method.
  realHeight: number;
  virtualScrollYOffset: number;
}

interface VirtualAreaState {
  scrollbar: Scrollbar;
  virtualScrollYOffset: number;
  containerHeight: number;
  container: HTMLElement;
  
  // Output - 
  containerScrollYOffset: number;
  scrollableStates: VirtualScrollableState[];
}

export interface Scrollbar {
  length: number;     // The size of the complete range.
  position: number;   // The position of the thumb inside the range.
  thumbSize: number;  // The size of the thumb.
}

interface Mutator { 
  (newState: VirtualAreaState): void;
}

export class VirtualScrollArea {
  
  private _currentState: VirtualAreaState = null;
  
  constructor() {
    this._currentState = {
      scrollbar: null,
      virtualScrollYOffset: 0,
      containerHeight: 0,
      container: null,
      
      containerScrollYOffset: 0,
      scrollableStates: []
    };
  }
  
  getScrollYOffset(): number {
    return this._currentState.virtualScrollYOffset;
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

  appendScrollable(scrollable: VirtualScrollable, minHeight: number, virtualHeight: number): void {
    this._update( (newState) => {
      newState.scrollableStates.push( {
        scrollable: scrollable,
        virtualHeight: virtualHeight,
        minHeight: minHeight,
        
        realHeight: 0,
        virtualScrollYOffset: 0
      } );
    });
  }
  
  // removeScrollable(scrollable: VirtualScrollable): void {
  //   console.log("virtualscrollarea removeScrollable() Not implemented!!!"); // FIXME
  // }
  
  setScrollContainer(container: HTMLElement): void {
    this._update( (newState) => {
      newState.container = container;
    });
  }
  
  setScrollbar(scrollbar: Scrollbar): void {
    this._update( (newState) => {
      newState.scrollbar = scrollbar;
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
   * Signals to the VirtualScrollArea that the container has been resized.
   */
  resize(): void {
    this._update( (newState) => {
      newState.containerHeight = newState.container.getBoundingClientRect().height;
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
      TotalVirtualHeight(this._currentState) - this._currentState.containerHeight);
    this._update( (newState) => {
      newState.virtualScrollYOffset = cleanOffset;
    });    
    return cleanOffset;
  }

  /**
   * Update the virtual height and minimum height for a scrollable and relayout.
   *
   * @param scrollable the scrollable to update
   * @param newMinHeight the new minimum height
   * @param newVirtualHeight the new virtual height
   */
  updateScrollableHeights(scrollable: VirtualScrollable, newMinHeight: number, newVirtualHeight: number): void {
    const virtualHeight = TotalVirtualHeight(this._currentState);
    const isAtBottom = this._currentState.virtualScrollYOffset >= virtualHeight - this._currentState.containerHeight;
    
    const updateFunc = (newState: VirtualAreaState): void => {
      newState.scrollableStates.filter( (ss) => ss.scrollable === scrollable )
        .forEach( (ss) => {
          ss.virtualHeight = newVirtualHeight;
          ss.minHeight = newMinHeight;
        });
    };
    
    if (isAtBottom) {
      this._update(updateFunc, (newState: VirtualAreaState): void => {
        newState.virtualScrollYOffset = TotalVirtualHeight(newState) - newState.containerHeight;
      });
    } else {
      this._update(updateFunc);
    }
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
      Compute(newState);
    });
    
    ApplyState(this._currentState, newState);
    this._currentState = newState;
  }
}

/**
 * Compute the scroll positions in a Scroll the contents of the terminal to the given position.
 * 
 * @param state the state which needs to be recomputed
 */
function Compute(state: VirtualAreaState): boolean {
  if (state.container === null) {
    return false;
  }

  const viewPortHeight = state.containerHeight;

  // First update all of the scrollable heights based on their virtual heights and height of the container.
  for (let i=0; i<state.scrollableStates.length; i++) {
    const scrollable = state.scrollableStates[i];
    scrollable.realHeight = Math.max(scrollable.minHeight, Math.min(viewPortHeight, scrollable.virtualHeight));
  }

  // Compute the virtual height of the terminal contents.
  const virtualHeight = TotalVirtualHeight(state);

// log(`virtualHeight=${virtualHeight}`);

  // Clamp the requested position.
  // const pos = Math.min(Math.max(0, requestedY), Math.max(0, virtualHeight-viewPortHeight));
  // this._scrollYOffset = pos;
  const pos = state.virtualScrollYOffset;
// log(`pos=${pos}`);

  // We pretend that the scrollback is one very tall continous column of text etc. But this is fake.
  // Each code mirror viewer is only as tall as the terminal viewport. We scroll the contents of the
  // code mirrors to make it look like the user is scrolling through a big long list.
  //
  // The terminal contents can best be thought of as a stack of rectangles which contain a sliding 'view' box.
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
  // |+-----+| --- virtual scroll Y point
  // ||     ||     The viewport is positioned aligned with the scroll Y point.
  // |+-----+|     The scroller viewport is positioned at the top of the second code mirrro viewer.
  // |       |
  // +-------+
  //
  // The view ports are 'attracted' to the virtual Y position that we want to show.

  let realYBase = 0;
  let virtualYBase = 0;
  
  for (let i=0; i<state.scrollableStates.length; i++) {
    const scrollable = state.scrollableStates[i];
    const scrollableVirtualHeight = scrollable.virtualHeight;
    const currentScrollHeight = scrollableVirtualHeight - scrollable.realHeight;

    if (pos <= currentScrollHeight + virtualYBase) {
      const scrollOffset = Math.max(0, pos - virtualYBase);
// log(`1. heightInfo ${i}, element scrollTo=${scrollOffset}, el.scrollTop=${realYBase}`);
      scrollable.virtualScrollYOffset = scrollOffset;
      if (pos >= virtualYBase) {
        state.containerScrollYOffset = realYBase;
      }
      
    } else if (pos < virtualHeight + virtualYBase) {
      scrollable.virtualScrollYOffset = currentScrollHeight;

// log(`2. heightInfo ${i}, element scrollTo=${currentScrollHeight}, el.scrollTop=${realYBase + pos - virtualYBase - currentScrollHeight}`);
      if (pos >= virtualYBase) {
        state.containerScrollYOffset = realYBase + pos - virtualYBase - currentScrollHeight;
      }

    } else {
// log(`3. heightInfo ${i}, element scrollTo=${currentScrollHeight}`);
      scrollable.virtualScrollYOffset = currentScrollHeight;
    }

    realYBase += scrollable.realHeight;
    virtualYBase += scrollableVirtualHeight;
  }
}

/**
 * [TotalVirtualHeight description]
 * @param  {VirtualAreaState} state [description]
 * @return {number}                 [description]
 */
function TotalVirtualHeight(state: VirtualAreaState): number {
  // console.log("TotalVirtualHeight");
  // console.log(state.scrollableStates);

  const result = state.scrollableStates.reduce<number>(
    (accu: number, scrollable: VirtualScrollableState): number => accu + scrollable.virtualHeight, 0);
  // console.log("= " + result);
  return result;
}

/**
 * [ApplyState description]
 * @param {VirtualAreaState} oldState [description]
 * @param {VirtualAreaState} newState [description]
 */
function ApplyState(oldState: VirtualAreaState, newState: VirtualAreaState): void {
  const oldTotalHeight = TotalVirtualHeight(oldState);
  const newTotalHeight = TotalVirtualHeight(newState);
  
  // Update the scrollbar.
  if (newState.scrollbar !== null) {
    if (oldState.scrollbar !== newState.scrollbar || oldTotalHeight !== newTotalHeight) {
      newState.scrollbar.length = newTotalHeight;
    }
    if (oldState.scrollbar !== newState.scrollbar || oldState.virtualScrollYOffset !== newState.virtualScrollYOffset) {
      newState.scrollbar.position = newState.virtualScrollYOffset;
    }
  }
  
  // Index the list of previous Scrollables.
  const oldMap = new Map<VirtualScrollable, VirtualScrollableState>();
  oldState.scrollableStates.forEach( (scrollableState: VirtualScrollableState): void => {
    oldMap.set(scrollableState.scrollable, scrollableState);
  });

  // Update each Scrollable if needed.
  newState.scrollableStates.forEach( (newScrollableState: VirtualScrollableState): void => {
    const oldScrollableState = oldMap.get(newScrollableState.scrollable);
    if (oldScrollableState === undefined ||
        oldScrollableState.realHeight !== newScrollableState.realHeight) {
      newScrollableState.scrollable.setHeight(newScrollableState.realHeight);
    }
    if (oldScrollableState === undefined ||
        oldScrollableState.virtualScrollYOffset !== newScrollableState.virtualScrollYOffset) {
      newScrollableState.scrollable.setScrollOffset(newScrollableState.virtualScrollYOffset);
    }
  });
  
  // Update the Y offset for the container.
  if (oldState.containerScrollYOffset !== newState.containerScrollYOffset) {
    newState.container.scrollTop = newState.containerScrollYOffset;
  }
}

/**
 * 
 */
function DumpState(state: VirtualAreaState): void {
  console.log(JSON.stringify(state, null, "  "));
}
