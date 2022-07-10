/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Event } from "@extraterm/extraterm-extension-api";
import { Transform } from "node:stream";

import { DebouncedDoLater } from "extraterm-later";
import { EventEmitter } from "extraterm-event-emitter";


const DEBOUNCE_DELAY_MILLIS = 100;


/**
 * Stream transform which emits events signaling the amount of data which
 * has passed through.
 */
export class ByteCountingStreamTransform extends Transform {
  #counter = 0;
  #doLater: DebouncedDoLater = null;
  #onCountUpdateEventEmitter = new EventEmitter<number>();

  onCountUpdate: Event<number>;

  constructor(options?) {
    super(options);
    this.onCountUpdate = this.#onCountUpdateEventEmitter.event;

    this.#doLater = new DebouncedDoLater(() => {
      this.#onCountUpdateEventEmitter.fire(this.getCount());
    }, DEBOUNCE_DELAY_MILLIS);
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.#counter += chunk.length;
    this.push(chunk);
    this.#doLater.trigger();
    callback();
  }

  _flush(callback: Function): void {
    this.#doLater.doNow();
    callback();
  }

  getCount(): number {
    return this.#counter;
  }
}
