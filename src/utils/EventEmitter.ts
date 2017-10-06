/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Disposable, Event} from 'extraterm-extension-api';

// FIXME docs

export class EventEmitter<T> {

  private _listeners: ((t: T) => void)[] = [];

  event: Event<T> = (listener: (t: T) => void): Disposable => {
    this._listeners.push(listener);
    return {
      dispose: () => {
        this._listeners = this._listeners.filter(item => item !== listener);
      }
    };
  }

  fire(t: T): void {
    this._listeners.forEach(listener => listener(t));
  }
}
