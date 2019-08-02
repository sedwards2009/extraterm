/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Disposable {
  dispose(): void;
}

let doLaterId: NodeJS.Timer = null;

interface DoLaterFunctionEntry {
  func: Function;
};
let laterList: DoLaterFunctionEntry[] = [];

function doLaterTimeoutHandler(): void {
  doLaterId = null;
  const workingList = [...laterList];
  laterList = [];
  workingList.forEach(f => {
    if (f.func != null) {
      f.func();
    }
  });
}

/**
 * Schedule a function to be executed later.
 * 
 * @param  func the function to be executed later
 * @param  msec Optional time delay in ms. Default is 0.
 * @return {LaterHandle} This object can be used to cancel the scheduled execution.
 */
export function doLater(func: Function, msec=0): Disposable {
  const doLaterFunction: DoLaterFunctionEntry = {
    func
  };
  laterList.push(doLaterFunction);

  if (doLaterId == null) {
    doLaterId = setTimeout(doLaterTimeoutHandler, msec);
  }

  return {
    dispose: () => {
      doLaterFunction.func = null;
    }
  };
}

let doLaterFrameId: number = -1;
let laterFrameList: Function[] = [];

function doLaterFrameHandler(): void {
  const workingList = [...laterFrameList];
  laterFrameList = [];
  
  window.cancelAnimationFrame(doLaterFrameId);
  doLaterFrameId = -1;
  
  workingList.forEach( f => f() );
}

/**
 * Schedule a function to run at the next animation frame.
 * 
 * @param func the function to execute next animation frame
 */
export function doLaterFrame(func: Function): Disposable {
  laterFrameList.push(func);
  if (doLaterFrameId === -1) {
    doLaterFrameId = window.requestAnimationFrame(doLaterFrameHandler);
  }
  return { dispose: () => {
    laterFrameList = laterFrameList.filter( f => f!== func );
  } };
}

/**
 * Run a function later, and debounce the trigger mechanism. Repeatable too.
 * 
 * This is a reusable way of setting up callback to be called later after
 * being triggered. Like `doLater()` it is possible to specify how long
 * later, and as the name suggests this can be triggered multiple times
 * but will only fire the callback once. After the callback has been
 * run then it can be immediately reused.
 */
export class DebouncedDoLater {
  private _laterDisposable: Disposable = null;

  constructor(private _callback: () => void, public delayMillis=0) {
  }

  trigger(): void {
    if (this._laterDisposable === null) {
      this._laterDisposable = doLater( () => {
        this._laterDisposable = null;
        this._callback();
      }, this.delayMillis);
    }
  }

  cancel(): void {
    if (this._laterDisposable !== null) {
      this._laterDisposable.dispose();
      this._laterDisposable = null;
    }
  }
  
  doNow(): void {
    this.cancel();
    this._callback();
  }
}
