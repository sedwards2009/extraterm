/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

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

export class DownloadApplicationModeHandler /* implements ApplicationModeHandler */ {
  private _log: Logger;
  private _state = DownloadHandlerState.IDLE;
  private _encodedDataBuffer: string;
  private _buffer: Buffer = null;
  private _metadataSize: number;

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
    this._buffer = null;
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

  private _handleBody(encodedData: string): TermApi.ApplicationModeResponse {
    this._encodedDataBuffer += encodedData;

    // 4 is the minimum number of bytes we need before we can safely decode base64.
    if (this._encodedDataBuffer.length >= 4) {
      if (this._fileHandle.getAvailableWriteBufferSize()) {
        this._flushBuffer();
      }

      if (this._fileHandle.getAvailableWriteBufferSize() <= 0) {
        return {action: TermApi.ApplicationModeResponseAction.PAUSE};
      }
    }
    return {action: TermApi.ApplicationModeResponseAction.CONTINUE};
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
    if (this._encodedDataBuffer.length === 0) {
      return;
    }

      // base64 data must be decoded in blocks of 4 chars, otherwise bytes will be lost.
    let workingBuffer: string;
    if ((this._encodedDataBuffer.length % 4) === 0) {
      workingBuffer = this._encodedDataBuffer;
      this._encodedDataBuffer = "";
    } else {
      const splitIndex = this._encodedDataBuffer.length - (this._encodedDataBuffer.length % 4);
      workingBuffer = this._encodedDataBuffer.slice(0, splitIndex);
      this._encodedDataBuffer = this._encodedDataBuffer.slice(splitIndex);
    }

    const decodedBytes = Buffer.from(workingBuffer, 'base64');
    if (decodedBytes.length !== 0) {
      this._fileHandle.write(decodedBytes);
    }
  }

  handleStop(): void {
    this._flushBuffer();
    this._fileHandle.close(true);
    this._resetVariables();
  }
}
