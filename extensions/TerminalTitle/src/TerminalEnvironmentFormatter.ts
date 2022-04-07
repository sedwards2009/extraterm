/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FieldFormatter, FormatResult } from "./TemplateString.js";
import he = require("he");

/***
 * Translate keys to values from the given terminal environment.
 */
export class TerminalEnvironmentFormatter implements FieldFormatter {
  #namespace: string;
  #env: { get(key: string): string; };

  constructor(namespace: string, env: { get(key: string): string; }) {
    this.#namespace = namespace;
    this.#env = env;
  }

  format(key: string): FormatResult {
    const value = this.#env.get(this.#namespace + ":" + key.toLowerCase());
    return {text: value == null ? "" : value};
  }

  getErrorMessage(key: string): string {
    const value = this.#env.get(this.#namespace + ":" + key.toLowerCase());
    return value == null ? "Unknown key '" + he.encode(key) + "'" : null;
  }
}
