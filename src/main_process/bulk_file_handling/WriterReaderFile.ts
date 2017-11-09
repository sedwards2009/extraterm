/*
* Copyright 2017 Simon Edwards <simon@simonzone.com>
*
* This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
*/
import * as fs from 'fs';
import {Readable, ReadableOptions, Transform, Writable} from 'stream';
import {getLogger, Logger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';


export class WriterReaderFile {

  private _writeStream: fs.WriteStream = null;
  private _counterTransform: CounterTransform = null;

  constructor(private _filename: string) {
    this._writeStream = fs.createWriteStream(_filename);
    this._counterTransform = new CounterTransform();
    this._counterTransform.pipe(this._writeStream);
  }

  getWriteStream(): NodeJS.WritableStream {
    return this._counterTransform;
  }

  createReadStream(): NodeJS.ReadableStream {
    return new TailingFileReader(this._filename, this._counterTransform);
  }
}


class CounterTransform extends Transform {

  private _counter = 0;
  private _closed = false;

  constructor(options?) {
    super(options);

    this.on('end', () => {
      this._closed = true;
      process.nextTick(() => {
        this.emit('expanded');
      });
    });
  }

  protected _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    this._counter += chunk.length;

    callback();
    process.nextTick(() => {
      this.emit('expanded');
    });
  }

  getCount(): number {
    return this._counter;
  }

  isClosed(): boolean {
    return this._closed;
  }
}

const TRAILING_FILE_READER_BUFFER_SIZE = 256 * 1024;

/**
 * File reader which can read and follow a file which concurrently being written to.
 */
class TailingFileReader extends Readable {
  private _log: Logger;
  private _fhandle = -1;
  private _readPointer = 0;
  private _buffer: Buffer = null;
  private _reading = false;
  private _readOperationRunning = false;
  
  constructor(filename: string, private _counterTransformer: CounterTransform, options?: ReadableOptions) {
    super(options);
    this._log = getLogger("TailingFileReader", this);
    this._fhandle = fs.openSync(filename, 'r');
    this._buffer = Buffer.alloc(TRAILING_FILE_READER_BUFFER_SIZE);
  }

  protected _read(size: number): void {
    if (this._counterTransformer.isClosed() && this._counterTransformer.getCount() === this._readPointer) {
      this.push(null);  // Done
      return;
    }
    this._reading = true;

    if (this._readOperationRunning) {
      return;
    }

    // Don't read past the end of the file.
    const effectiveReadSize = Math.min(size, this._counterTransformer.getCount() - this._readPointer);

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
