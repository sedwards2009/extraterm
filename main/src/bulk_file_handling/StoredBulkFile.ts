/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import { BulkFileMetadata, BulkFileState, Disposable, Event } from '@extraterm/extraterm-extension-api';
import { EventEmitter } from "extraterm-event-emitter";
import { getLogger, Logger } from "extraterm-logging";

import { WriterReaderFile } from "./WriterReaderFile.js";
import { DebouncedDoLater } from "extraterm-later";
import { BulkFile } from "./BulkFile.js";
import { DisposableNullTransform } from "./DisposableNullTransform.js";


const BULK_FILE_MAXIMUM_BUFFER_SIZE = 512 * 1024;
const CIPHER_ALGORITHM = "AES-256-CBC";


export class StoredBulkFile implements BulkFile, Disposable {
  private _log: Logger;

  #isAlive = true;
  #metadata: object = null;
  #filePath: string = null;
  #url: string = null;
  #totalSize = -1;
  #referenceCount = 0;
  #writeStreamOpen = true;

  #wrFile: WriterReaderFile = null;
  #writeStream: crypto.Cipher = null;

  #cryptoKey: Buffer = null;
  #cryptoIV: Buffer = null;

  #success = false;

  #onStateChangedEventEmitter = new EventEmitter<BulkFileState>();
  onStateChanged: Event<BulkFileState>;

  #onAvailableSizeChangedEventEmitter = new EventEmitter<number>();
  onAvailableSizeChanged: Event<number>;

  #emitAvailableSizeChangedLater: DebouncedDoLater = null;

  #onReferenceCountChangedEventEmitter = new EventEmitter<StoredBulkFile>();
  onReferenceCountChanged: Event<StoredBulkFile> = null;

  constructor(metadata: BulkFileMetadata, filePath: string, url: string) {
    this._log = getLogger("StoredBulkFile", this);
    this.#url = url;

    this.onAvailableSizeChanged = this.#onAvailableSizeChangedEventEmitter.event;
    this.#emitAvailableSizeChangedLater = new DebouncedDoLater(() => {
      this.#emitAvailableSizeChangedEvent();
    }, 250);
    this.onStateChanged = this.#onStateChangedEventEmitter.event;
    this.onReferenceCountChanged = this.#onReferenceCountChangedEventEmitter.event;

    this.#metadata = Object.assign({}, metadata);
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

  dispose(): void {
    this.#isAlive = false;
  }

  #checkIsAlive(): void {
    if ( ! this.#isAlive) {
      throw new Error("StoredBulkFile is no longer alive and cannot be used.");
    }
  }

  getTotalSize(): number {
    this.#checkIsAlive();
    return this.#totalSize;
  }

  getFilePath(): string {
    this.#checkIsAlive();
    return this.#filePath;
  }

  getUrl(): string {
    this.#checkIsAlive();
    return this.#url;
  }

  #handleByteCountChanged(byteCount: number): void {
    this.#emitAvailableSizeChangedLater.trigger();
  }

  #emitAvailableSizeChangedEvent(): void {
    this.#onAvailableSizeChangedEventEmitter.fire(this.getByteCount());
  }

  getByteCount(): number {
    this.#checkIsAlive();
    return this.#wrFile.getByteCount();
  }

  getDesiredWriteSize(): number {
    this.#checkIsAlive();
    return BULK_FILE_MAXIMUM_BUFFER_SIZE;
  }

  getWritableStream(): NodeJS.WritableStream {
    this.#checkIsAlive();
    return this.#writeStream;
  }

  getState(): BulkFileState {
    this.#checkIsAlive();
    if (this.#writeStreamOpen) {
      return BulkFileState.DOWNLOADING;
    }
    return this.#success ? BulkFileState.COMPLETED : BulkFileState.FAILED;
  }

  setSuccess(success: boolean): void {
    this.#checkIsAlive();
    this.#success = success;
    if (this.#writeStreamOpen) {
      return;
    }
    this.#onStateChangedEventEmitter.fire(this.getState());
  }

  ref(): number {
    this.#checkIsAlive();
    this.#referenceCount++;
    this.#onReferenceCountChangedEventEmitter.fire(this);
    return this.#referenceCount;
  }

  deref(): number {
    this.#checkIsAlive();
    this.#referenceCount--;
    this.#onReferenceCountChangedEventEmitter.fire(this);
    return this.#referenceCount;
  }

  getRefCount(): number {
    this.#checkIsAlive();
    return this.#referenceCount;
  }

  getMetadata(): BulkFileMetadata {
    this.#checkIsAlive();
    return <BulkFileMetadata> this.#metadata;
  }

  setMetadataField(key: string, value: string): void {
    this.#metadata[key] = value;
  }

  getPeekBuffer(): Buffer {
    this.#checkIsAlive();
    return this.#wrFile.getPeekBuffer();
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    this.#checkIsAlive();
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
