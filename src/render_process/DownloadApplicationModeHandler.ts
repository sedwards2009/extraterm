/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as crypto from 'crypto';
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../utils/EventEmitter';
import {Logger, getLogger} from '../logging/Logger';
import log from '../logging/LogDecorator';

import {BulkFileBroker, WriteableBulkFileHandle} from './bulk_file_handling/BulkFileBroker';
import {BulkFileHandle} from './bulk_file_handling/BulkFileHandle';
import * as TermApi from './emulator/TermApi';


enum DownloadHandlerState {
  IDLE,
  METADATA,
  BODY,
  ERROR
}

const MAX_CHUNK_BYTES = 3 * 1024;
const invalidBodyRegex = /[^\n\rA-Za-z0-9/+:=]/;


export class DownloadApplicationModeHandler /* implements ApplicationModeHandler */ {
  private _log: Logger;
  private _state = DownloadHandlerState.IDLE;
  private _encodedDataBuffer: string;
  private _decodedDataBuffers: Buffer[] = [];
  private _metadataSize: number;
  private _previousHash: Buffer = null;
  private _fileHandle : WriteableBulkFileHandle = null;

  onCreatedBulkFile: Event<BulkFileHandle>;
  private _onCreatedBulkFileEventEmitter = new EventEmitter<BulkFileHandle>();
  
  constructor(private _emulator: TermApi.EmulatorApi, private _broker: BulkFileBroker) {
    this._log = getLogger("DownloadApplicationModeHandler", this);
    this.onCreatedBulkFile = this._onCreatedBulkFileEventEmitter.event;
    this._resetVariables();
  }

  private _resetVariables(): void {
    this._state = DownloadHandlerState.IDLE;
    this._encodedDataBuffer = "";
    this._decodedDataBuffers = [];
    this._metadataSize = -1;

    if (this._fileHandle !== null) {
      this._fileHandle.deref();
    }
    this._fileHandle = null;
  }

  handleStart(parameters: string[]): TermApi.ApplicationModeResponse {
    const metadataSize = parseInt(parameters[0], 10);

    this._metadataSize = metadataSize;
    this._state = DownloadHandlerState.METADATA;
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  /**
   * 
   * @param data base64 data
   */
  handleData(data: string): TermApi.ApplicationModeResponse {
    switch (this._state) {
      case DownloadHandlerState.METADATA:
        this._handleMetadata(data);
        break;
    
      case DownloadHandlerState.BODY:
        return this._handleBody(data);
        
      case DownloadHandlerState.ERROR:
        break;
        
      default:
        this._log.warn("handleDownloadData called while in state ", DownloadHandlerState[this._state]);
        break;
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _handleMetadata(encodedData: string): void {
    this._encodedDataBuffer += encodedData;
    if (this._encodedDataBuffer.length >= this._metadataSize) {
      let metadata = null;
      try {
        metadata = JSON.parse(encodedData.substr(0, this._metadataSize));
      } catch(ex) {
        this._log.warn("Unable to parse JSON metadata.", ex);
        this._state = DownloadHandlerState.ERROR;
        return;
      }
      this._encodedDataBuffer = this._encodedDataBuffer.slice(this._metadataSize);

      this._fileHandle = this._broker.createWriteableBulkFileHandle(metadata, -1);
      this._fileHandle.ref();
      this._fileHandle.onAvailableWriteBufferSizeChanged(this._handleAvailableWriteBufferSizeChanged.bind(this));
      this._state = DownloadHandlerState.BODY;
      this._handleBody("");

      this._onCreatedBulkFileEventEmitter.fire(this._fileHandle);
    }
  }

  private _closeFileHandle(success: boolean): void {
    this._fileHandle.close(success);
    this._fileHandle.deref();
    this._fileHandle = null;
  }

  private _handleBody(encodedData: string): TermApi.ApplicationModeResponse {
    const MAX_ENCODED_LENGTH = MAX_CHUNK_BYTES * 4 / 3;
    
    // MAX_ENCODED_LENGTH + : + <sha256.length>
    const HASH_LENGTH = 64;
    const MAX_ENCODED_LINE_LENGTH = MAX_ENCODED_LENGTH + 1 + HASH_LENGTH;

    this._encodedDataBuffer += encodedData;
    
    // Check for invalid characters which may indicate a crash on the remote side.
    if (invalidBodyRegex.test(this._encodedDataBuffer)) {
      this._closeFileHandle(false);
      return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
    }

    let splitIndex = this._determineBufferSplitPosition();
    while (splitIndex !== -1) {

      const chunk = this._encodedDataBuffer.slice(0, splitIndex);
      const tail = this._encodedDataBuffer.slice(splitIndex);
      if (tail.startsWith("\n") || tail.startsWith("\r")) {
        this._encodedDataBuffer = tail.slice(1);
      } else {
        this._encodedDataBuffer = tail;
      }
      
      if (chunk.length !== 0) {
        const colonIndex = chunk.length - HASH_LENGTH - 1;
        const colon = chunk.charAt(colonIndex);
        if (colon !== ":") {
          this._closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
        }
        
        const base64Data = chunk.slice(0, colonIndex);
        const hashHex = chunk.slice(colonIndex+1);

        const decodedBytes = Buffer.from(base64Data, 'base64');

        // Check the hash.
        const hash = crypto.createHash("sha256");
        if (this._previousHash !== null) {
          hash.update(this._previousHash);
        }
        hash.update(decodedBytes);
        this._previousHash = hash.digest();
        if (this._previousHash.toString("hex") !== hashHex) {
          this._closeFileHandle(false);
          return {action: TermApi.ApplicationModeResponseAction.ABORT, remainingData: this._encodedDataBuffer};
        }

        this._decodedDataBuffers.push(decodedBytes);
      }
      splitIndex = this._determineBufferSplitPosition();
    }

    this._flushBuffer();

    if (this._fileHandle.getAvailableWriteBufferSize() <= 0) {
      return {action: TermApi.ApplicationModeResponseAction.PAUSE};
    }

    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
  }

  private _determineBufferSplitPosition(): number {
    const MAX_ENCODED_LENGTH = MAX_CHUNK_BYTES * 4 / 3;
    
    // MAX_ENCODED_LENGTH + : + <sha256.length>
    const MAX_ENCODED_LINE_LENGTH = MAX_ENCODED_LENGTH + 1 + 64;
    
    let newLineIndex = this._encodedDataBuffer.indexOf("\n");
    let crIndex = this._encodedDataBuffer.indexOf("\r");

    newLineIndex = newLineIndex === -1 ? Number.MAX_SAFE_INTEGER : newLineIndex;
    crIndex = crIndex === -1 ? Number.MAX_SAFE_INTEGER : crIndex;

    let splitIndex = Math.min(newLineIndex, crIndex);
    if (splitIndex !== Number.MAX_SAFE_INTEGER) {
      return Math.min(splitIndex, MAX_ENCODED_LINE_LENGTH);
    } else if (this._encodedDataBuffer.length >= MAX_ENCODED_LINE_LENGTH) {
      return MAX_ENCODED_LINE_LENGTH;
    }
    return -1;
  }

  private _handleAvailableWriteBufferSizeChanged(bufferSize: number): void {
    // this._log.debug(`Write buffer size ${bufferSize}`);
    if (this._fileHandle == null) {
      return;
    }

    if (bufferSize > 0) {
      this._flushBuffer();
      this._emulator.resumeProcessing();
    }
  }

  private _flushBuffer(): void {
    while (this._decodedDataBuffers.length !== 0 && this._fileHandle.getAvailableWriteBufferSize() > 0) {
      const availableSize = this._fileHandle.getAvailableWriteBufferSize();
      
      const nextBuffer = this._decodedDataBuffers[0];
      this._decodedDataBuffers.splice(0, 1);

      let xferBuffer: Buffer = nextBuffer;
      if (nextBuffer.length > availableSize) {
        // Buffer is bigger than available size. Split it.
        xferBuffer = Buffer.alloc(availableSize);
        nextBuffer.copy(xferBuffer, 0, 0, availableSize);

        const secondPartBuffer = Buffer.alloc(xferBuffer.length - availableSize);
        nextBuffer.copy(secondPartBuffer, 0, availableSize);
        this._decodedDataBuffers.splice(0, 1, secondPartBuffer);
      }

      this._fileHandle.write(xferBuffer);
    }
  }

  handleStop(): void {
    this._flushBuffer();
    this._fileHandle.close(true);
    this._resetVariables();
  }
}
