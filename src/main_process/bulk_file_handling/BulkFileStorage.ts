/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import * as http from 'http';
import * as path from 'path';
import {protocol} from 'electron';
import {Event} from 'extraterm-extension-api';

import {getLogger, Logger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';

import * as MimeTypeDetector from '../../mimetype_detector/MimeTypeDetector';
import {WriterReaderFile} from './WriterReaderFile';
import {EventEmitter} from '../../utils/EventEmitter';


export type BulkFileIdentifier = string;

export interface Metadata {
  readonly [index: string]: (string | number);
}

export type BufferSizeEvent = {identifier: BulkFileIdentifier, totalBufferSize: number, availableDelta: number};

/**
 * Responsible for the temporary storage of large files and serving them via a pseudo web protocol.
 */
export class BulkFileStorage {

  private _log: Logger; 
  private _storageMap = new Map<BulkFileIdentifier, BulkFile>();
  private _server: BulkFileProtocolConnector = null;

  private _onWriteBufferSizeEventEmitter = new EventEmitter<BufferSizeEvent>();

  constructor(private _storageDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
    this._server = new BulkFileProtocolConnector(this);
    this.onWriteBufferSize = this._onWriteBufferSizeEventEmitter.event;
  }

  onWriteBufferSize: Event<BufferSizeEvent>;
  
  createBulkFile(metadata: Metadata, size: number): BulkFileIdentifier {
    const identifier = crypto.randomBytes(16).toString('hex');
    this._log.debug("Creating bulk file with identifier: ", identifier);

    const fullPath = path.join(this._storageDirectory, identifier);

    
    const bulkFile = new BulkFile(metadata, fullPath);
    bulkFile.onWriteBufferSize(({totalBufferSize, availableDelta}): void => {
      this._onWriteBufferSizeEventEmitter.fire({identifier, totalBufferSize, availableDelta});
    });
    this._storageMap.set(identifier, bulkFile);
    return identifier;
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this._log.debug(`Writing ${data.length} bytes to identifier ${identifier}`);

    this._storageMap.get(identifier).write(data);
  }

  close(identifier: BulkFileIdentifier): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    
    this._log.debug(`Closing identifier ${identifier}`);
    this._storageMap.get(identifier).close();
  }


  getBulkFileByIdentifier(identifier: BulkFileIdentifier): BulkFile {
    if ( ! this._storageMap.has(identifier)) {
      return null;
    }
    return this._storageMap.get(identifier);
  }
}


export class BulkFile {

  private _log: Logger; 
  private _writeStreamOpen = true;

  private _wrFile: WriterReaderFile = null;
  private _writeBuffers: Buffer[] = [];
  private _writeBlocked = false;

  private _maximumBufferedSize = 1024;  // FIXME make bigger
  private _closePending = false;
  private _onWriteBufferSizeEventEmitter = new EventEmitter<{totalBufferSize: number, availableDelta: number}>();

  constructor(private  _metadata: Metadata, fullPath: string) {
    this._log = getLogger("BulkFile", this);
    this._wrFile = new WriterReaderFile(fullPath);
    this._wrFile.getWriteStream().on('drain', this._handleDrain.bind(this));
    this.onWriteBufferSize = this._onWriteBufferSizeEventEmitter.event;
  }

  write(data: Buffer): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }

    this._writeBuffers.push(data);
    this._sendWriteBuffers();
  }

  private _sendWriteBuffers(): void {
    const stream = this._wrFile.getWriteStream();
    let availableDelta = 0;
    while ( ! this._writeBlocked && this._writeBuffers.length !== 0) {
      const nextBuffer = this._writeBuffers[0];
      this._writeBuffers.splice(0 ,1);
      this._writeBlocked = ! stream.write(nextBuffer);
      availableDelta += nextBuffer.length;
    }

    if (this._writeBuffers.length === 0 && this._closePending) {
      stream.end();
      this._writeStreamOpen = false;
      this._closePending = false;
    }
    if (availableDelta !== 0) {
      this._emitWriteBufferSize(availableDelta);
    }
  }

  private _emitWriteBufferSize(availableDelta: number): void {
    const totalBufferSize = this._maximumBufferedSize;
    this._log.debug(`_emitWriteBufferSize -> totalBufferSize: ${totalBufferSize} availableDelta: ${availableDelta}`);
    this._onWriteBufferSizeEventEmitter.fire({totalBufferSize, availableDelta});
  }

  private _pendingBufferSize(): number {
    let total = 0;
    for (const buf of this._writeBuffers) {
      total += buf.length;
    }
    return total;
  }
  
  onWriteBufferSize: Event<{totalBufferSize: number, availableDelta: number}>;

  close(): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }
    this._closePending = true;
    this._sendWriteBuffers();
  }

  private _handleDrain(): void {
    this._writeBlocked = false;
    this._sendWriteBuffers();
  }

  createReadStream(): NodeJS.ReadableStream {
    return this._wrFile.createReadStream();
  }
}

const PROTOCOL_SCHEME = "bulk";


class BulkFileProtocolConnector {

  private _log: Logger = null;
  private _server: http.Server = null;
  private _port = -1;

  constructor(private _storage: BulkFileStorage) {
    this._log = getLogger("BulkFileProtocolConnector", this);
    this._startServer();
    this._createWebProtocol();
  }

  private _startServer(): void {
    this._log.debug("Starting bulk file server");

    this._server = http.createServer(this._handleRequest.bind(this));    
    this._server.listen(0, "127.0.0.1", () => {
      this._port = this._server.address().port;
      this._log.debug(`Server running on 127.0.0.1 port ${this._port}`);
    });
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this._log.debug("req.url.slice(1): ", );
    const identifier = req.url.slice(1);
    const bulkFile = this._storage.getBulkFileByIdentifier(identifier);
    if (bulkFile == null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found\n');
      return;
    }

    // const rawData = bulkFile.smartBuffer.toBuffer();
    // const metadata = bulkFile.metadata;
    // const filename = metadata.filename != null ? ""+ metadata.filename : null;
    // const {mimeType, charset} = this._guessMimetype(rawData, metadata, filename);

    const mimeType = "image/png";

    res.statusCode = 200;
    res.setHeader('Content-Type', mimeType);
    bulkFile.createReadStream().pipe(res);

    // res.end(rawData);
  }

  private _guessMimetype(buffer: Buffer, metadata: Metadata, filename: string): {mimeType: string, charset:string} {
    let mimeType: string = metadata.mimeType == null ? null : "" + metadata.mimeType;
    let charset: string = metadata.charset == null ? null : "" + metadata.charset;
    if (mimeType === null) {
      // Try to determine a mimetype by inspecting the file name first.
      const detectionResult = MimeTypeDetector.detect(filename, buffer);
      if (detectionResult !== null) {
        mimeType = detectionResult.mimeType;
        if (charset === null) {
          charset = detectionResult.charset;
        }
      }
    }
    return {mimeType, charset};
  }

  private _createWebProtocol(): void {
    protocol.registerHttpProtocol(PROTOCOL_SCHEME, this._handleWebProtocol.bind(this));
  }

	private _handleWebProtocol(request: Electron.ProtocolRequest, callback: Electron.HttpProtocolCallback): void {
    this._log.debug("request url:", request.url);
    const prefix = PROTOCOL_SCHEME + "://";
    if (request.url.startsWith(prefix)) {
      const identifier = request.url.slice(prefix.length);
      callback({method: "GET", url: `http://127.0.0.1:${this._port}/${identifier}`});
    } else {
      callback({method: "GET", url: `http://127.0.0.1:${this._port}/`});
    }
  }

  dispose(): void {
    this._server.close();
  }
}
