/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import { Transform } from "node:stream";
import { BulkFileMetadata, BulkFileState, Disposable, Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { WriterReaderFile } from "./WriterReaderFile.js";
import { DebouncedDoLater } from "extraterm-later";


const BULK_FILE_MAXIMUM_BUFFER_SIZE = 512 * 1024;
const CIPHER_ALGORITHM = "AES-256-CBC";


export class BulkFile {
  private _log: Logger;

  #metadata: BulkFileMetadata = null;
  #filePath: string = null;
  #totalSize = -1;
  #referenceCount = 0;
  #writeStreamOpen = true;

  #wrFile: WriterReaderFile = null;
  #writeStream: crypto.Cipher = null;

  #cryptoKey: Buffer = null;
  #cryptoIV: Buffer = null;

  #succeess = false;

  #onStateChangedEventEmitter = new EventEmitter<BulkFileState>();
  onStateChanged: Event<BulkFileState>;

  #onAvailableSizeChangedEventEmitter = new EventEmitter<number>();
  onAvailableSizeChanged: Event<number>;

  #emitAvailableSizeChangedLater: DebouncedDoLater = null;


  constructor(metadata: BulkFileMetadata, filePath: string) {
    this._log = getLogger("BulkFile", this);

    this.onAvailableSizeChanged = this.#onAvailableSizeChangedEventEmitter.event;
    this.#emitAvailableSizeChangedLater = new DebouncedDoLater(() => {
      this.#emitAvailableSizeChangedEvent();
    }, 250);
    this.onStateChanged = this.#onStateChangedEventEmitter.event;

    this.#metadata = metadata;
    this.#filePath = filePath;
    this.#cryptoKey = crypto.randomBytes(32); // 256bit AES, thus 32 bytes
    this.#cryptoIV = crypto.randomBytes(16);  // 128bit block size, thus 16 bytes

    if (metadata["filesize"] !== undefined) {
      this.#totalSize = Number.parseInt(metadata["filesize"], 10);
      if (isNaN(this.#totalSize)) {
        this.#totalSize = -1;
      }
    }

    this.#wrFile = new WriterReaderFile(filePath);
    const aesCipher = crypto.createCipheriv(CIPHER_ALGORITHM, this.#cryptoKey, this.#cryptoIV);
    this.#writeStream = aesCipher;

    this.#wrFile.onByteCountChanged(this.#handleByteCountChanged.bind(this));

    aesCipher.pipe(this.#wrFile.getWritableStream());
    this.#wrFile.getWritableStream().on("end", () => {
      this.#writeStreamOpen = false;
      this.#emitAvailableSizeChangedLater.doNow();
      this.#onStateChangedEventEmitter.fire(this.getState());
    });
  }

  getTotalSize(): number {
    return this.#totalSize;
  }

  getFilePath(): string {
    return this.#filePath;
  }

  #handleByteCountChanged(byteCount: number): void {
    this.#emitAvailableSizeChangedLater.trigger();
  }

  #emitAvailableSizeChangedEvent(): void {
    this.#onAvailableSizeChangedEventEmitter.fire(this.getByteCount());
  }

  getByteCount(): number {
    return this.#wrFile.getByteCount();
  }

  getDesiredWriteSize(): number {
    return BULK_FILE_MAXIMUM_BUFFER_SIZE;
  }

  getWritableStream(): NodeJS.WritableStream {
    return this.#writeStream;
  }

  getState(): BulkFileState {
    if (this.#writeStreamOpen) {
      return BulkFileState.DOWNLOADING;
    }
    return this.#succeess ? BulkFileState.COMPLETED : BulkFileState.FAILED;
  }

  setSuccess(success: boolean): void {
    this.#succeess = success;
    if (this.#writeStreamOpen) {
      return;
    }
    this.#onStateChangedEventEmitter.fire(this.getState());
  }

  ref(): number {
    this.#referenceCount++;
    return this.#referenceCount;
  }

  deref(): number {
    this.#referenceCount--;
    return this.#referenceCount;
  }

  getMetadata(): BulkFileMetadata {
    return this.#metadata;
  }

  getPeekBuffer(): Buffer {
    return this.#wrFile.getPeekBuffer();
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    const aesDecipher = crypto.createDecipheriv(CIPHER_ALGORITHM, this.#cryptoKey, this.#cryptoIV);

    try {
      const fileReadStream = this.#wrFile.createReadableStream();
      fileReadStream.pipe(aesDecipher);

      const dnt = new DisposableNullTransform(fileReadStream);
      aesDecipher.pipe(dnt);
      return dnt;
    } catch (err) {
      this._log.warn(`Unable to open a read stream of ${this.#filePath}!`, err);
      throw new Error(`Unable to open a read stream of ${this.#filePath}!`);
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

