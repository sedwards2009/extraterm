/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import  getUri = require('get-uri');  // Top level on this import is a callable, have to use other syntax.
import * as http from 'http';
import {Event, Disposable} from 'extraterm-extension-api';
import {Transform, Readable} from 'stream';

import {BulkFileHandle} from './BulkFileHandle';
import {Metadata} from '../../main_process/bulk_file_handling/BulkFileStorage';
import {ByteCountingStreamTransform} from '../../utils/ByteCountingStreamTransform';
import {DisposableHolder} from '../../utils/DisposableUtils';
import {EventEmitter} from '../../utils/EventEmitter';
import {Logger, getLogger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import {Pty, BufferSizeChange} from '../../pty/Pty';


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
export class BulkFileUploader implements Disposable {
  
  private _log: Logger;
  private _buffer: Buffer = Buffer.alloc(0);
  private _onUploadedChangeEmitter = new EventEmitter<number>();
  private _onFinishedEmitter = new EventEmitter<void>();
  private _dataPipe: NodeJS.ReadableStream = null;
  private _nextStringChunk: string = null;
  private _disposables = new DisposableHolder();
  
  constructor(private _bulkFileHandle: BulkFileHandle, private _pty: Pty) {
    this._log = getLogger("BulkFileUploader", this);

    this._disposables.add(this._onUploadedChangeEmitter);
    this._disposables.add(this._onFinishedEmitter);

    this.onUploadedChange = this._onUploadedChangeEmitter.event;
    this.onFinished = this._onFinishedEmitter.event;
  }

  abort(): void {
  }

  dispose(): void {
    this._disposables.dispose();
  }

  onUploadedChange: Event<number>;
  onFinished: Event<void>;

  upload(): void {

    const url = this._bulkFileHandle.getUrl();
    if (url.startsWith("data:")) {
      getUri(url, (err, stream) => {
        this._dataPipe = this._configurePipeline(stream);
        this._dataPipe.on('error', this._reponseOnError.bind(this));
      });
    } else {
      const req = http.request(<any> url, (res) => {
        this._dataPipe = this._configurePipeline(res);
      });
      req.on('error', this._reponseOnError.bind(this));
      
      req.end();
    }

    this._disposables.add(this._pty.onAvailableWriteBufferSizeChange(
      this._handlePtyWriteBufferSizeChange.bind(this)));
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
    const nextStringChunk = chunk.toString("utf8");
    if (nextStringChunk.length <= this._pty.getAvailableWriteBufferSize()) {
      this._pty.write(nextStringChunk);
    } else {
      this._nextStringChunk = nextStringChunk;
      this._dataPipe.pause();
    }
  }

  private _handlePtyWriteBufferSizeChange(bufferSizeChange: BufferSizeChange): void {
    if (this._nextStringChunk != null && this._nextStringChunk.length <= this._pty.getAvailableWriteBufferSize()) {
      this._pty.write(this._nextStringChunk);
      this._nextStringChunk = null;
      this._dataPipe.resume();
    }
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
    this._sendLine("D", this._buffer);
    this._sendLine("E", null);
    callback();
  }

  private _sendHeader(): void {
    const jsonString = JSON.stringify(this._metadata);
    this._sendLine("M", Buffer.from(jsonString, "utf8"));
  }

  private _sendLine(command: string, content: Buffer): void {
    this.push("#" + command + ":");
    if (content !== null && content.length !==0) {
      this.push(content.toString("base64"));
    }
    this.push(":0123456789012345678901234567890123456789012345678901234567890123\n");
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
      this._sendLine("D", lineBuffer);
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
}
