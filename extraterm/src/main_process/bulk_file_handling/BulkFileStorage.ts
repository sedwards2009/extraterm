/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import {protocol} from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as net from 'net';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';
import {Transform} from 'stream';

import {Disposable, Event} from 'extraterm-extension-api';
import {EventEmitter} from '../../utils/EventEmitter';
import {getLogger, Logger} from '../../logging/Logger';
import log from '../../logging/LogDecorator';
import * as MimeTypeDetector from '../../mimetype_detector/MimeTypeDetector';
import {WriterReaderFile} from './WriterReaderFile';


export type BulkFileIdentifier = string;

export interface Metadata {
  readonly [index: string]: (string | number | undefined);
}

export type BufferSizeEvent = {identifier: BulkFileIdentifier, totalBufferSize: number, availableDelta: number};
export type CloseEvent = {identifier: BulkFileIdentifier, success: boolean};

const MAXIMUM_UPLOAD_BUFFER_SIZE_BYTES = 10 * 1024 * 1024;


/**
 * Responsible for the temporary storage of large files and serving them via a pseudo web protocol.
 */
export class BulkFileStorage {

  private _log: Logger; 
  private _storageMap = new Map<BulkFileIdentifier, BulkFile>();
  private _server: BulkFileServer = null;
  private _storageDirectory: string;

  private _onWriteBufferSizeEventEmitter = new EventEmitter<BufferSizeEvent>();
  private _onCloseEventEmitter = new EventEmitter<CloseEvent>();

  onWriteBufferSize: Event<BufferSizeEvent>;
  onClose: Event<CloseEvent>;

  constructor(private _tempDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
    this._storageDirectory = this._createStorageDirectory(this._tempDirectory);
    this._server = new BulkFileServer(this);
    this.onWriteBufferSize = this._onWriteBufferSizeEventEmitter.event;
    this.onClose = this._onCloseEventEmitter.event;
  }

  /**
   * Create a tmp directory for storing the bulk files.
   * 
   * This tries to make the directory in a secure manner because often times
   * the location is in a shared directory like /tmp which may be vulnerable
   * to symlink style attacks.
   */
  private _createStorageDirectory(tempDirectory: string): string {
    const identifier = "extraterm-tmp-storage-" + crypto.randomBytes(16).toString('hex');
    const fullPath = path.join(tempDirectory, identifier);
    try {
      fs.mkdirSync(fullPath, 0o700);
    } catch(e) {
      this._log.warn(`Unable to create temp directory ${fullPath}`, e);
      throw new Error(`Unable to create temp directory ${fullPath}. ${e}`);
    }
    return fullPath;
  }

  dispose(): void {
    for (const identifier of this._storageMap.keys()) {
      this._deleteBulkFile(identifier);
    }

    try {
      fs.rmdirSync(this._storageDirectory);
    } catch (e) {
      this._log.warn(`Unable to delete directory ${this._storageDirectory}`, e);
    }
  }

  createBulkFile(metadata: Metadata, size: number): {identifier: BulkFileIdentifier, url: string} {
    const onDiskFileIdentifier = crypto.randomBytes(16).toString('hex');
    const fullPath = path.join(this._storageDirectory, onDiskFileIdentifier);
    
    const bulkFile = new BulkFile(metadata, fullPath);
    bulkFile.ref();
    const internalFileIdentifier = crypto.randomBytes(16).toString('hex');

    bulkFile.onWriteBufferSizeChange(({totalBufferSize, availableDelta}): void => {
      this._onWriteBufferSizeEventEmitter.fire({identifier: internalFileIdentifier, totalBufferSize, availableDelta});
    });

    bulkFile.onClose((payload: {success: boolean}): void => {
      this._onCloseEventEmitter.fire({identifier: internalFileIdentifier, success: payload.success});
    });

    this._storageMap.set(internalFileIdentifier, bulkFile);

    return {identifier: internalFileIdentifier, url: this._server.getUrl(internalFileIdentifier)};
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this._storageMap.get(identifier).write(data);
  }

  close(identifier: BulkFileIdentifier, success: boolean): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    
    this._storageMap.get(identifier).close(success);
  }

  ref(identifier: BulkFileIdentifier): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    this._storageMap.get(identifier).ref();
  }

  deref(identifier: BulkFileIdentifier): void {
    if ( ! this._storageMap.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }
    const newReferenceCount = this._storageMap.get(identifier).deref();
    this._deleteBulkFile(identifier);
  }

  private _deleteBulkFile(identifier: BulkFileIdentifier): void {
    const bulkFile = this._storageMap.get(identifier);
    try {
      fs.unlinkSync(bulkFile.filePath);
    } catch(e) {
      this._log.warn(`Unable to delete file ${bulkFile.filePath}`, e);
    }
    this._storageMap.delete(identifier);
  }

  getBulkFileByIdentifier(identifier: BulkFileIdentifier): BulkFile {
    if ( ! this._storageMap.has(identifier)) {
      return null;
    }
    return this._storageMap.get(identifier);
  }
}


const BULK_FILE_MAXIMUM_BUFFER_SIZE = 512 * 1024;
const ONE_KILOBYTE = 1024;


export class BulkFile {

  private _log: Logger; 
  private _referenceCount = 0;
  private _writeStreamOpen = true;

  private _wrFile: WriterReaderFile = null;
  private _writeStream: crypto.Cipher = null;
  private _writeBuffers: Buffer[] = [];
  private _writeBlocked = false;

  private _cryptoKey: Buffer = null;
  private _cryptoIV: Buffer = null;

  private _closePending = false;
  private _succeess = false;
  private _onWriteBufferSizeChangeEventEmitter = new EventEmitter<{totalBufferSize: number, availableDelta: number}>();
  private _onCloseEventEmitter = new EventEmitter<{success: boolean}>();

  private _peekBuffer = new SmartBuffer();

  onWriteBufferSizeChange: Event<{totalBufferSize: number, availableDelta: number}>;
  onClose: Event<{success: boolean}>;

  constructor(private  _metadata: Metadata, public filePath: string) {
    this._log = getLogger("BulkFile", this);

    this._cryptoKey = crypto.randomBytes(32); // 256bit AES, thus 32 bytes
    this._cryptoIV = crypto.randomBytes(16);  // 128bit block size, thus 16 bytes

    this._wrFile = new WriterReaderFile(filePath);
    this._wrFile.getWritableStream().on('drain', this._handleDrain.bind(this));
    const aesCipher = crypto.createCipheriv("aes256", this._cryptoKey, this._cryptoIV);
    this._writeStream = aesCipher;
    aesCipher.pipe(this._wrFile.getWritableStream());
    this.onClose = this._onCloseEventEmitter.event;
    this.onWriteBufferSizeChange = this._onWriteBufferSizeChangeEventEmitter.event;
  }

  ref(): number {
    this._referenceCount++;
    return this._referenceCount;
  }

  deref(): number {
    this._referenceCount--;
    return this._referenceCount;
  }

  getMetadata(): Metadata {
    return this._metadata;
  }

  write(data: Buffer): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }

    this._writeBuffers.push(data);

    if (this._peekBuffer.length < ONE_KILOBYTE) {
      const bufferToAppend = Buffer.alloc(Math.min(ONE_KILOBYTE - this._peekBuffer.length, data.length));
      this._peekBuffer.writeBuffer(bufferToAppend);
    }

    this._sendWriteBuffers();
  }

  private _sendWriteBuffers(): void {
    let availableDelta = 0;
    while ( ! this._writeBlocked && this._writeBuffers.length !== 0) {
      const nextBuffer = this._writeBuffers[0];
      this._writeBuffers.splice(0 ,1);
      this._writeBlocked = ! this._writeStream.write(nextBuffer);
      availableDelta += nextBuffer.length;
    }

    if (this._writeBuffers.length === 0 && this._closePending) {
      this._writeStream.end();
      this._writeStreamOpen = false;
      this._closePending = false;
      this._onCloseEventEmitter.fire({success: this._succeess});
    }
    if (availableDelta !== 0) {
      const totalBufferSize = BULK_FILE_MAXIMUM_BUFFER_SIZE;
      this._onWriteBufferSizeChangeEventEmitter.fire({totalBufferSize, availableDelta});
      }
  }

  private _pendingBufferSize(): number {
    let total = 0;
    for (const buf of this._writeBuffers) {
      total += buf.length;
    }
    return total;
  }
  
  close(success: boolean): void {
    if ( ! this._writeStreamOpen) {
      this._log.warn("Write attempted to closed bulk file!");
      return;
    }
    this._closePending = true;
    this._succeess = success;
    this._sendWriteBuffers();
  }

  private _handleDrain(): void {
    this._writeBlocked = false;
    this._sendWriteBuffers();
  }

  peek1KB(): Buffer {
    return this._peekBuffer.toBuffer();
  }

  createReadableStream(): NodeJS.ReadableStream & Disposable {
    const aesDecipher = crypto.createDecipheriv("aes256", this._cryptoKey, this._cryptoIV);
    const fileReadStream = this._wrFile.createReadableStream();
    fileReadStream.pipe(aesDecipher);

    const dnt = new DisposableNullTransform(fileReadStream);
    aesDecipher.pipe(dnt);
    return dnt;
  }
}

// This is an elaborate way of passing back a dispose() method and a Readable in one object.
class DisposableNullTransform extends Transform implements Disposable {

  constructor(private _disposable: Disposable) {
    super();
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    this.push(chunk);
    callback();
  }

  dispose(): void {
    this._disposable.dispose();
  }
}

/**
 * A small local server for exposing bulk files over HTTP.
 */
class BulkFileServer {

  private _log: Logger = null;
  private _server: http.Server = null;
  private _port = -1;

  constructor(private _storage: BulkFileStorage) {
    this._log = getLogger("BulkFileProtocolConnector", this);
    this._startServer();
  }

  private _startServer(): void {
    this._server = http.createServer(this._handleRequest.bind(this));    
    this._server.listen(0, "127.0.0.1", () => {
      this._port = this._server.address().port;
      this._log.info(`Bulk file server running on 127.0.0.1 port ${this._port}`);
    });
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    let identifier = req.url.slice(1);

    // Strip off everything after the first slash.
    if (identifier.indexOf("/") !== -1) {
      identifier = identifier.substr(0, identifier.indexOf("/"));
    }

    const bulkFile = this._storage.getBulkFileByIdentifier(identifier);
    if (bulkFile == null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found\n');
      return;
    }

    const {mimeType, charset} = MimeTypeDetector.detectWithMetadata(bulkFile.getMetadata(), bulkFile.peek1KB());
    const combinedMimeType = charset === null ? mimeType : mimeType + "; charset=" + charset;

    res.statusCode = 200;
    res.setHeader('Content-Type', combinedMimeType);
    const readStream = bulkFile.createReadableStream();
    const connection = <net.Socket> (<any> res).connection; // FIXME fix the type info elsewhere.

    readStream.on("data", (chunk: Buffer) => {
      res.write(chunk);
      if (connection.bufferSize > MAXIMUM_UPLOAD_BUFFER_SIZE_BYTES) {
        readStream.pause();
      }
    });

    connection.on("drain", () => {
      readStream.resume();
    });
    
    readStream.on("end", () => {
      res.end();
      readStream.dispose();
    });

    res.on("close", () => {
      this._log.debug("ServerResponse closed unexpectedly.");
      readStream.dispose();
    });
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

  getUrl(identifier: BulkFileIdentifier): string {
    return `http://127.0.0.1:${this._port}/${identifier}`;
  }

  dispose(): void {
    this._server.close();
  }
}
