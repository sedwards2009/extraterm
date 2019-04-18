/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FieldFormatter } from "./TemplateString";
import he = require("he");


export class IconFormatter implements FieldFormatter {
  formatHtml(key: string): string {
    return `<i class="${he.encode(key)}"></i>`;
  }

  formatDiagnosticHtml(key: string): string {
    return this.formatHtml(key);
  }
}
