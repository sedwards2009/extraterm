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


const DOWNLOAD_HANDLER_BUFFER_SIZE = 3*1024;

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

  private _flushBuffer(): void {
    const buf = Buffer.from(this._encodedDataBuffer, 'base64');
    this._fileHandle.write(buf);
  }

  handleStop(): void {
    this._flushBuffer();
    this._fileHandle.close();
    this._resetVariables();
  }
}
