/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { BulkFileHandle, BulkFileState, BulkFileMetadata, Event } from '@extraterm/extraterm-extension-api';


const ONE_KILOBYTE = 1024;


export class BlobBulkFileHandle implements BulkFileHandle {
  #peekBuffer: Buffer = null;
  #url: string = null;
  #mimeType: string = null;
  #metadata: BulkFileMetadata = null;
  #blobBuffer: Buffer = null;

  constructor(mimeType: string, metadata: BulkFileMetadata, blobBuffer: Buffer) {
    this.#mimeType = mimeType;
    this.#metadata = metadata;
    this.#blobBuffer = blobBuffer;
  }

  get state(): BulkFileState {
    return BulkFileState.COMPLETED;
  }

  get url(): string {
    if (this.#url == null) {
      return `data:${this.#mimeType};base64,${this.#blobBuffer.toString("base64")}`;
    }
    return this.#url;
  }

  get availableSize(): number {
    return this.totalSize;
  }

  get totalSize(): number {
    return this.#blobBuffer.length;
  }

  get metadata(): BulkFileMetadata {
    return this.#metadata;
  }

  peek1KB(): Buffer {
    if (this.#peekBuffer == null) {
      const peekSize = Math.min(ONE_KILOBYTE, this.#blobBuffer.length);
      this.#peekBuffer = Buffer.alloc(peekSize);
      this.#blobBuffer.copy(this.#peekBuffer, 0, 0, peekSize);
    }
    return this.#peekBuffer;
  }

  ref(): void {
  }

  deref(): void{
  }

  onAvailableSizeChanged: Event<number>;
  onStateChanged: Event<BulkFileState>;
}
