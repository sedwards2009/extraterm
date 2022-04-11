/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "node:http";
import { getLogger, Logger } from "extraterm-logging";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType.js";


export class PingHandler implements RequestHandler {
  private _log: Logger = null;

  constructor() {
    this._log = getLogger("PingHandler", this);
  }

  handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): void {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain");
    res.end("pong");
  }
}
