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

interface ResizeObserver {
observe(target: Element): void;
unobserve(target: Element): void;
disconnect(): void
}

declare const ResizeObserver: {
new(callback: ResizeObserverCallback): ResizeObserver;
}
