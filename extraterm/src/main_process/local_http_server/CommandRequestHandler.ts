/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "http";
import { getLogger, Logger } from "extraterm-logging";
import * as getStream from "get-stream";

import { RequestContext, RequestHandler } from "../local_http_server/RequestHandlerType";
import { MainExtensionManager } from "../extension/MainExtensionManager";

const BAD_REQUEST_400 = 400;
const METHOD_NOT_ALLOWED_405 = 405;
const OK_200 = 200;
const NO_CONTENT_204 = 204;
const INTERNAL_SERVER_ERROR_500 = 500;

const SUCCESS_STATUS_CODES = [OK_200, NO_CONTENT_204];


interface HttpResponse {
  statusCode: number,
  body?: any
}


export class CommandRequestHandler implements RequestHandler {
  private _log: Logger = null;
  #mainExtensionManager: MainExtensionManager = null;

  constructor(mainExtensionManager: MainExtensionManager) {
    this._log = getLogger("CommandRequestHandler", this);
    this.#mainExtensionManager = mainExtensionManager;
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): Promise<void> {
    const response = await this._handleRequest(req, path, context);

    if ( ! SUCCESS_STATUS_CODES.includes(response.statusCode)) {
      this._log.warn(`${response.statusCode}: ${response.body}`);
    }

    res.statusCode = response.statusCode;
    res.setHeader("Content-Type", "application/json");
    if (response.body == null) {
      res.end();
    } else {
      res.end(JSON.stringify(response.body));
    }
  }

  private async _handleRequest(req: http.IncomingMessage, path: string, context: RequestContext): Promise<HttpResponse> {
    if (req.method !== "POST" || path !== "") {
      return {
        statusCode: METHOD_NOT_ALLOWED_405,
        body: {
          message: "Method not allowed"
        }
      };
    }

    try {
      const body = await getStream(req);

      let jsonBody: object = null;
      try {
        jsonBody = JSON.parse(body);
      } catch (e) {
        return {
          statusCode: BAD_REQUEST_400,
          body: {
            message: "Bad request. JSON body failed to parse."
          }
        };
      }

      return this._processBody(jsonBody);
    } catch(error) {
      this._log.warn(error);
      return {
        statusCode: INTERNAL_SERVER_ERROR_500,
        body: {
          message: "Internal server error. Consult the Extraterm logs for details."
        }
      };
    }
  }

  private async _processBody(jsonBody: any): Promise<HttpResponse> {
    const commandName = jsonBody.command;
    if (commandName == null) {
      this._log.warn(`'command' was missing from the POST body.`);
      return {
        statusCode: BAD_REQUEST_400,
        body: {
          message: "`'command' was missing from the POST body.`"
        }
      };
    }

    const result = this.#mainExtensionManager.executeCommand(commandName);
    if (result == null) {
      return {
        statusCode: NO_CONTENT_204
      };
    }

    let finalResult: any = result;
    if (result instanceof Promise) {
      finalResult = await result;
    }

    return {
      statusCode: OK_200,
      body: finalResult
    };
  }
}
