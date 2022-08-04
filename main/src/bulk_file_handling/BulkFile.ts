/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BulkFileMetadata, BulkFileState, Disposable, Event } from "@extraterm/extraterm-extension-api";


export interface BulkFile {

  // TODO: Maybe this interface should have a "writeable" sub-interface
  onStateChanged: Event<BulkFileState>;
  onAvailableSizeChanged: Event<number>;

  getTotalSize(): number;
  getFilePath(): string;
  getByteCount(): number;
  getState(): BulkFileState;
  ref(): number;
  deref(): number;
  getRefCount(): number;
  getMetadata(): BulkFileMetadata;
  getPeekBuffer(): Buffer;
  getUrl(): string;
  createReadableStream(): NodeJS.ReadableStream & Disposable;
}
