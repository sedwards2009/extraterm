/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {BulkFileHandle, BulkFileState, BulkFileMetadata, Disposable} from 'extraterm-extension-api';
import {BulkFileIdentifier} from '../../main_process/bulk_file_handling/BulkFileStorage';
import {getLogger, Logger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as WebIpc from '../WebIpc';
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';
import * as Messages from '../../WindowMessages';


const ONE_KILOBYTE = 1024;

const MAXIMUM_WRITE_BUFFER_SIZE = 512 * 1024;   // Maximum amount of data WriteableBulkFileHandle will buffer internally.
const PACKET_MINIMUM_SIZE = 64 * 1024;          // Minimum size of a write packet to send via IPC.
const INITIAL_REMOTE_BUFFER_SIZE = 256 * 1024;  // Initial (assumed) size of the remote buffer.


export class WriteableBulkFileHandle implements BulkFileHandle {

  private _log: Logger;
  private _refCount = 0;
  private _fileIdentifier: BulkFileIdentifier = null;
  private _url: string = null;
  private _isOpen = true;

  private _onAvailableSizeChangeEventEmitter = new EventEmitter<number>();
  private _onStateChangeEventEmitter = new EventEmitter<BulkFileState>();
  private _onWriteBufferSizeChangeEventEmitter = new EventEmitter<number>();

  private _availableSize = 0;
  private _peekBuffer: SmartBuffer = new SmartBuffer();
  private _writeBuffer: SmartBuffer = new SmartBuffer();

  // These two are used for flow control and keeping track of the
  // available size of the buffer on the remote receiving end.
  private _remoteBufferTotalSize = INITIAL_REMOTE_BUFFER_SIZE;
  private _removeBufferDelta = 0;

  private _closePending = false;
  private _success = true;
  private _state = BulkFileState.DOWNLOADING;

  onAvailableSizeChange: Event<number>;
  onAvailableWriteBufferSizeChange: Event<number>;
  onStateChange: Event<BulkFileState>;

  constructor(private _disposable: Disposable, private _metadata: BulkFileMetadata, private _totalSize: number) {
    this._log = getLogger("WriteableBulkFileHandle", this);

    this.onAvailableSizeChange = this._onAvailableSizeChangeEventEmitter.event;
    this.onStateChange = this._onStateChangeEventEmitter.event;
    this.onAvailableWriteBufferSizeChange = this._onWriteBufferSizeChangeEventEmitter.event;
    
    const {identifier, url} = WebIpc.createBulkFileSync(_metadata, _totalSize);
    this._fileIdentifier = identifier;
    this._url = url;
  }

  getState(): BulkFileState {
    return this._state;
  }

  getBulkFileIdentifier(): BulkFileIdentifier {
    return this._fileIdentifier;
  }

  getUrl(): string {
    return this._url;
  }

  getAvailableSize(): number {
    return this._availableSize;
  }

  getTotalSize(): number {
    return this._totalSize;
  }

  getMetadata(): BulkFileMetadata {
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

  getReferenceCount(): number {
    return this._refCount;
  }

  write(data: Buffer): void {
    if ( ! this._isOpen) {
      this._log.warn("Write attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }

    this._writePeekBuffer(data);
    this._writeBuffer.writeBuffer(data);
    this._sendBuffers();
  }

  getAvailableWriteBufferSize(): number {
    return MAXIMUM_WRITE_BUFFER_SIZE - this._writeBuffer.length;
  }

  private _getAvailableRemoteBufferSize(): number {
    return this._remoteBufferTotalSize + this._removeBufferDelta;
  }

  private _sendBuffers(): void {
    const packetThreshold = this._closePending ? 0 : PACKET_MINIMUM_SIZE - 1;

    if (this._writeBuffer.length > packetThreshold && this._getAvailableRemoteBufferSize() > packetThreshold) {
      const plainWriteBuffer = this._writeBuffer.toBuffer();
      
      let xferBuffer: Buffer;
      let remainingBuffer: SmartBuffer;
      
      if (plainWriteBuffer.length <= this._getAvailableRemoteBufferSize()) {
        // Send the whole buffer in one go.
        xferBuffer = plainWriteBuffer;
        remainingBuffer = new SmartBuffer();
      } else {

        // Cut the buffer into two.
        xferBuffer = Buffer.alloc(this._getAvailableRemoteBufferSize());
        plainWriteBuffer.copy(xferBuffer, 0, 0, this._getAvailableRemoteBufferSize());

        const secondPartBuffer = Buffer.alloc(plainWriteBuffer.length - this._getAvailableRemoteBufferSize());
        plainWriteBuffer.copy(secondPartBuffer, 0, this._getAvailableRemoteBufferSize());
        remainingBuffer = new SmartBuffer();
        remainingBuffer.writeBuffer(secondPartBuffer);
      }

      WebIpc.writeBulkFile(this._fileIdentifier, xferBuffer);

      this._writeBuffer = remainingBuffer;
      this._removeBufferDelta -= xferBuffer.length;

      this._availableSize += xferBuffer.length;
      this._onAvailableSizeChangeEventEmitter.fire(this._availableSize);
    }

    if (this._closePending && this._writeBuffer.length === 0) {
      WebIpc.closeBulkFile(this._fileIdentifier, this._success);
      this._isOpen = false;
      this._closePending = false;
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
      this._onWriteBufferSizeChangeEventEmitter.fire(this.getAvailableWriteBufferSize());
    });
  }

  updateState(state: BulkFileState): void {
    this._state = state;
    process.nextTick(() => {
      this._onStateChangeEventEmitter.fire(state);
    });
  }

  close(success: boolean): void {
    if ( ! this._isOpen) {
      this._log.warn("Close attempted on a closed WriteableBulkFileHandle! ", this._fileIdentifier);
      return;
    }

    this._closePending = true;
    this._success = success;
    this._sendBuffers();
  }
}


/**
 * Render process side class for managing the creation and use of bulk files
 * which are stored in the main process.
 */
export class BulkFileBroker {

  private _fileHandleMap = new Map<BulkFileIdentifier, WriteableBulkFileHandle>();
  private _log: Logger;

  constructor() {
    this._log = getLogger("BulkFileBroker", this);
    WebIpc.registerDefaultHandler(Messages.MessageType.BULK_FILE_BUFFER_SIZE,
      this._handleBufferSizeMessage.bind(this));
      WebIpc.registerDefaultHandler(Messages.MessageType.BULK_FILE_STATE,
        this._handleBufferStateMessage.bind(this));        
  }

  createWriteableBulkFileHandle(metadata: BulkFileMetadata, size: number): WriteableBulkFileHandle {
    let newFileHandle: WriteableBulkFileHandle = null;
    newFileHandle = new WriteableBulkFileHandle({dispose: () => this._dispose(newFileHandle) }, metadata, size);
    this._fileHandleMap.set(newFileHandle.getBulkFileIdentifier(), newFileHandle);
    return newFileHandle;
  }

  private _dispose(fileHandle: WriteableBulkFileHandle): void {
    process.nextTick(() => {
      if (fileHandle.getReferenceCount() <= 0) {
        const identifier = fileHandle.getBulkFileIdentifier();
        WebIpc.derefBulkFile(identifier);
        this._fileHandleMap.delete(identifier);
      }
    });
  }

  private _handleBufferSizeMessage(msg: Messages.BulkFileBufferSizeMessage): void {
    if (this._fileHandleMap.has(msg.identifier)) {
      this._fileHandleMap.get(msg.identifier).updateRemoteBufferSize(msg.totalBufferSize, msg.availableDelta);
    }
  }

  private _handleBufferStateMessage(msg: Messages.BulkFileStateMessage): void {
    if (this._fileHandleMap.has(msg.identifier)) {
      this._fileHandleMap.get(msg.identifier).updateState(msg.state);
    }
  }
}
