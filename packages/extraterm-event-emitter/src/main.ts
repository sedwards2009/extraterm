/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable, Event} from 'extraterm-extension-api';


/**
 * An event emitter which can be subscribe to to hear when this event is fired.
 */
export class EventEmitter<T> implements Disposable {

  private _listeners: ((t: T) => void)[] = [];
  private _disposables = new DisposableHolder();

  /**
   * Dispose of and disconnect all listeners.
   */
  dispose(): void {
    this._disposables.dispose();
  }

  /**
   * Attach a listener to this event.
   * 
   * @param listener the function to call when this event is triggered.
   * @return a `Disposible` which when used disconnects this listener from the event.
   */
  event: Event<T> = (listener: (t: T) => void): Disposable => {
    this._listeners.push(listener);
    return this._disposables.add({
      dispose: () => {
        this._listeners = this._listeners.filter(item => item !== listener);
      }});
  }

  /**
   * Fire the event to all listeners.
   * 
   * @param t the payload of the event.
   */
  fire(t: T): void {
    this._listeners.forEach(listener => listener(t));
  }
}

/**
 * A simple class for holding on to and disposing of multiple Disposable objects.
 */
class DisposableHolder implements Disposable {

  private _list: Disposable[] = [];

  /**
   * Add an object to the list of objects.
   * 
   * @param d a Disposable object to hold on to.
   * @return the object which was added.
   */
  add<D extends Disposable>(d: D): D {
    this._list.push(d);
    return d;
  }

  dispose(): void {
    for (const d of this._list) {
      d.dispose();
    }
    this._list = [];
  }
}
