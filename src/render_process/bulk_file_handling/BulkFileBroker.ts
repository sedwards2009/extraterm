/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from 'extraterm-extension-api';
import {BulkFileHandle} from './BulkFileHandle';
import {BulkFileIdentifier, Metadata} from '../../main_process/bulk_file_handling/BulkFileStorage';
import {getLogger, Logger} from '../../logging/Logger';
import * as WebIpc from '../WebIpc';

export class BulkFileBroker {

  private _fileHandles: WriteableBulkFileHandle[] = [];
  private _log: Logger;

  constructor() {
    this._log = getLogger("BulkFileBroker", this);
  }

  createWriteableBulkFileHandle(metadata: Metadata, size: number): WriteableBulkFileHandle {
    let newFileHandle: WriteableBulkFileHandle = null;
    newFileHandle = new WriteableBulkFileHandle({dispose: () => this._dispose(newFileHandle) }, metadata, size);

    this._fileHandles.push(newFileHandle);
    return newFileHandle;
  }

  private _dispose(fileHandle: WriteableBulkFileHandle): void {
    
  }

}


export class WriteableBulkFileHandle implements BulkFileHandle {

  private _log: Logger;
  private _refCount = 0;
  private _fileIdentifier: BulkFileIdentifier;
  private _isOpen = true;

  constructor(private _disposable: Disposable, private _metadata: Metadata, private _size: number) {
    this._log = getLogger("WriteableBulkFileHandle", this);
    this._fileIdentifier = WebIpc.createBulkFileSync(_metadata, _size);
  }

  getUrl(): string {
    return "";
  }

  getSize(): number {
    return this._size;
  }

  getMetadata(): Metadata {
    return this._metadata;
  }

  ref(): void {
    this._refCount++;
  }

  deref(): void {
    this._refCount--;
    if (this._refCount <= 0) {
      this._disposable.dispose();
    }
  }

  write(data: Buffer): void {
    if ( ! this._isOpen) {
      this._log.warn("Write attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }
    WebIpc.writeBulkFile(this._fileIdentifier, data);
  }

  close(): void {
    if ( ! this._isOpen) {
      this._log.warn("Close attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }

    WebIpc.closeBulkFile(this._fileIdentifier);
    this._isOpen = false;
  }
}
