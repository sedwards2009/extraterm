/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FieldFormatter } from "./TemplateString";


export class IconFormatter implements FieldFormatter {
  formatHtml(key: string): string {
    return `<i class="${key}"></i>`;
  }

  getErrorMessage(key: string): string {
    return null;
  }
}
