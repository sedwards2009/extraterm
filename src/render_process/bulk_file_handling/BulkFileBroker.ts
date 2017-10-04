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
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';


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
  private _onAvailableSizeChangeEventEmitter = new EventEmitter<number>();
  private _availableSize = 0;
  private _onFinishedEventEmitter = new EventEmitter<void>();

  constructor(private _disposable: Disposable, private _metadata: Metadata, private _totalSize: number) {
    this._log = getLogger("WriteableBulkFileHandle", this);

    this.onAvailableSizeChange = this._onAvailableSizeChangeEventEmitter.event.bind(this._onAvailableSizeChangeEventEmitter);
    this.onFinished = this._onFinishedEventEmitter.event.bind(this._onFinishedEventEmitter);

    this._fileIdentifier = WebIpc.createBulkFileSync(_metadata, _totalSize);
  }

  getUrl(): string {
    return "";
  }

  onAvailableSizeChange: Event<number>;

  getAvailableSize(): number {
    return this._availableSize;
  }

  getTotalSize(): number {
    return this._totalSize;
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
    this._availableSize += data.length;
    this._onAvailableSizeChangeEventEmitter.fire(this._availableSize);
  }

  close(): void {
    if ( ! this._isOpen) {
      this._log.warn("Close attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }

    WebIpc.closeBulkFile(this._fileIdentifier);
    this._isOpen = false;
  }

  onFinished: Event<void>;
}
