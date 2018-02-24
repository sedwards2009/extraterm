/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import * as VirtualScrollArea from './VirtualScrollArea';
type SetterState = VirtualScrollArea.SetterState;

SourceMapSupport.install();

type Scrollbar = VirtualScrollArea.ScrollBar;
type VirtualScrollable = VirtualScrollArea.VirtualScrollable;

interface VirtualScrollableWithExtra extends VirtualScrollable {
  getScrollOffset(): number;
  getHeight(): number;
  setMinHeight(newMinHeight: number): void;
  setVirtualHeight(newVirtualHeight: number): void;
  setReserveViewportHeight(newReserveViewportHeight: number): void;
}

class FakeScrollable {
  _offset = null;
  _height = 10;

  constructor(public minHeight: number, public virtualHeight: number, public reserveViewportHeight: number) {
  }

  getMinHeight(): number {
    return this.minHeight;
  }
  
  setMinHeight(newMinHeight: number): void {
    this.minHeight = newMinHeight;
  }
  
  getVirtualHeight(containerHeight: number): number {
    return this.virtualHeight;
  }
  
  setVirtualHeight(newVirtualHeight: number): void {
    this.virtualHeight = newVirtualHeight;
  }
  
  getReserveViewportHeight(containerHeight: number): number {
    return this.reserveViewportHeight;
  }
  
  setReserveViewportHeight(newReserveViewportHeight: number): void {
    this.reserveViewportHeight = newReserveViewportHeight;
  }

  setDimensionsAndScroll(setterState: SetterState): void {
    this._height = setterState.height;
    this._offset = setterState.yOffset;
  }
  
  markVisible(visible: boolean): void {
  }


  getScrollOffset(): number {
    return this._offset;
  }
  
  getHeight(): number {
    return this._height;
  }
}

function SetUpScrollContainer(vsa: VirtualScrollArea.VirtualScrollArea, height: number): HTMLElement {
  const scrollContainer = <HTMLElement> {
    scrollTop: 0,
    
    getBoundingClientRect(): ClientRect {
      return { top: 0, bottom: 500, left: 0, right: 1024, height: height, width: 1024 };
    }
  };
  vsa.setScrollFunction( (offset: number): void => {
    scrollContainer.scrollTop = offset;
  });
  // vsa.setContainerHeightFunction( () => scrollContainer.getBoundingClientRect().height);
  return scrollContainer;
}

function SetupScrollable(vsa: VirtualScrollArea.VirtualScrollArea, minHeight: number,
    virtualHeight: number, reserveViewportHeight: number): VirtualScrollableWithExtra {

  const scrollable = new FakeScrollable(minHeight, virtualHeight, reserveViewportHeight);
  
  vsa.appendScrollable(scrollable);
  return scrollable;
}

interface SuperScrollbar extends Scrollbar {
  getLength(): number;
  getPosition(): number;
  getThumbSize(): number;
}

function SetupScrollbar(vsa: VirtualScrollArea.VirtualScrollArea): SuperScrollbar {
  let length = 123;
  let position = 7743;
  let thumbSize = 12;

  const scrollbar: SuperScrollbar =  {
    setLength: (len: number) => { length = len; },
    getLength: () => length,
    setPosition: (pos: number) => { position = pos; },
    getPosition: () => position,
    setThumbSize: (size: number): void => {thumbSize =size; },
    getThumbSize: () => thumbSize
  };
  vsa.setScrollbar(scrollbar);
  return scrollbar;
}

//-------------------------------------------------------------------------
// #######                            
//    #    ######  ####  #####  ####  
//    #    #      #        #   #      
//    #    #####   ####    #    ####  
//    #    #           #   #        # 
//    #    #      #    #   #   #    # 
//    #    ######  ####    #    ####  
//-------------------------------------------------------------------------

export function testBasic(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const scrollContainer = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 0);
  
  vsa.updateContainerHeight(scrollContainer.getBoundingClientRect().height);
  
  test.equal(scrollbar.getPosition(), 0);
  test.equal(scrollable.getScrollOffset(), 0);
  test.done();
}

export function testLong(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  test.equal(scrollbar.getPosition(), 1000);
  test.equal(scrollbar.getLength(), 1500);
  test.equal(scrollable.getScrollOffset(), 1000);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.getPosition(), 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);

  test.done();
}

export function test3Scrollables(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable1 = SetupScrollable(vsa, 500, 1500, 0);
  const scrollable2 = SetupScrollable(vsa, 500, 1500, 0);
  const scrollable3 = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  test.equal(scrollbar.getPosition(), 4000);
  test.equal(scrollbar.getLength(), 4500);
  test.equal(scrollable1.getScrollOffset(), 1000);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.getPosition(), 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable1.getScrollOffset(), 750);
  test.equal(scrollable2.getScrollOffset(), 0);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(1500);
  test.equal(scrollbar.getPosition(), 1500);
  test.equal(container.scrollTop, 500);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 0);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(2500);
  test.equal(scrollbar.getPosition(), 2500);
  test.equal(container.scrollTop, 500);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 1000);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(3500);
  test.equal(scrollbar.getPosition(), 3500);
  test.equal(container.scrollTop, 1000);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 1000);
  test.equal(scrollable3.getScrollOffset(), 500);

  test.done();
}

export function testVirtualHeightUpdate(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.getPosition(), 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);
  
  scrollable.setMinHeight(10);
  scrollable.setVirtualHeight(2000);
  scrollable.setReserveViewportHeight(0);
  vsa.updateScrollableSize(scrollable);
  
  test.equal(scrollbar.getPosition(), 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);
  
  test.done();
}

export function testVirtualHeightUpdateAtBottom(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  vsa.scrollTo(1000);
  test.equal(scrollbar.getPosition(), 1000);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 1000);
  
  scrollable.setMinHeight(10);
  scrollable.setVirtualHeight(2000);
  scrollable.setReserveViewportHeight(0);
  vsa.updateScrollableSize(scrollable);
  
  test.equal(scrollbar.getPosition(), 1500);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 1500);
  
  test.done();
}

export function testShortWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 1000);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  test.equal(scrollbar.getPosition(), 0);
  test.equal(scrollable.getHeight(), 700);
  test.equal(scrollable.getScrollOffset(), 0);
  test.equal(scrollbar.getLength(), 700);
  test.done();
}

export function testHeightWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  
  test.equal(scrollbar.getPosition(), 200);
  test.equal(scrollable.getScrollOffset(), 200);
  test.equal(scrollbar.getLength(), 700);
  test.done();
}

export function testBottomWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.updateContainerHeight(container.getBoundingClientRect().height);
  vsa.scrollToBottom();
  
  test.equal(scrollbar.getPosition(), 200);
  test.equal(scrollable.getScrollOffset(), 200);
  test.equal(scrollbar.getLength(), 700);
  test.done();
}

export function testBug(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 571);
  const scrollable1 = SetupScrollable(vsa, 0, 90, 0);
  const scrollable2 = SetupScrollable(vsa, 26, 0, 26);
  const scrollable3 = SetupScrollable(vsa, 0, 570, 0);
  vsa.updateContainerHeight(container.getBoundingClientRect().height);

  vsa.scrollTo(90);
  test.equal(scrollbar.getPosition(), 90);
  test.equal(container.scrollTop, 90);
  test.done();
}

export function testBug2(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea.VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 571);
                                        // min, virtual, reserve
  const scrollable1 = SetupScrollable(vsa,  0,  90,       0);
  const scrollable2 = SetupScrollable(vsa, 26, 585,      26);
  const scrollable3 = SetupScrollable(vsa,  0,  15,       0);
  vsa.updateContainerHeight(container.getBoundingClientRect().height);

  vsa.scrollTo(145);
  test.equal(scrollbar.getPosition(), 145);
  test.equal(container.scrollTop, 105);
  test.done();
}
