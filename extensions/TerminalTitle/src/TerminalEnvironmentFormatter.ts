/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FieldFormatter } from "./TemplateString";
import { TerminalEnvironment } from "extraterm-extension-api";
import he = require("he");


export class TerminalEnvironmentFormatter implements FieldFormatter {

  constructor(private _namespace: string, private _env: TerminalEnvironment) {
  }
  
  formatHtml(key: string): string {
    const value = this._env.get(this._namespace + ":" + key.toLowerCase());
    return value == null ? "" : he.encode(value);
  }

  formatDiagnosticHtml(key: string): string {
    const value = this._env.get(this._namespace + ":" + key.toLowerCase());
    return value == null ? "Unknown key '" + he.encode(value) + "'" : he.encode(value);
  }
}
