/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import  getUri = require('get-uri');  // Top level on this import is a callable, have to use other syntax.
import * as http from 'http';
import {Event} from 'extraterm-extension-api';
import {Transform, Readable} from 'stream';

import {BulkFileHandle} from './BulkFileHandle';
import {Metadata} from '../../main_process/bulk_file_handling/BulkFileStorage';
import {ByteCountingStreamTransform} from '../../utils/ByteCountingStreamTransform';
import {EventEmitter} from '../../utils/EventEmitter';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {Pty} from '../../pty/Pty';


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
  private _onUploadedChangeEmitter = new EventEmitter<number>();
  private _onFinishedEmitter = new EventEmitter<void>();

  constructor(private _bulkFileHandle: BulkFileHandle, private _pty: Pty) {
    this._log = getLogger("BulkFileUploader", this);
    this.onUploadedChange = this._onUploadedChangeEmitter.event;
    this.onFinished = this._onFinishedEmitter.event;
  }

  onUploadedChange: Event<number>;
  onFinished: Event<void>;

  upload(): void {

    const url = this._bulkFileHandle.getUrl();
    if (url.startsWith("data:")) {
      getUri(url, (err, stream) => {
        const lastStage = this._configurePipeline(stream);
        lastStage.on('error', this._reponseOnError.bind(this));
      });
    } else {
      const req = http.request(<any> url, (res) => {
        this._configurePipeline(res);
      });
      req.on('error', this._reponseOnError.bind(this));
      
      req.end();
    }
  }

  private _configurePipeline(sourceStream: NodeJS.ReadableStream): NodeJS.ReadableStream {
    const countingTransform = new ByteCountingStreamTransform();
    sourceStream.pipe(countingTransform);
    countingTransform.onCountUpdate((count: number) => {
      this._onUploadedChangeEmitter.fire(count);
    });

    const encodeTransform = new UploadEncodeDataTransform(this._bulkFileHandle.getMetadata());
    countingTransform.pipe(encodeTransform);

    encodeTransform.on('data', this._responseOnData.bind(this));
    encodeTransform.on('end', this._responseOnEnd.bind(this));
    return encodeTransform;
  }

  private _responseOnData(chunk: Buffer): void {
    this._pty.write(chunk.toString("utf8"));
  }

  private _responseOnEnd(): void {
    this._onFinishedEmitter.fire(undefined);
  }

  private _reponseOnError(e): void {
    this._log.warn(`Problem with request: ${e.message}`);
  }
}


class UploadEncodeDataTransform extends Transform {
  private _log: Logger;

  private _doneIntro = false;
  private _buffer: Buffer = Buffer.alloc(0);

  constructor(private _metadata: Metadata) {
    super();
    this._log = getLogger("UploadEncodeDataTransform", this);
  }

  protected _transform(chunk: Buffer, encoding: string, callback: Function): void {
    this._appendChunkToBuffer(chunk);
    if ( ! this._doneIntro) {
      this._doneIntro = true;
      this._sendHeader();
    }
    this._sendBuffer();

    callback();
  }

  protected _flush(callback: Function): void {
    this._sendEncodedDataToPty(this._buffer);
    callback();
  }

  private _sendHeader(): void {
    this._sendEncodedLine("metadata");
    const jsonString = JSON.stringify(this._metadata);
    this._sendEncodedDataToPty(Buffer.from(jsonString, "utf8"));
    this._sendEncodedLine("body");
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

  private _sendEncodedLine(data: string): void {
    const fullLine = "#" + data + "\n";
    const buf = Buffer.from(fullLine, "utf8");
    this.push(buf);
  }

  private _sendEncodedDataToPty(buffer: Buffer): void {
    for (let i = 0; i < buffer.length; i += BYTES_PER_LINE) {
      const lineBuffer = buffer.slice(i, Math.min(i + BYTES_PER_LINE, buffer.length));
      this._sendEncodedLine(lineBuffer.toString("base64"));
    }
    this._sendEncodedLine("");  // Terminator
  }
}
