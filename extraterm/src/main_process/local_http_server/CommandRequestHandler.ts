/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "http";
import * as net from 'net';
import { getLogger, Logger } from "extraterm-logging";
import * as getStream from "get-stream";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType";
import { MainExtensionManager } from "../extension/MainExtensionManager";


export class CommandRequestHandler implements RequestHandler {
  private _log: Logger = null;
  #mainExtensionManager: MainExtensionManager = null;

  constructor(mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("CommandRequestHandler", this);
    this.#mainExtensionManager = mainExtensionManager;
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): Promise<void> {
    if (req.method !== "POST" || path !== "") {
      this._sendErrorResponse(res, 404);
      return;
    }

    try {
      const body = await getStream(req);
this._log.debug(body);

      let jsonBody: object = null;
      try {
        jsonBody = JSON.parse(body);
      } catch (e) {
        this._sendErrorResponse(res, 400);  // Bad Request
        return;
      }

      this._processBody(jsonBody);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      res.end("Thanks y'all!");

    } catch(error) {
      this._log.warn(error);
    }
  }

  private _sendErrorResponse(res: http.ServerResponse, statusCode: number): void {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain");
    res.end("");
  }

  private _processBody(jsonBody: any): void {
    const commandName = jsonBody.command;
    if (commandName == null) {
      this._log.warn(`'command' was missing from the POST body.`);
      return;
    }

    this.#mainExtensionManager.executeCommand(commandName);
  }
}
