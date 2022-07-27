/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Transform } from "node:stream";
import { Disposable } from '@extraterm/extraterm-extension-api';


// This is an elaborate way of passing back a dispose() method and a Readable in one object.
export class DisposableNullTransform extends Transform implements Disposable {
  #disposable: Disposable = null;

  constructor(disposable: Disposable) {
    super();
    this.#disposable = disposable;
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    callback();
  }

  dispose(): void {
    if (this.#disposable == null) {
      return;
    }
    this.#disposable.dispose();
  }
}
