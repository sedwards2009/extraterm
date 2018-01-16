/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Disposable} from 'extraterm-extension-api';

/**
 * Type guard to detecting objects which support the Disposable interface.
 */
export function isDisposable(it: any): it is Disposable {
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
