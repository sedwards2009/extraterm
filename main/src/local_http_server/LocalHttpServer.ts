/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

// Small HTTP server running on localhost for IPC with other desktop apps.
import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import { Disposable } from "@extraterm/extraterm-extension-api";

import { getLogger, Logger } from "extraterm-logging";
import { RequestHandler } from "./RequestHandlerType.js";

/**
 * Local HTTP Server
 *
 * This runs on localhost only and is for IPC and scripting purposes.
 * All of the contents of this server are kept under a hidden cryptographically
 * random path which is different each time the server starts up.
 */
export class LocalHttpServer implements Disposable {
  private _log: Logger = null;

  #server: http.Server = null;
  #secretPath: string = null;
  #port = -1;
  #requestHandlerMapping = new Map<string, RequestHandler>();
  #ipcFilePath: string = null;

  constructor(ipcFilePath: string) {
    this._log = getLogger("LocalHttpServer", this);
    this.#secretPath = crypto.randomBytes(16).toString("hex");
    this.#ipcFilePath = ipcFilePath;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server = http.createServer(this._handleRequest.bind(this));
      this.#server.listen(0, "127.0.0.1", async () => {
        const address = this.#server.address();
        this.#port = (<net.AddressInfo> address).port;
        this._log.info(`Local HTTP IPC server running on ${this.getLocalUrlBase()}`);

        fs.writeFileSync(this.#ipcFilePath, `${process.pid}\n${this.getLocalUrlBase()}`, {encoding: "utf8"});

        resolve();
      });
    });
  }

  registerRequestHandler(path: string, requestHandler: RequestHandler): void {
    this.#requestHandlerMapping.set(path, requestHandler);
  }

  getLocalUrlBase(): string {
    return `http://127.0.0.1:${this.#port}/${this.#secretPath}`;
  }

  dispose(): void {
    if (fs.existsSync(this.#ipcFilePath)) {
      fs.unlinkSync(this.#ipcFilePath);
    }
    this.#server.close();
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const pathParts = req.url.split("/");
    if (pathParts.length < 3) {
      this._send404(res);
      return;
    }

    const secret = pathParts[1];
    if (secret !== this.#secretPath) {
      this._send404(res);
      return;
    }

    const handlerName = pathParts[2];
    const handler = this.#requestHandlerMapping.get(handlerName);
    if (handler === undefined) {
      this._send404(res);
      return;
    }

    const path = req.url.slice(1 + this.#secretPath.length + 1 + handlerName.length);
    handler.handle(req, res, path, {});
  }

  private _send404(res: http.ServerResponse): void {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("");
  }
}
