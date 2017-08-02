/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as ExtensionApi from 'extraterm-extension-api';


interface OwnerTrackedPair<W, T> {
  owner: W;
  thing: T;
}


export default class OwnerTrackingList<W, T> {

  private _things: OwnerTrackedPair<W, T>[] = [];

  add(owner: W, thing: T): ExtensionApi.Disposable {
    const pair = {owner, thing};
    this._things.push(pair);
    return { dispose: () => this._remove(pair)};
  }

  private _remove(pair: OwnerTrackedPair<W, T>): void {
    const index = this._things.indexOf(pair);
    if (index !== -1) {
      this._things.splice(index, 1);
    }
  }

  removeAllByOwner(owner: W): void {
    this._things = this._things.filter(pair => pair.owner !== owner);
  }

  forEach(func: (t: T) => void): void {
    this._things.forEach(pair => func(pair.thing));
  }

  map<R>(func: (t: T) => R): R[] {
    return this._things.map<R>(pair => func(pair.thing));
  }

  mapWithOwner<R>(func: (owner: W, t: T) => R): R[] {
    return this._things.map<R>(pair => func(pair.owner, pair.thing));
  }
}
