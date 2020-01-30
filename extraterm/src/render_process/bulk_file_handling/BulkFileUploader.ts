/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import  getUri = require('get-uri');  // Top level on this import is a callable, have to use other syntax.
import * as http from 'http';
import {BulkFileHandle, BulkFileMetadata, Event, Disposable} from 'extraterm-extension-api';

import {ByteCountingStreamTransform} from '../../utils/ByteCountingStreamTransform';
import {DisposableHolder} from '../../utils/DisposableUtils';
import {EventEmitter} from '../../utils/EventEmitter';
import {Logger, getLogger} from "extraterm-logging";
import { log } from "extraterm-logging";
import {Pty, BufferSizeChange} from '../../pty/Pty';


const BYTES_PER_LINE = 3 * 240;
const DEBUG = false;
const HASH_LENGTH = 20; // 20 hex chars hash length


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
  private _onUploadedChangeEmitter = new EventEmitter<number>();
  private _onFinishedEmitter = new EventEmitter<void>();
  private _uploadEncoder: UploadEncoder = null;
  private _stringChunkBuffer: string[] = [];
  private _disposables = new DisposableHolder();
  private _sourceStream: NodeJS.ReadableStream = null;
  private _sourceHttpStream: http.IncomingMessage = null;
  private _pipeEnd: NodeJS.ReadableStream = null;
  private _isEnding = false;
  private _aborted = false;

  constructor(private _bulkFileHandle: BulkFileHandle, private _pty: Pty) {
    this._log = getLogger("BulkFileUploader", this);

    this.onUploadedChange = this._onUploadedChangeEmitter.event;
    this.onFinished = this._onFinishedEmitter.event;
  }

  abort(): void {
    if (this._uploadEncoder != null) {
      this._uploadEncoder.abort();

      this._pipeEnd.removeAllListeners();
      if (this._sourceHttpStream != null) {
        this._sourceHttpStream.destroy();
        this._sourceHttpStream = null;
      }
    }
    this._aborted = true;
    this._onFinishedEmitter.fire(undefined);
  }

  dispose(): void {
    if (this._sourceHttpStream != null) {
      this._sourceHttpStream.destroy();
      this._sourceHttpStream = null;
    }

    this._disposables.dispose();
  }

  onUploadedChange: Event<number>;
  onFinished: Event<void>;

  upload(): void {
    const url = this._bulkFileHandle.getUrl();
    if (url.startsWith("data:")) {
      getUri(url, (err, stream) => {
        this._sourceStream = stream;
        [this._pipeEnd , this._uploadEncoder] = this._configurePipeline(stream);
        this._sourceStream.on('error', this._responseOnError.bind(this));
      });
    } else {
      const req = http.request(<any> url, res => {
        this._sourceHttpStream = res;
        [this._pipeEnd, this._uploadEncoder] = this._configurePipeline(res);
      });
      req.on('error', this._responseOnError.bind(this));
      
      req.end();
    }

    this._disposables.add(this._pty.onAvailableWriteBufferSizeChange(
      this._handlePtyWriteBufferSizeChange.bind(this)));
  }

  private _configurePipeline(sourceStream: NodeJS.ReadableStream): [NodeJS.ReadableStream, UploadEncoder] {
    const byteCountingTransform = new ByteCountingStreamTransform();
    let countSleep = 1024*1024;
    byteCountingTransform.onCountUpdate((count: number) => {
      if (DEBUG) {
        if (count > countSleep) {
          this._log.debug("byte count is ", count / (1024*1024), "MiB");
          countSleep += 1024*1024;
        }
      }
      this._onUploadedChangeEmitter.fire(count);
    });

    sourceStream.pipe(byteCountingTransform);
    const encoder = new UploadEncoder(this._bulkFileHandle.getMetadata(), byteCountingTransform);

    encoder.onData(this._responseOnData.bind(this));
    encoder.onEnd(this._responseOnEnd.bind(this));
    return [byteCountingTransform, encoder];
  }

  private _responseOnData(nextStringChunk: string): void {
    if (this._aborted) {
      return;
    }

    if (DEBUG) {
      this._log.debug("_responseOnData this._pty.getAvailableWriteBufferSize() = ",this._pty.getAvailableWriteBufferSize());
    }

    this._appendToStringChunkBuffer(nextStringChunk);
    this._transmitStringChunkBuffer();

    if(this._stringChunkBuffer.length !== 0) {
      if (this._sourceHttpStream != null) {
        this._sourceHttpStream.pause();
      }
      if (this._sourceStream != null) {
        this._sourceStream.pause();
      }
    }
  }

  private _appendToStringChunkBuffer(stringChunk: string): void {
    this._stringChunkBuffer.push(stringChunk);
    if (DEBUG) {
      this._log.debug("this._stringChunkBuffer.length = ", this._stringChunkBuffer.length);
    }
  }

  private _handlePtyWriteBufferSizeChange(bufferSizeChange: BufferSizeChange): void {
    if (DEBUG) {
      this._log.debug(`availableDelta: ${bufferSizeChange.availableDelta}, totalBufferSize: ${bufferSizeChange.totalBufferSize}, availableWriteBufferSize: ${this._pty.getAvailableWriteBufferSize()}`);
    }

    this._transmitStringChunkBuffer();

    // If we were finishing up and there is no more work to do then signal finished.
    if (this._stringChunkBuffer.length === 0 && this._isEnding) {
      this._isEnding = false;
      this._onFinishedEmitter.fire(undefined);
      return;
    }

    if (this._stringChunkBuffer.length === 0) {
      if (DEBUG) {
        this._log.debug(`resuming, availableWriteBufferSize: ${this._pty.getAvailableWriteBufferSize()}`);
      }
      if (this._sourceHttpStream != null) {
        this._sourceHttpStream.resume();
      }
      if (this._sourceStream != null) {
        this._sourceStream.resume();
      }
    }
  }

  private _transmitStringChunkBuffer(): void {
    while (this._stringChunkBuffer.length !== 0 && this._stringChunkBuffer[0].length <= this._pty.getAvailableWriteBufferSize()) {
      const nextStringChunk = this._stringChunkBuffer[0];
      this._stringChunkBuffer.splice(0, 1);
      this._pty.write(nextStringChunk);
    }
  }

  private _responseOnEnd(): void {
    if (this._stringChunkBuffer.length !== 0) {
      this._isEnding = true;
    } else {
      this._onFinishedEmitter.fire(undefined);
    }
  }

  private _responseOnError(e): void {
    this._log.warn(`Problem with request: ${e.message}`);
  }
}


class UploadEncoder {

  private _log: Logger;
  private _doneIntro = false;
  private _buffer: Buffer = Buffer.alloc(0);
  private _abort = false;
  private _previousHash: Buffer = null;
  private _onDataEmitter = new EventEmitter<string>();
  private _onEndEmitter = new EventEmitter<undefined>();

  onData: Event<string>;
  onEnd: Event<undefined>;

  constructor(private _metadata: BulkFileMetadata, private _readable: NodeJS.ReadableStream) {
    this._log = getLogger("UploadEncoder", this);
    this.onData = this._onDataEmitter.event;
    this.onEnd = this._onEndEmitter.event;

    this._readable.on('data', this._responseOnData.bind(this));
    this._readable.on('end', this._responseOnEnd.bind(this));
  }

  private _responseOnData(chunk: Buffer): void {
    if ( ! this._abort) {
      this._appendChunkToBuffer(chunk);
      if ( ! this._doneIntro) {
        this._doneIntro = true;
        this._sendHeader();
      }
      this._sendBuffer();
    }
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

  private _sendHeader(): void {
    const jsonString = JSON.stringify(this._metadata);
    this._sendLine("M", Buffer.from(jsonString, "utf8"));
  }

  private _sendLine(command: string, content: Buffer): void {
    if (DEBUG) {
      this._log.debug("_sendLine command=",command);
    }
    this._onDataEmitter.fire(this._encodeLine(command, content));
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

  private _encodeLine(command: string, content: Buffer): string {
    const parts: string[] = [];

    parts.push("#");
    parts.push(command);
    parts.push(":");

    const hash = crypto.createHash("sha256");
    if (this._previousHash !== null) {
      hash.update(this._previousHash);
    }

    if (content !== null && content.length !==0) {
      hash.update(content);
      parts.push(content.toString("base64"));
    }

    this._previousHash = hash.digest();

    parts.push(":");
    parts.push(this._previousHash.toString("hex").substr(0, HASH_LENGTH));
    parts.push("\n");

    return parts.join("");
  }

  private _responseOnEnd(): void {
    if ( ! this._abort) {
      this._sendLine("D", this._buffer);
      this._sendLine("E", null);
    }
    this._onEndEmitter.fire(undefined);
  }

  abort(): void {
    this._abort = true;
    this._sendLine("A", null);
  }
}
