/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {Disposable} from 'extraterm-extension-api';
import {BulkFileHandle} from './BulkFileHandle';
import {BulkFileIdentifier, Metadata} from '../../main_process/bulk_file_handling/BulkFileStorage';
import {getLogger, Logger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as WebIpc from '../WebIpc';
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';
import * as Messages from '../../WindowMessages';


const ONE_KILOBYTE = 1024;

export class BulkFileBroker {

  private _fileHandleMap = new Map<BulkFileIdentifier, WriteableBulkFileHandle>();
  private _log: Logger;

  constructor() {
    this._log = getLogger("BulkFileBroker", this);
    WebIpc.registerDefaultHandler(Messages.MessageType.BULK_FILE_BUFFER_SIZE,
      this._handleBufferSizeMessage.bind(this));
  }

  createWriteableBulkFileHandle(metadata: Metadata, size: number): WriteableBulkFileHandle {
    let newFileHandle: WriteableBulkFileHandle = null;
    newFileHandle = new WriteableBulkFileHandle({dispose: () => this._dispose(newFileHandle) }, metadata, size);
    this._fileHandleMap.set(newFileHandle.getBulkFileIdentifier(), newFileHandle);
    return newFileHandle;
  }

  private _dispose(fileHandle: WriteableBulkFileHandle): void {
    
  }

  private _handleBufferSizeMessage(msg: Messages.BulkFileBufferSize): void {
    if (this._fileHandleMap.has(msg.identifier)) {
      this._fileHandleMap.get(msg.identifier).updateRemoteBufferSize(msg.totalBufferSize, msg.availableDelta);
    }
  }
}


export class WriteableBulkFileHandle implements BulkFileHandle {

  private _log: Logger;
  private _refCount = 0;
  private _fileIdentifier: BulkFileIdentifier;
  private _isOpen = true;

  private _onAvailableSizeChangeEventEmitter = new EventEmitter<number>();
  private _onFinishedEventEmitter = new EventEmitter<void>();
  private _onWriteBufferSizeEventEmitter = new EventEmitter<number>();

  private _availableSize = 0;
  private _peekBuffer: SmartBuffer = new SmartBuffer();
  
  private _writeBuffers: Buffer[] = [];
  private _maximumWriteBufferSize = 1024; // FIXME

  private _remoteBufferTotalSize = 1024;
  private _removeBufferDelta = 0;
  private _pendingClose = false;
  
  constructor(private _disposable: Disposable, private _metadata: Metadata, private _totalSize: number) {
    this._log = getLogger("WriteableBulkFileHandle", this);

    this.onAvailableSizeChange = this._onAvailableSizeChangeEventEmitter.event;
    this.onFinished = this._onFinishedEventEmitter.event;
    this.onAvailableWriteBufferSizeChanged = this._onWriteBufferSizeEventEmitter.event;
    
    this._fileIdentifier = WebIpc.createBulkFileSync(_metadata, _totalSize);
  }

  getBulkFileIdentifier(): BulkFileIdentifier {
    return this._fileIdentifier;
  }

  getUrl(): string {
    return "bulk://" + this._fileIdentifier;
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

  peek1KB(): Buffer {
    return this._peekBuffer.toBuffer();
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

    this._writePeekBuffer(data);
    this._writeBuffers.push(data);
    this._sendBuffers();
  }

  getAvailableWriteBufferSize(): number {
    return this._maximumWriteBufferSize - this._writeBuffers.reduce((accu, buf): number => accu + buf.length, 0);
  }

  onAvailableWriteBufferSizeChanged: Event<number>;

  private _getAvailableRemoteBufferSize(): number {
    return this._remoteBufferTotalSize + this._removeBufferDelta;
  }

  private _sendBuffers(): void {
    let bytesSent = 0;

    while (this._writeBuffers.length !== 0 && this._getAvailableRemoteBufferSize() > 0) {
      const nextBuffer = this._writeBuffers[0];
      if (nextBuffer.length <= this._getAvailableRemoteBufferSize()) {
        // Send the whole buffer in one go.
        this._writeBuffers.splice(0, 1);
        WebIpc.writeBulkFile(this._fileIdentifier, nextBuffer);
        bytesSent += nextBuffer.length;
        this._remoteBufferTotalSize -= nextBuffer.length;
      } else {
        // Cut the buffer into two.
        const firstPartBuffer = Buffer.alloc(this._getAvailableRemoteBufferSize());
        nextBuffer.copy(firstPartBuffer, 0, 0, this._getAvailableRemoteBufferSize());
        const secondPartBuffer = Buffer.alloc(nextBuffer.length - this._getAvailableRemoteBufferSize());
        nextBuffer.copy(secondPartBuffer, 0, this._getAvailableRemoteBufferSize());

        this._writeBuffers.splice(0, 1, firstPartBuffer, secondPartBuffer);
        // Let the next run through the loop do the transmission.
      }
    }

    if (bytesSent !== 0) {
      this._removeBufferDelta -= bytesSent;
      this._availableSize += bytesSent;
      this._onAvailableSizeChangeEventEmitter.fire(this._availableSize);
    }

    if (this._pendingClose && this._writeBuffers.length === 0) {
      WebIpc.closeBulkFile(this._fileIdentifier);
      this._isOpen = false;
      this._pendingClose = false;
    }
  }

  private _writePeekBuffer(data: Buffer): void {
    if (this._peekBuffer.length < ONE_KILOBYTE) {
      if (this._peekBuffer.length + data.length > ONE_KILOBYTE) {
        const tmpBuffer = Buffer.alloc(ONE_KILOBYTE - this._peekBuffer.length);
        data.copy(tmpBuffer, 0, 0, tmpBuffer.length);
        this._peekBuffer.writeBuffer(tmpBuffer);
      } else {
        this._peekBuffer.writeBuffer(data);
      }
    }
  }

  updateRemoteBufferSize(totalBufferSize: number, availableDelta: number): void {
    this._remoteBufferTotalSize = totalBufferSize;
    this._removeBufferDelta += availableDelta;
    this._sendBuffers();

    process.nextTick(() => {
      this._onWriteBufferSizeEventEmitter.fire(this.getAvailableWriteBufferSize());
    });
  }

  close(): void {
    if ( ! this._isOpen) {
      this._log.warn("Close attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }

    this._pendingClose = true;
    this._sendBuffers();
  }

  onFinished: Event<void>;
}
