/*
 * Copyright 2014-2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { SessionConfiguration, CreateSessionOptions} from "@extraterm/extraterm-extension-api";
import { createUuid } from "extraterm-uuid";
import { Logger, getLogger, log } from "extraterm-logging";
import { Pty } from "./Pty.js";
import { ExtensionManager } from "../extension/ExtensionManager.js";

const LOG_FINE = false;

export class PtyManager {
  private _log: Logger;

  constructor(private _extensionManager: ExtensionManager) {
    this._log = getLogger("PtyManager", this);
  }

  getDefaultSessions(): SessionConfiguration[] {
    const results: SessionConfiguration[] = [];
    for (const backend of this._extensionManager.getSessionBackendContributions()) {

      const defaultSessions = backend.sessionBackend.defaultSessionConfigurations();
      for (const session of defaultSessions) {
        session.uuid = createUuid();
        results.push(session);
      }
    }

    return results;
  }

  createPty(sessionConfiguration: SessionConfiguration, sessionOptions: CreateSessionOptions): Pty {
    const backend = this._extensionManager.getSessionBackend(sessionConfiguration.type);
    const ptyTerm = backend.createSession(sessionConfiguration, sessionOptions);
    return ptyTerm;
  }

  private _logData(data: string): void {
    this._log.debug(substituteBadChars(data));
  }

  private _logJSData(data: string): void {
    this._log.debug(formatJSData(data));
  }
}

function mapBadChar(m: string): string {
  const c = m.charCodeAt(0);
  switch (c) {
    case 8:
      return "\\b";
    case 12:
      return "\\f";
    case 13:
      return "\\r";
    case 11:
      return "\\v";
    case 0x22:
      return '\\"';
    default:
      if (c <= 255) {
        return "\\x" + to2DigitHex(c);
      } else {
        return "\\u" + to2DigitHex( c >> 8) + to2DigitHex(c & 0xff);
      }
  }
}

function substituteBadChars(data: string): string {
  return data.replace(/[^ /{},.:;<>!@#$%^&*()+=_'"a-zA-Z0-9-]/g, mapBadChar);
}

// Format a string as a series of JavaScript string literals.
function formatJSData(data: string, maxLen: number = 60): string {
  let buf = "";
  let result = "";
  for (let i=0; i<data.length; i++) {
    buf += substituteBadChars(data[i]);
    if (buf.length+6 >= maxLen) {
      result += "\"" + buf + "\"\n";
      buf = "";
    }
  }

  if (buf !== "") {
    result += "\"" + buf + "\"\n";
  }
  return result;
}

/**
 * Converts an 8bit number to a 2 digit hexadecimal string.
 *
 * @param  {number} value An integer in the range 0-255 inclusive.
 * @return {string}       the converted number.
 */
function to2DigitHex(value: number): string {
  const h = value.toString(16);
  return h.length === 1 ? "0" + h : h;
}
