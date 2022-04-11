/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * A resource which can later be freed by calling `dispose()`.
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Function which represents a specific event which you can subscribe to.
 */
export interface Event<T> {
  (listener: (e: T) => any): Disposable;
}

/**
 * An event emitter which can be subscribe to to hear when this event is fired.
 */
export class EventEmitter<T> implements Disposable {

  private _listeners: ((t: T) => void)[] = [];

  /**
   * Dispose of and disconnect all listeners.
   */
  dispose(): void {
    this._listeners = [];
  }

  /**
   * Attach a listener to this event.
   *
   * @param listener the function to call when this event is triggered.
   * @return a `Disposable` which when used disconnects this listener from the event.
   */
  event: Event<T> = (listener: (t: T) => void): Disposable => {
    this._listeners.push(listener);
    return {
      dispose: () => {
        this._listeners = this._listeners.filter(item => item !== listener);
      }
    };
  };

  /**
   * Fire the event to all listeners.
   *
   * @param t the payload of the event.
   */
  fire(t: T): void {
    this._listeners.forEach(listener => listener(t));
  }

  /**
   * Returns true if this event emitter has at least on listener subscribed to it.
   *
   * @return true if this event emitter has at least on listener subscribed to it.
   */

  hasListeners(): boolean {
    return this._listeners.length !== 0;
  }
}
