/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";


/**
 * An event emitter which can be subscribed to receive events.
 */
export class ErrorTolerantEventEmitter<T> implements ExtensionApi.Disposable {

  private _listeners: ((t: T) => void)[] = [];
  #log: ExtensionApi.Logger = null;
  #name: string = null;

  constructor(name: string, logger: ExtensionApi.Logger) {
    this.#log = logger;
    this.#name = name;
  }

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
  event: ExtensionApi.Event<T> = (listener: (t: T) => void): ExtensionApi.Disposable => {
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
    this._listeners.forEach(listener => {
      try {
        listener(t);
      } catch(ex) {
        this.#log.warn(`An exception occured while sending '${this.#name}': ${ex}`);
      }
    });
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
