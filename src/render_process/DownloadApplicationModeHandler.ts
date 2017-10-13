/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../utils/EventEmitter';
import {Logger, getLogger} from '../logging/Logger';
import {BulkFileBroker, WriteableBulkFileHandle} from './bulk_file_handling/BulkFileBroker';
import {BulkFileHandle} from './bulk_file_handling/BulkFileHandle';


const DOWNLOAD_HANDLER_BUFFER_SIZE = 4*1024;

enum DownloadHandlerState {
  IDLE,
  READING_METADATA,
  READING,
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
  
  constructor(private _broker: BulkFileBroker) {
    this._log = getLogger("DownloadHandler", this);
    this.onCreatedBulkFile = this._onCreatedBulkFileEventEmitter.event;
    this._resetVariables();
  }

  private _resetVariables(): void {
    this._state = DownloadHandlerState.IDLE;
    this._encodedDataBuffer = "";
    this._buffer = null;
    this._metadataSize = -1;
    this._fileHandle = null;
  }

  // FIXME this is temporary.
  getBulkFileHandle(): BulkFileHandle {
    return this._fileHandle;
  }

  handleStart(parameters: string[]): void {

    const metadataSize = parseInt(parameters[0], 10);

    this._metadataSize = metadataSize;
    this._state = DownloadHandlerState.READING_METADATA;
  }

  /**
   * 
   * @param data base64 data
   */
  handleData(data: string): void {
    switch (this._state) {
      case DownloadHandlerState.READING_METADATA:
        this._handleDataReadingMetadata(data);
        break;
    
      case DownloadHandlerState.READING:
        this._handleDataRead(data);
        break;
        
      case DownloadHandlerState.ERROR:
        break;
        
      default:
        this._log.warn("handleDownloadData called while in state ", DownloadHandlerState[this._state]);
        break;
    }
  }

  private _handleDataReadingMetadata(encodedData: string): void {
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
      this._fileHandle.onWriteBufferSize(this._handleWriteBufferAvailable.bind(this));
      this._state = DownloadHandlerState.READING;
      this._handleDataRead("");

      this._onCreatedBulkFileEventEmitter.fire(this._fileHandle);
    }
  }

  private _handleDataRead(encodedData: string): void {
    this._encodedDataBuffer += encodedData;

    if (this._encodedDataBuffer.length >= DOWNLOAD_HANDLER_BUFFER_SIZE) {
      this._flushBuffer();
    }

  }

  private _handleWriteBufferAvailable(bufferSize: number): void {
    this._log.debug(`Write buffer size ${bufferSize}`);


  }

  private _flushBuffer(): void {
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
    this._fileHandle.write(decodedBytes);
  }

  handleStop(): void {
    this._flushBuffer();
    this._fileHandle.close();
    this._resetVariables();
  }
}
