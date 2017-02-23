/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

declare module ElementResizeDetector {
  interface Options {
    strategy?: 'scroll'
  }
  
  interface Detector {
    listenTo(el: HTMLElement, handler: (el: HTMLElement) => void): void;
    removeListener(el: HTMLElement, handler: (el: HTMLElement) => void): void;
    removeAllListener(el: HTMLElement): void;
    uninstall(): void;
  }

}

declare module 'element-resize-detector' {
  function elementResizeDetectorMaker(options?: ElementResizeDetector.Options): ElementResizeDetector.Detector;
  export = elementResizeDetectorMaker;
}
