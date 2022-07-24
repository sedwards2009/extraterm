/*
* Copyright 2022 Simon Edwards <simon@simonzone.com>
*
* This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
*/
import * as fs from "node:fs";
import { Readable, ReadableOptions, Transform } from "node:stream";
import { Event, Disposable } from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { SmartBuffer } from "smart-buffer";

import {getLogger, Logger} from "extraterm-logging";
import { log } from "extraterm-logging";


export class WriterReaderFile {

  #filename: string = null;
  #writeStream: fs.WriteStream = null;
  #peekTransform: PeekTransform = null;
  #counterTransform: CounterTransform = null;

  #onByteCountChangedEventEmitter = new EventEmitter<number>();
  onByteCountChanged: Event<number>;

  constructor(filename: string) {
    this.onByteCountChanged = this.#onByteCountChangedEventEmitter.event;
    this.#filename = filename;
    const fd = fs.openSync(this.#filename, "w");
    this.#writeStream = fs.createWriteStream("", {fd});

    this.#counterTransform = new CounterTransform();
    this.#counterTransform.on("expanded", () => {
      this.#onByteCountChangedEventEmitter.fire(this.getByteCount());
    });

    this.#peekTransform = new PeekTransform();
    this.#counterTransform.pipe(this.#peekTransform);
    this.#peekTransform.pipe(this.#writeStream);
  }

  getWritableStream(): NodeJS.WritableStream {
    return this.#counterTransform;
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    return new TailingFileReader(this.#filename, this.#counterTransform);
  }

  getByteCount(): number {
    return this.#counterTransform.getByteCount();
  }

  getPeekBuffer(): Buffer {
    return this.#peekTransform.getPeekBuffer();
  }
}


class CounterTransform extends Transform {

  #counter = 0;
  #closed = false;

  constructor(options?) {
    super(options);

    this.on('end', () => {
      this.#closed = true;
      process.nextTick(() => {
        this.emit('expanded');
      });
    });
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    this.#counter += chunk.length;

    callback();
    process.nextTick(() => {
      this.emit('expanded');
    });
  }

  getByteCount(): number {
    return this.#counter;
  }

  isClosed(): boolean {
    return this.#closed;
  }
}


const ONE_KILOBYTE = 1024;

class PeekTransform extends Transform {

  #peekBuffer = new SmartBuffer();

  constructor(options?) {
    super(options);
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.#writePeekBuffer(chunk);

    this.push(chunk);
    callback();
  }

  #writePeekBuffer(data: Buffer): void {
    if (this.#peekBuffer.length < ONE_KILOBYTE) {
      if (this.#peekBuffer.length + data.length > ONE_KILOBYTE) {
        const tmpBuffer = Buffer.alloc(ONE_KILOBYTE - this.#peekBuffer.length);
        data.copy(tmpBuffer, 0, 0, tmpBuffer.length);
        this.#peekBuffer.writeBuffer(tmpBuffer);
      } else {
        this.#peekBuffer.writeBuffer(data);
      }
    }
  }

  getPeekBuffer(): Buffer {
    return this.#peekBuffer.toBuffer();
  }
}

const TRAILING_FILE_READER_BUFFER_SIZE = 256 * 1024;

/**
 * File reader which can read and follow a file which concurrently being written to.
 */
class TailingFileReader extends Readable implements Disposable {
  private _log: Logger;
  private _fhandle = -1;
  private _readPointer = 0;
  private _buffer: Buffer = null;
  private _reading = false;
  private _readOperationRunning = false;
  private _closed = false;

  constructor(filename: string, private _counterTransformer: CounterTransform, options?: ReadableOptions) {
    super(options);
    this._log = getLogger("TailingFileReader", this);
    this._fhandle = fs.openSync(filename, 'r');
    this._buffer = Buffer.alloc(TRAILING_FILE_READER_BUFFER_SIZE);
  }

  dispose(): void {
    this._closed = true;
    this.removeAllListeners();
    if (this._fhandle !== -1) {
      fs.closeSync(this._fhandle);
      this._fhandle = -1;
    }
  }

  _read(size: number): void {
    if (this._closed || (this._counterTransformer.isClosed() && this._counterTransformer.getByteCount() === this._readPointer)) {
      this.push(null);  // Done
      if (this._fhandle !== -1) {
        fs.closeSync(this._fhandle);
        this._fhandle = -1;
      }
      return;
    }
    this._reading = true;

    if (this._readOperationRunning) {
      return;
    }

    // Don't read past the end of the file.
    const effectiveReadSize = Math.min(size, this._counterTransformer.getByteCount() - this._readPointer);

    if (effectiveReadSize !== 0) {
      fs.read(this._fhandle, this._buffer, 0, Math.min(this._buffer.length, effectiveReadSize), this._readPointer,
        (err: any, bytesRead: number, buffer: Buffer): void => {
          this._readOperationRunning = false;

          if (bytesRead !== 0) {
            const correctSizeBuffer = Buffer.alloc(bytesRead);
            this._buffer.copy(correctSizeBuffer, 0, 0, bytesRead);
            this._readPointer += bytesRead;
            if (this.push(correctSizeBuffer)) {
              this._read(size);
            } else {
              this._reading = false;
            }
          } else {
            // Retry.
            this._read(size);
          }
        }
      );
      this._readOperationRunning = true;
    } else {
      this._counterTransformer.once('expanded', () => {
        if (this._reading && ! this._readOperationRunning) {
          this._read(size);
        }
      });
    }
  }
}
