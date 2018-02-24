/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
declare var elementResizeDetector: ElementResizeDetector.elementResizeDetectorMaker;
export = elementResizeDetector;
export as namespace ElementResizeDetector;

declare namespace ElementResizeDetector {
  interface Options {
    strategy?: 'scroll'
  }
  
  interface Detector {
    listenTo(el: HTMLElement, handler: (el: HTMLElement) => void): void;
    removeListener(el: HTMLElement, handler: (el: HTMLElement) => void): void;
    removeAllListener(el: HTMLElement): void;
    uninstall(): void;
  }

  interface elementResizeDetectorMaker {
    (options?: ElementResizeDetector.Options): ElementResizeDetector.Detector;
  }
}
