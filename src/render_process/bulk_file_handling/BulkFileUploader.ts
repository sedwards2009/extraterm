/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as http from 'http';

import {BulkFileHandle} from './BulkFileHandle';
import {Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';


export class BulkFileUploader {
  
  private _buffer: Buffer = Buffer.alloc(0);

  private _onPtyDataEventEmitter = new EventEmitter<string>();

  constructor(private _bulkFileHandle: BulkFileHandle) {
    this.onPtyData = this._onPtyDataEventEmitter.event;
  }

  onPtyData: Event<string>;

  upload(): void {
    this._sendEncodedLine("metadata");
    const jsonString = JSON.stringify(this._bulkFileHandle.getMetadata());
    this._sendEncodedDataToPty(Buffer.from(jsonString, "utf8"));

    this._sendEncodedLine("body");

    const req = http.request(<any> this._bulkFileHandle.getUrl(), (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

      res.on('data', this._responseOnData.bind(this));
      res.on('end', this._responseOnEnd.bind(this));
    });
    req.on('error', this._reponseOnError.bind(this));
    
    req.end();
  }
  
  private _responseOnData(chunk: Buffer): void {
    console.log(`BODY: ${chunk.length}`);
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
    const BYTES_PER_LINE = 90;
    const lines = Math.floor(this._buffer.length/BYTES_PER_LINE);
    for (let i = 0; i < lines; i++) {
      const lineBuffer = this._buffer.slice(i*BYTES_PER_LINE, (i+1) * BYTES_PER_LINE);
      this._sendEncodedLine(lineBuffer.toString("base64"));
    }

    const remainder = this._buffer.length % BYTES_PER_LINE;
    if (remainder !== 0) {
      const newBuffer = Buffer.alloc(remainder);
      this._buffer.copy(newBuffer, 0, this._buffer.length-remainder, this._buffer.length);
      this._buffer = newBuffer;
    } else {
      this._buffer = Buffer.alloc(0);
    }
  }

  private _responseOnEnd(): void {
    console.log('No more data in response.');
    this._sendEncodedDataToPty(this._buffer);
  }

  private _reponseOnError(e): void {
    console.error(`problem with request: ${e.message}`);
  }

  private _sendEncodedLine(line: string): void {
    this._sendDataToPtyEvent("#");
    if (line.length !== 0) {
      this._sendDataToPtyEvent(line);
    }
    this._sendDataToPtyEvent("\n");
  }

  private _sendEncodedDataToPty(buffer: Buffer): void {
    const BYTES_PER_LINE = 90;
    let i = 0;
    for (i = 0; i < buffer.length; i += BYTES_PER_LINE) {
      const lineBuffer = buffer.slice(i, Math.min(i + BYTES_PER_LINE, buffer.length));
      this._sendEncodedLine(lineBuffer.toString("base64"));
    }
    this._sendEncodedLine("");  // Terminator
  }

  private _sendDataToPtyEvent(text: string): void {
    this._onPtyDataEventEmitter.fire(text);
  }
}
