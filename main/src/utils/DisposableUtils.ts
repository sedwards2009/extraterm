/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Disposable} from '@extraterm/extraterm-extension-api';
import { WidgetEventTypes } from '@nodegui/nodegui';

/**
 * Type guard to detecting objects which support the Disposable interface.
 */
export function isDisposable(it: any): it is Disposable {
  if (it == null) {
    return false;
  }
  return 'dispose' in it;
}

/**
 * A simple class for holding on to and disposing of multiple Disposable objects.
 */
export class DisposableHolder implements Disposable {

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


interface TrackedPair<T> {
  id: number;
  thing: T;
}

export class DisposableItemList<T> {

  private _things: TrackedPair<T>[] = [];
  private _idCounter = 0;

  add(thing: T): Disposable {
    this._idCounter++;
    const pair = {id: this._idCounter, thing};
    this._things.push(pair);
    return { dispose: () => this._remove(pair)};
  }

  private _remove(pair: TrackedPair<T>): void {
    const index = this._things.indexOf(pair);
    if (index !== -1) {
      this._things.splice(index, 1);
    }
  }

  forEach(func: (t: T) => void): void {
    this._things.forEach(pair => func(pair.thing));
  }

  map<R>(func: (t: T) => R): R[] {
    return this._things.map<R>(pair => func(pair.thing));
  }
}

export interface EventEmitter<Signals> {
  addEventListener<SignalType extends keyof Signals>(signalType: SignalType | WidgetEventTypes, callback: Signals[SignalType]): void;
  removeEventListener  <SignalType extends keyof Signals>(signalType: SignalType | WidgetEventTypes, callback: Signals[SignalType]): void;
}

/**
 * A disposable holder for holding and disposing of registered event
 * listeners.
 *
 * This class wraps instances which implements the `EventEmitter` interface,
 * and exposes a `addEventListener()` method which also remembers the
 * registation and can unregister event listeners when `dispose()` is called.
 */
export class DisposableEventHolder<Signals> implements Disposable {
  #emitter: EventEmitter<Signals> = null;
  #disposableHolder: DisposableHolder = null;

  constructor(emitter: EventEmitter<Signals>) {
    this.#emitter = emitter;
    this.#disposableHolder = new DisposableHolder();
  }

  addEventListener<SignalType extends keyof Signals>(signalType: SignalType | WidgetEventTypes, callback: Signals[SignalType]): void {
    this.#emitter.addEventListener(signalType, callback);
    this.#disposableHolder.add({
      dispose: () => {
        this.#emitter.removeEventListener(signalType, callback);
      }
    });
  }

  dispose(): void {
    this.#disposableHolder.dispose();
  }
}
