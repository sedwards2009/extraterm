/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as http from "http";

export interface RequestContext {

}

export interface RequestHandler {
  handle(req: http.IncomingMessage, res: http.ServerResponse, path: string, context: RequestContext): void;
}
