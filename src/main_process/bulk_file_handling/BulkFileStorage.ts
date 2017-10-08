/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import * as http from 'http';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';
import {protocol} from 'electron';

import {getLogger, Logger} from '../../logging/Logger';
import * as MimeTypeDetector from '../../mimetype_detector/MimeTypeDetector';


export type BulkFileIdentifier = string;


export interface Metadata {
  readonly [index: string]: (string | number);
}


export interface BulkFile {
  readonly metadata: Metadata;
  readonly smartBuffer: SmartBuffer;
}


export class BulkFileStorage {

  private _log: Logger; 
  private _fakeStorage = new Map<BulkFileIdentifier, BulkFile>();
  private _server: BulkFileProtocolConnector = null;

  constructor(private _tmpDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
    this._server = new BulkFileProtocolConnector(this);
  }

  createBulkFile(metadata: Metadata, size: number): BulkFileIdentifier {
    const identifier = crypto.randomBytes(16).toString('hex');
    this._log.debug("Creating bulk file with identifier: ", identifier);
    this._fakeStorage.set(identifier, {metadata, smartBuffer: new SmartBuffer()});

    return identifier;
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this._fakeStorage.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this._log.debug(`Writing ${data.length} bytes to identifier ${identifier}`);

    const buf = this._fakeStorage.get(identifier).smartBuffer;
    buf.writeBuffer(data);
  }

  close(identifier: BulkFileIdentifier): void {
    this._log.debug(`Closing identifier ${identifier}`);
    // this._log.debug(this._fakeStorage.get(identifier).toString());
  }

  getBulkFileByIdentifier(identifier: BulkFileIdentifier): BulkFile {
    if ( ! this._fakeStorage.has(identifier)) {
      return null;
    }
    return this._fakeStorage.get(identifier);
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
    const buf = this._storage.getBulkFileByIdentifier(identifier);
    if (buf == null) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found\n');
      return;
    }

    const rawData = buf.smartBuffer.toBuffer();
    const metadata = buf.metadata;
    const filename = metadata.filename != null ? ""+ metadata.filename : null;
    const {mimeType, charset} = this._guessMimetype(rawData, metadata, filename);

    res.statusCode = 200;
    res.setHeader('Content-Type', mimeType);

    res.end(rawData);
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
