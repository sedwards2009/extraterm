/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Event} from 'extraterm-extension-api';
import {Transform} from 'stream';

import {DebouncedDoLater} from 'extraterm-later';
import {EventEmitter} from './EventEmitter';


const DEBOUNCE_DELAY_MILLIS = 100;


/**
 * Stream transform which emits events signaling the amount of data which
 * has passed through.
 */
export class ByteCountingStreamTransform extends Transform {

  private _counter = 0;
  private _doLater: DebouncedDoLater = null;
  private _onCountUpdateEventEmitter = new EventEmitter<number>();

  onCountUpdate: Event<number>;

  constructor(options?) {
    super(options);
    this.onCountUpdate = this._onCountUpdateEventEmitter.event;

    this._doLater = new DebouncedDoLater(() => {
      this._onCountUpdateEventEmitter.fire(this.getCount());
    }, DEBOUNCE_DELAY_MILLIS);
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this._counter += chunk.length;
    this.push(chunk);
    this._doLater.trigger();
    callback();
  }

  _flush(callback: Function): void {
    this._doLater.doNow();
    callback();
  }

  getCount(): number {
    return this._counter;
  }
}
