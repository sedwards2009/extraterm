/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from 'http';

import  getUri = require('get-uri');  // Top level on this import is a callable, have to use other syntax.
import {BulkFileHandle} from './BulkFileHandle';
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';
import {Logger, getLogger} from '../../logging/Logger';


const BYTES_PER_LINE = 90;

/**
 * Uploads files to a remote process over shell and remote's stdin.
 * 
 * Format is:
 * 
 * '#metadata\n'
 * '#' <base64 encoded metadata JSON string, $BYTES_PER_LINE bytes per line> '\n'
 * '#\n'
 * '#body\n'
 * '#' <base64 encoded binary file data, $BYTES_PER_LINE bytes per line> '\n'
 * '#\n'
 * 
 */
export class BulkFileUploader {
  
  private _log: Logger;
  private _buffer: Buffer = Buffer.alloc(0);
  private _onPtyDataEventEmitter = new EventEmitter<string>();
  private _onUploadedChangeEmitter = new EventEmitter<number>();
  private _onFinishedEmitter = new EventEmitter<void>();
  private _uploadedCount = 0;

  constructor(private _bulkFileHandle: BulkFileHandle) {
    this._log = getLogger("BulkFileUploader", this);
    this.onPtyData = this._onPtyDataEventEmitter.event;
    this.onUploadedChange = this._onUploadedChangeEmitter.event;
    this.onFinished = this._onFinishedEmitter.event;
  }

  onPtyData: Event<string>;
  onUploadedChange: Event<number>;
  onFinished: Event<void>;

  upload(): void {
    this._sendEncodedLine("metadata");
    const jsonString = JSON.stringify(this._bulkFileHandle.getMetadata());
    this._sendEncodedDataToPty(Buffer.from(jsonString, "utf8"));

    this._sendEncodedLine("body");

    const url = this._bulkFileHandle.getUrl();
    if (url.startsWith("data:")) {
      getUri(url, (err, stream) => {
        stream.on('data', this._responseOnData.bind(this));
        stream.on('end', this._responseOnEnd.bind(this));
        stream.on('error', this._reponseOnError.bind(this));
      });
    } else {
      const req = http.request(<any> url, (res) => {
        res.on('data', this._responseOnData.bind(this));
        res.on('end', this._responseOnEnd.bind(this));
      });
      req.on('error', this._reponseOnError.bind(this));
      
      req.end();
    }
  }
  
  private _responseOnData(chunk: Buffer): void {
    this._appendChunkToBuffer(chunk);
    this._sendBuffer();
  }

  private _appendChunkToBuffer(chunk: Buffer): void {
    if (this._buffer.length !== 0) {
      const combinedBuffer = Buffer.alloc(this._buffer.length + chunk.length);
      this._buffer.copy(combinedBuffer);
      chunk.copy(combinedBuffer, this._buffer.length);
      this._buffer = combinedBuffer;
    } else {
      this._buffer = chunk;
    }
  }

  private _sendBuffer(): void {
    const lines = Math.floor(this._buffer.length/BYTES_PER_LINE);
    for (let i = 0; i < lines; i++) {
      const lineBuffer = this._buffer.slice(i*BYTES_PER_LINE, (i+1) * BYTES_PER_LINE);
      this._sendEncodedLine(lineBuffer.toString("base64"));
      this._uploadedCount += lineBuffer.length;
    }

    const remainder = this._buffer.length % BYTES_PER_LINE;
    if (remainder !== 0) {
      const newBuffer = Buffer.alloc(remainder);
      this._buffer.copy(newBuffer, 0, this._buffer.length-remainder, this._buffer.length);
      this._buffer = newBuffer;
    } else {
      this._buffer = Buffer.alloc(0);
    }

    this._onUploadedChangeEmitter.fire(this._uploadedCount);
  }

  private _responseOnEnd(): void {
    this._uploadedCount += this._buffer.length;
    this._sendEncodedDataToPty(this._buffer);

    this._onUploadedChangeEmitter.fire(this._uploadedCount);
    this._onFinishedEmitter.fire(undefined);
  }

  private _reponseOnError(e): void {
    this._log.warn(`Problem with request: ${e.message}`);
  }

  private _sendEncodedLine(line: string): void {
    this._sendDataToPtyEvent("#");
    if (line.length !== 0) {
      this._sendDataToPtyEvent(line);
    }
    this._sendDataToPtyEvent("\n");
  }

  private _sendEncodedDataToPty(buffer: Buffer): void {
    for (let i = 0; i < buffer.length; i += BYTES_PER_LINE) {
      const lineBuffer = buffer.slice(i, Math.min(i + BYTES_PER_LINE, buffer.length));
      this._sendEncodedLine(lineBuffer.toString("base64"));
    }
    this._sendEncodedLine("");  // Terminator
  }

  private _sendDataToPtyEvent(text: string): void {
    this._onPtyDataEventEmitter.fire(text);
  }
}
