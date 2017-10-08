/*
* Copyright 2017 Simon Edwards <simon@simonzone.com>
*
* This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
*/
import * as fs from 'fs';
import {Readable, ReadableOptions, Transform, Writable} from 'stream';


export class WriterReaderFile {

  private _writeStream: Writable = null;
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
    return new MyReadable(this._filename, this._counterTransform);
  }
}


class CounterTransform extends Transform {

  private _counter = 0;

  protected _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    this._counter += chunk.length;
    console.log("CounterTransform saw " + this._counter);
    callback();
    this.emit('expanded');
  }

  getCount(): number {
    return this._counter;
  }
}

class MyReadable extends Readable {

  private _fhandle = -1;
  private _readPointer = 0;
  private _buffer: Buffer = null;

  constructor(filename: string, private _counterTransformer: CounterTransform, options?: ReadableOptions) {
    super(options);

    this._fhandle = fs.openSync(filename, 'r');

  }

  protected _read(size: number): void {

    console.log("MyReadable: counter reports size ", this._counterTransformer.getCount());
    
    // Don't read past the end of the file.
    const effectiveReadSize = Math.min(size, this._counterTransformer.getCount() - this._readPointer);

    if (effectiveReadSize !== 0) {
      if (this._buffer == null || this._buffer.length !== effectiveReadSize) {
        console.log("MyReadable: Allocating buffer size ", effectiveReadSize);
        this._buffer = Buffer.alloc(effectiveReadSize);
      }
      fs.read(this._fhandle, this._buffer, 0, effectiveReadSize, this._readPointer,
        (err: any, bytesRead: number, buffer: Buffer): void => {
          console.log(`MyReadable: received ${bytesRead}, expected ${effectiveReadSize}`);
          this._readPointer += bytesRead;
          this.push(buffer);
        }
      );
    } else {
      this._counterTransformer.once('expanded', () => {
        console.log("MyReadable: saw expanded");
        this._read(size);
      });
    }
  }
}
