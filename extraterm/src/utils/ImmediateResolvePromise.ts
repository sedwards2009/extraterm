/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { doLater } from "./DoLater";

export function newImmediateResolvePromise<V=void>(value: V=undefined): Promise<V> {
  return new Promise<V>( (resolve, reject) => {
    doLater( () => {
      resolve(value);
    });
  });
}
