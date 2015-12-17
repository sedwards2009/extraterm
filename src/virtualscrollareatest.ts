/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import virtualscrollarea = require('./virtualscrollarea');

sourceMapSupport.install();

const VirtualScrollArea = virtualscrollarea.VirtualScrollArea;

type Scrollbar = virtualscrollarea.Scrollbar;
type VirtualScrollable = virtualscrollarea.VirtualScrollable;

interface VirtualScrollableWithExtra extends VirtualScrollable {
  getScrollOffset(): number;
  getHeight(): number;
  setMinHeight(newMinHeight: number): void;
  setVirtualHeight(newVirtualHeight: number): void;
  setReserveViewportHeight(newReserveViewportHeight: number): void;
}

function SetUpScrollContainer(vsa: virtualscrollarea.VirtualScrollArea, height: number) {
  const scrollContainer = <HTMLElement> {
    scrollTop: 0,
    
    getBoundingClientRect(): ClientRect {
      return { top: 0, bottom: 500, left: 0, right: 1024, height: height, width: 1024 };
    }
  };
  vsa.setScrollContainer(scrollContainer);
  return scrollContainer;
}

function SetupScrollable(vsa: virtualscrollarea.VirtualScrollArea, minHeight: number,
    virtualHeight: number, reserveViewportHeight: number): VirtualScrollableWithExtra {

  const scrollable = {
    _offset: null,
    _height: 10,
    
    getMinHeight: (): number => {
      return minHeight;
    },
    
    setMinHeight(newMinHeight: number): void {
      minHeight = newMinHeight;
    },
    
    getVirtualHeight(containerHeight: number): number {
      return virtualHeight;
    },
    
    setVirtualHeight(newVirtualHeight: number): void {
      virtualHeight = newVirtualHeight;
    },
    
    getReserveViewportHeight(containerHeight: number): number {
      return reserveViewportHeight;
    },
    
    setReserveViewportHeight(newReserveViewportHeight: number): void {
      reserveViewportHeight = newReserveViewportHeight;
    },

    setScrollOffset(offset: number): void {
      this._offset = offset;
    },
    
    getScrollOffset(): number {
      return this._offset;
    },
    
    setHeight(height: number): void {
      this._height = height;
    },
    
    getHeight(): number {
      return this._height;
    }
  };
  
  vsa.appendScrollable(scrollable);
  return scrollable;
}

function SetupScrollbar(vsa: virtualscrollarea.VirtualScrollArea): Scrollbar {
  const scrollbar: Scrollbar =  {
    length: 37337,
    position: 7734,
    thumbSize: 42
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
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 0);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollable.getScrollOffset(), 0);
  test.done();
}

export function testLong(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollbar.length, 1500);
  test.equal(scrollable.getScrollOffset(), 0);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.position, 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);

  test.done();
}

export function test3Scrollables(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable1 = SetupScrollable(vsa, 500, 1500, 0);
  const scrollable2 = SetupScrollable(vsa, 500, 1500, 0);
  const scrollable3 = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollbar.length, 4500);
  test.equal(scrollable1.getScrollOffset(), 0);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.position, 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable1.getScrollOffset(), 750);
  test.equal(scrollable2.getScrollOffset(), 0);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(1500);
  test.equal(scrollbar.position, 1500);
  test.equal(container.scrollTop, 500);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 0);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(2500);
  test.equal(scrollbar.position, 2500);
  test.equal(container.scrollTop, 500);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 1000);
  test.equal(scrollable3.getScrollOffset(), 0);
  
  vsa.scrollTo(3500);
  test.equal(scrollbar.position, 3500);
  test.equal(container.scrollTop, 1000);
  test.equal(scrollable1.getScrollOffset(), 1000);
  test.equal(scrollable2.getScrollOffset(), 1000);
  test.equal(scrollable3.getScrollOffset(), 500);

  test.done();
}

export function testVirtualHeightUpdate(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.resize();
  
  vsa.scrollTo(750);
  test.equal(scrollbar.position, 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);
  
  scrollable.setMinHeight(10);
  scrollable.setVirtualHeight(2000);
  scrollable.setReserveViewportHeight(0);
  vsa.updateScrollableSize(scrollable);
  
  test.equal(scrollbar.position, 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);
  
  test.done();
}

export function testVirtualHeightUpdateAtBottom(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 0);
  
  vsa.resize();
  
  vsa.scrollTo(1000);
  test.equal(scrollbar.position, 1000);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 1000);
  
  scrollable.setMinHeight(10);
  scrollable.setVirtualHeight(2000);
  scrollable.setReserveViewportHeight(0);
  vsa.updateScrollableSize(scrollable);
  
  test.equal(scrollbar.position, 1500);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 1500);
  
  test.done();
}

export function testShortWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  SetUpScrollContainer(vsa, 1000);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollable.getHeight(), 700);
  test.equal(scrollable.getScrollOffset(), 0);
  test.equal(scrollbar.length, 700);
  test.done();
}

export function testHeightWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollable.getScrollOffset(), 0);
  test.equal(scrollbar.length, 700);
  test.done();
}

export function testBottomWithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 500, 200);
  
  vsa.resize();
  vsa.scrollToBottom();
  
  test.equal(scrollbar.position, 200);
  test.equal(scrollable.getScrollOffset(), 200);
  test.equal(scrollbar.length, 700);
  test.done();
}

export function testBottomLong(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 100);
  
  vsa.resize();
  
  test.equal(scrollbar.position, 0);
  test.equal(scrollbar.length, 1600);
  test.equal(scrollable.getScrollOffset(), 0);
  
  vsa.scrollTo(750);
  test.equal(scrollbar.position, 750);
  test.equal(container.scrollTop, 0);
  test.equal(scrollable.getScrollOffset(), 750);
  test.equal(vsa.getBottomScrollYOffset(), 1150);
  
  test.done();
}

export function testAddSubtractOffset(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable = SetupScrollable(vsa, 500, 1500, 100);
  
  vsa.resize();
  
  test.equal(vsa.addOffset(vsa.addOffset(750, 100), -100), 750);
  test.equal(vsa.addOffset(vsa.addOffset(0, 100), -100), 0);
  test.equal(vsa.addOffset(vsa.addOffset(850, 100), -100), 850);
  test.equal(vsa.addOffset(vsa.addOffset(1000, 100), -100), 1000);
  
  test.done();
}

export function testAddSubtractOffset3(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable1 = SetupScrollable(vsa, 500, 500, 0);
  const scrollable2 = SetupScrollable(vsa, 500, 1500, 0);
  const scrollable3 = SetupScrollable(vsa, 500, 2000, 0);
  vsa.resize();
  
  test.equal(vsa.addOffset(vsa.addOffset(750, 100), -100), 750);
  test.equal(vsa.addOffset(vsa.addOffset(0, 100), -100), 0);
  test.equal(vsa.addOffset(vsa.addOffset(850, 100), -100), 850);
  test.equal(vsa.addOffset(vsa.addOffset(1000, 100), -100), 1000);
  
  test.done();
}

export function testAddSubtractOffset3WithReserve(test: nodeunit.Test): void {
  const vsa = new VirtualScrollArea();
  
  const scrollbar = SetupScrollbar(vsa);
  const container = SetUpScrollContainer(vsa, 500);
  const scrollable1 = SetupScrollable(vsa, 500, 500, 100);
  const scrollable2 = SetupScrollable(vsa, 500, 1500, 50);
  const scrollable3 = SetupScrollable(vsa, 500, 2000, 50);
  vsa.resize();
  
  test.equal(vsa.addOffset(vsa.addOffset(750, 100), -100), 750);
  test.equal(vsa.addOffset(vsa.addOffset(0, 100), -100), 0);
  test.equal(vsa.addOffset(vsa.addOffset(850, 100), -100), 850);
  test.equal(vsa.addOffset(vsa.addOffset(1000, 100), -100), 1000);
  
  test.done();
}
