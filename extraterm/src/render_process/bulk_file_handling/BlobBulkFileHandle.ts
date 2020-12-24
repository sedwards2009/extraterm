/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {BulkFileHandle, BulkFileState, BulkFileMetadata, Event} from '@extraterm/extraterm-extension-api';


const ONE_KILOBYTE = 1024;


export class BlobBulkFileHandle implements BulkFileHandle {

  private _peekBuffer: Buffer = null;
  private _url: string = null;

  constructor(private _mimeType: string, private _metadata: BulkFileMetadata, private _blobBuffer: Buffer) {
  }

  get state(): BulkFileState {
    return BulkFileState.COMPLETED;
  }

  get url(): string {
    if (this._url == null) {
      return `data:${this._mimeType};base64,${this._blobBuffer.toString("base64")}`;
    }
    return this._url;
  }

  get availableSize(): number {
    return this.totalSize;
  }

  get totalSize(): number {
    return this._blobBuffer.length;
  }

  get metadata(): BulkFileMetadata {
    return this._metadata;
  }

  peek1KB(): Buffer {
    if (this._peekBuffer == null) {
      const peekSize = Math.min(ONE_KILOBYTE, this._blobBuffer.length);
      this._peekBuffer = Buffer.alloc(peekSize);
      this._blobBuffer.copy(this._peekBuffer, 0, 0, peekSize);
    }
    return this._peekBuffer;
  }

  ref(): void {
  }

  deref(): void{
  }

  onAvailableSizeChange: Event<number>;
  onStateChange: Event<BulkFileState>;
}