/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "node:http";
import * as net from "node:net";
import { getLogger, Logger } from "extraterm-logging";
import * as MimeTypeDetector from "extraterm-mimetype-detector";
import { BulkFileState, Disposable } from "@extraterm/extraterm-extension-api";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType.js";
import { BulkFileStorage } from "./BulkFileStorage.js";

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

    // Grab the last section of the URL path.
    if (identifier.lastIndexOf("/") !== -1) {
      identifier = identifier.substring(identifier.lastIndexOf("/"));
    }

    const bulkFile = this.#bulkFileStorage.getBulkFileByIdentifier(identifier);
    if (bulkFile == null) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Not found\n");
      return;
    }

    const {mimeType, charset} = MimeTypeDetector.detectWithMetadata(bulkFile.getMetadata(), bulkFile.getPeekBuffer());
    const combinedMimeType = charset === null ? mimeType : mimeType + "; charset=" + charset;

    res.statusCode = 200;
    res.setHeader("Content-Type", combinedMimeType);
    if (bulkFile.getState() === BulkFileState.COMPLETED) {
      res.setHeader("Content-Length", "" + bulkFile.getTotalSize());
    }

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
