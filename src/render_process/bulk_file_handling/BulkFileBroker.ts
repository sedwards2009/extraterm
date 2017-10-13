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
      this._fileHandleMap.get(msg.identifier).setRemoteBufferSize(msg.bufferSize);
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
  private _remoteBufferSize = 1024;
  private _pendingClose = false;
  
  constructor(private _disposable: Disposable, private _metadata: Metadata, private _totalSize: number) {
    this._log = getLogger("WriteableBulkFileHandle", this);

    this.onAvailableSizeChange = this._onAvailableSizeChangeEventEmitter.event;
    this.onFinished = this._onFinishedEventEmitter.event;
    this.onWriteBufferSize = this._onWriteBufferSizeEventEmitter.event;
    
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

  private _sendBuffers(): void {
    let bytesSent = 0;

    while (this._writeBuffers.length !== 0 && this._remoteBufferSize > 0) { // removeBufferSize < 0 means overdrawn
      const nextBuffer = this._writeBuffers[0];
      if (nextBuffer.length <= this._remoteBufferSize) {
        // Send the whole buffer in one go.
        this._writeBuffers.splice(0, 1);
        this._log.debug(`transmitting ${nextBuffer.length} bytes`);
        WebIpc.writeBulkFile(this._fileIdentifier, nextBuffer);
        bytesSent += nextBuffer.length;
        this._remoteBufferSize -= nextBuffer.length;
      } else {
        // Cut the buffer into two.
        const firstPartBuffer = Buffer.alloc(this._remoteBufferSize);
        nextBuffer.copy(firstPartBuffer, 0, 0, this._remoteBufferSize);
        const secondPartBuffer = Buffer.alloc(nextBuffer.length-this._remoteBufferSize);
        nextBuffer.copy(secondPartBuffer, 0, this._remoteBufferSize);

        this._writeBuffers.splice(0, 1, firstPartBuffer, secondPartBuffer);
        // Let the next run through the loop do the transmission.
      }
    }

    if (bytesSent !== 0) {
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

  setRemoteBufferSize(bufferSize: number): void {
    this._remoteBufferSize = bufferSize;
    this._sendBuffers();
  }

  onWriteBufferSize: Event<number>;
  
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
