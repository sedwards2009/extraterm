/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "http";
import * as net from 'net';
import { getLogger, Logger } from "extraterm-logging";
import * as MimeTypeDetector from 'extraterm-mimetype-detector';
import { Disposable } from '@extraterm/extraterm-extension-api';

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType";
import { BulkFileStorage } from "./BulkFileStorage";

const MAXIMUM_UPLOAD_BUFFER_SIZE_BYTES = 10 * 1024 * 1024;

export class BulkFileRequestHandler implements RequestHandler {
  private _log: Logger = null;
  #bulkFileStorage: BulkFileStorage = null;

  constructor(bulkFileStorage: BulkFileStorage) {
    this._log = getLogger("BulkFileRequestHandler", this);
    this.#bulkFileStorage = bulkFileStorage;
  }

  handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): void {
    let identifier = path.slice(1);

    // Strip off everything after the first slash.
    if (identifier.indexOf("/") !== -1) {
      identifier = identifier.substr(0, identifier.indexOf("/"));
    }

    const bulkFile = this.#bulkFileStorage.getBulkFileByIdentifier(identifier);
    if (bulkFile == null) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Not found\n");
      return;
    }

    const {mimeType, charset} = MimeTypeDetector.detectWithMetadata(bulkFile.getMetadata(), bulkFile.peek1KB());
    const combinedMimeType = charset === null ? mimeType : mimeType + "; charset=" + charset;

    res.statusCode = 200;
    res.setHeader("Content-Type", combinedMimeType);

    let readStream: NodeJS.ReadableStream & Disposable;
    try {
      readStream = bulkFile.createReadableStream();
    } catch (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("");
      return;
    }

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
}
