/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Style } from '@extraterm/extraterm-extension-api';
import { FieldFormatter, FormatResult } from "./TemplateString.js";


export class IconFormatter implements FieldFormatter {
  #style: Style;

  constructor(style: Style) {
    this.#style = style;
  }

  format(key: string): FormatResult {
    return {
      html: this.#style.createHtmlIcon(<any> key) ?? "???",
      iconName: key
    };
  }

  getErrorMessage(key: string): string {
    return null;
  }
}
