/**************************************************************************
 * Extra Chrome specific features and new APIs which need to be mixed in.
 *
 * The contents of this file is appending to lib.d.ts *before* processing.
 */

interface ResizeObserverEntry {
  readonly target: Element;
  readonly contentRect: DOMRectReadOnly;
}

interface ResizeObserverCallback {
  (entires: ResizeObserverEntry[], observer: ResizeObserver): void;
}
