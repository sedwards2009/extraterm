/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Readable } from "node:stream";
import { BulkFileState, BulkFileMetadata, Event, Disposable } from "@extraterm/extraterm-extension-api";
import { BulkFile } from "./BulkFile.js";
import { DisposableNullTransform } from "./DisposableNullTransform.js";


const ONE_KILOBYTE = 1024;


export class BlobBulkFile implements BulkFile {
  #peekBuffer: Buffer = null;
  #mimeType: string = null;
  #metadata: BulkFileMetadata = null;
  #blobBuffer: Buffer = null;

  onAvailableSizeChanged: Event<number>;
  onStateChanged: Event<BulkFileState>;

  constructor(mimeType: string, metadata: BulkFileMetadata, blobBuffer: Buffer) {
    this.#mimeType = mimeType;
    this.#metadata = metadata;
    this.#blobBuffer = blobBuffer;
  }

  getFilePath(): string {
    return null;
  }

  getUrl(): string {
    return null;
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    const stream = Readable.from(this.#blobBuffer);
    const dnt = new DisposableNullTransform(null);
    stream.pipe(dnt);
    return dnt;
  }

  getState(): BulkFileState {
    return BulkFileState.COMPLETED;
  }

  getByteCount(): number {
    return this.getTotalSize();
  }

  getTotalSize(): number {
    return this.#blobBuffer.length;
  }

  getMetadata(): BulkFileMetadata {
    return this.#metadata;
  }

  getPeekBuffer(): Buffer {
    if (this.#peekBuffer == null) {
      const peekSize = Math.min(ONE_KILOBYTE, this.#blobBuffer.length);
      this.#peekBuffer = Buffer.alloc(peekSize);
      this.#blobBuffer.copy(this.#peekBuffer, 0, 0, peekSize);
    }
    return this.#peekBuffer;
  }

  ref(): number {
    return 0;
  }

  deref(): number {
    return 0;
  }

  getRefCount(): number {
    return 0;
  }
}
