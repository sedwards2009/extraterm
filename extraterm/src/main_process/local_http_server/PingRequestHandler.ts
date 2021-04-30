/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "http";
import { getLogger, Logger } from "extraterm-logging";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType";

const OK_200 = 200;

export class PingRequestHandler implements RequestHandler {
  private _log: Logger = null;

  constructor() {
    this._log = getLogger("PingRequestHandler", this);
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse, path: string,
      context: RequestContext): Promise<void> {

    res.statusCode = OK_200;
    res.setHeader("Content-Type", "text/plain");
    res.end("pong");
  }
}
