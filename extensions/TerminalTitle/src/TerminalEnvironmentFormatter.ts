/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FieldFormatter } from "./TemplateString";
import he = require("he");

/***
 * Translate keys to values from the given terminal environment.
 */
export class TerminalEnvironmentFormatter implements FieldFormatter {

  constructor(private _namespace: string, private _env: { get(key: string): string; }) {
  }

  formatHtml(key: string): string {
    const value = this._env.get(this._namespace + ":" + key.toLowerCase());
    return value == null ? "" : he.encode(value);
  }

  getErrorMessage(key: string): string {
    const value = this._env.get(this._namespace + ":" + key.toLowerCase());
    return value == null ? "Unknown key '" + he.encode(key) + "'" : null;
  }
}
