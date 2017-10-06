/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from 'crypto';
import * as http from 'http';
import {SmartBuffer, SmartBufferOptions} from 'smart-buffer';

import {getLogger, Logger} from '../../logging/Logger';

export type BulkFileIdentifier = string;


export interface Metadata {
  readonly [index: string]: (string | number);
}


export class BulkFileStorage {

  private _log: Logger; 
  private _fakeStorage = new Map<BulkFileIdentifier, SmartBuffer>();
  private _server: BulkFileHttpServer = null;

  constructor(private _tmpDirectory: string) {
    this._log = getLogger("BulkFileStorage", this);
    this._server = new BulkFileHttpServer();
  }

  createBulkFile(metaData: Metadata, size: number): BulkFileIdentifier {
    const identifier = crypto.randomBytes(16).toString('hex');
    this._log.debug("Creating bulk file with identifier: ", identifier);
    this._fakeStorage.set(identifier, new SmartBuffer());
    return identifier;
  }

  write(identifier: BulkFileIdentifier, data: Buffer): void {
    if ( ! this._fakeStorage.has(identifier)) {
      this._log.warn("Invalid BulkFileIdentifier received: ", identifier);
      return;
    }

    this._log.debug(`Writing ${data.length} bytes to identifier ${identifier}`);

    const buf = this._fakeStorage.get(identifier);
    buf.writeBuffer(data);
  }

  close(identifier: BulkFileIdentifier): void {
    this._log.debug(`Closing identifier ${identifier}`);
    this._log.debug(this._fakeStorage.get(identifier).toString());
  }
}


class BulkFileHttpServer {

  private _log: Logger = null;
  private _server: http.Server = null;

  constructor() {
    this._log = getLogger("BulkFileHttpServer", this);
    this._startServer();
  }

  private _startServer(): void {
    this._log.debug("Starting bulk file server");

    this._server = http.createServer(this._handleRequest.bind(this));    
    this._server.listen(0, "127.0.0.1", () => {
      const port = this._server.address().port;
      this._log.debug(`Server running on 127.0.0.1 port ${port}`);
    });
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello World\n');
  }

  dispose(): void {
    this._server.close();
  }
}
