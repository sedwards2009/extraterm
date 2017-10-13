/*
* Copyright 2017 Simon Edwards <simon@simonzone.com>
*
* This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
*/
import * as fs from 'fs';
import {Readable, ReadableOptions, Transform, Writable} from 'stream';


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
      this.emit('expanded');
    });
  }

  protected _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    this._counter += chunk.length;
    callback();
    this.emit('expanded');
  }

  getCount(): number {
    return this._counter;
  }

  isClosed(): boolean {
    return this._closed;
  }
}

class TailingFileReader extends Readable {

  private _fhandle = -1;
  private _readPointer = 0;
  private _buffer: Buffer = null;

  constructor(filename: string, private _counterTransformer: CounterTransform, options?: ReadableOptions) {
    super(options);

    this._fhandle = fs.openSync(filename, 'r');
  }

  protected _read(size: number): void {
    if (this._counterTransformer.isClosed() && this._counterTransformer.getCount() === this._readPointer) {
      this.push(null);
      return;
    }

    // Don't read past the end of the file.
    const effectiveReadSize = Math.min(size, this._counterTransformer.getCount() - this._readPointer);

    if (effectiveReadSize !== 0) {
      if (this._buffer == null || this._buffer.length !== effectiveReadSize) {
        this._buffer = Buffer.alloc(effectiveReadSize);
      }
      fs.read(this._fhandle, this._buffer, 0, effectiveReadSize, this._readPointer,
        (err: any, bytesRead: number, buffer: Buffer): void => {
          this._readPointer += bytesRead;
          this.push(buffer);
        }
      );
    } else {
      this._counterTransformer.once('expanded', () => {
        this._read(size);
      });
    }
  }
}
