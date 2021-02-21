/*
 * Copyright 2017-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import { SmartBuffer } from 'smart-buffer';
import { Transform } from 'stream';

import { BulkFileMetadata, Disposable, Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from '../../utils/EventEmitter';
import { getLogger, Logger } from "extraterm-logging";
import { WriterReaderFile } from './WriterReaderFile';

const BULK_FILE_MAXIMUM_BUFFER_SIZE = 512 * 1024;
const ONE_KILOBYTE = 1024;
const CIPHER_ALGORITHM = "AES-256-CBC";


export class BulkFile {
  private _log: Logger;
  private _referenceCount = 0;
  private _writeStreamOpen = true;

  private _wrFile: WriterReaderFile = null;
  private _writeStream: crypto.Cipher = null;
  private _writeBuffers: Buffer[] = [];
  private _writeBlocked = false;

  private _cryptoKey: Buffer = null;
  private _cryptoIV: Buffer = null;

  private _closePending = false;
  private _succeess = false;
  private _onWriteBufferSizeChangeEventEmitter = new EventEmitter<{totalBufferSize: number, availableDelta: number}>();
  private _onCloseEventEmitter = new EventEmitter<{success: boolean}>();

  private _peekBuffer = new SmartBuffer();

  onWriteBufferSizeChange: Event<{totalBufferSize: number, availableDelta: number}>;
  onClose: Event<{success: boolean}>;

  constructor(private  _metadata: BulkFileMetadata, public filePath: string) {
    this._log = getLogger("BulkFile", this);

    this._cryptoKey = crypto.randomBytes(32); // 256bit AES, thus 32 bytes
    this._cryptoIV = crypto.randomBytes(16);  // 128bit block size, thus 16 bytes

    this._wrFile = new WriterReaderFile(filePath);
    this._wrFile.getWritableStream().on('drain', this._handleDrain.bind(this));
    const aesCipher = crypto.createCipheriv(CIPHER_ALGORITHM, this._cryptoKey, this._cryptoIV);
    this._writeStream = aesCipher;
    aesCipher.pipe(this._wrFile.getWritableStream());
    this.onClose = this._onCloseEventEmitter.event;
    this.onWriteBufferSizeChange = this._onWriteBufferSizeChangeEventEmitter.event;
  }

  ref(): number {
    this._referenceCount++;
    return this._referenceCount;
  }

  deref(): number {
    this._referenceCount--;
    return this._referenceCount;
  }

  getMetadata(): BulkFileMetadata {
    return this._metadata;
  }

  write(data: Buffer): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }

    this._writeBuffers.push(data);

    if (this._peekBuffer.length < ONE_KILOBYTE) {
      const bufferToAppend = Buffer.alloc(Math.min(ONE_KILOBYTE - this._peekBuffer.length, data.length));
      this._peekBuffer.writeBuffer(bufferToAppend);
    }

    this._sendWriteBuffers();
  }

  private _sendWriteBuffers(): void {
    let availableDelta = 0;
    while ( ! this._writeBlocked && this._writeBuffers.length !== 0) {
      const nextBuffer = this._writeBuffers[0];
      this._writeBuffers.splice(0 ,1);
      this._writeBlocked = ! this._writeStream.write(nextBuffer);
      availableDelta += nextBuffer.length;
    }

    if (this._writeBuffers.length === 0 && this._closePending) {
      this._writeStream.end();
      this._writeStreamOpen = false;
      this._closePending = false;
      this._onCloseEventEmitter.fire({success: this._succeess});
    }
    if (availableDelta !== 0) {
      const totalBufferSize = BULK_FILE_MAXIMUM_BUFFER_SIZE;
      this._onWriteBufferSizeChangeEventEmitter.fire({totalBufferSize, availableDelta});
    }
  }

  close(success: boolean): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }
    this._closePending = true;
    this._succeess = success;
    this._sendWriteBuffers();
  }

  private _handleDrain(): void {
    this._writeBlocked = false;
    this._sendWriteBuffers();
  }

  peek1KB(): Buffer {
    return this._peekBuffer.toBuffer();
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    const aesDecipher = crypto.createDecipheriv(CIPHER_ALGORITHM, this._cryptoKey, this._cryptoIV);

    try {
      const fileReadStream = this._wrFile.createReadableStream();
      fileReadStream.pipe(aesDecipher);

      const dnt = new DisposableNullTransform(fileReadStream);
      aesDecipher.pipe(dnt);
      return dnt;
    } catch (err) {
      this._log.warn(`Unable to open a read stream of ${this.filePath}!`, err);
      throw new Error(`Unable to open a read stream of ${this.filePath}!`);
    }
  }
}

// This is an elaborate way of passing back a dispose() method and a Readable in one object.
class DisposableNullTransform extends Transform implements Disposable {

  constructor(private _disposable: Disposable) {
    super();
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    callback();
  }

  dispose(): void {
    this._disposable.dispose();
  }
}

