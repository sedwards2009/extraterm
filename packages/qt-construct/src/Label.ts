/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLabel, TextFormat } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface LabelOptions extends WidgetOptions {
  text?: string;
  textFormat?: TextFormat;
  wordWrap?: boolean;
}

export function Label(options: LabelOptions): QLabel {
  const label = new QLabel();

  ApplyWidgetOptions(label, options);
  const { text, textFormat, wordWrap } = options;
  if (textFormat !== undefined) {
    label.setTextFormat(textFormat);
  }
  if (text !== undefined) {
    label.setText(text);
  }
  if (wordWrap !== undefined) {
    label.setWordWrap(wordWrap);
  }

  return label;
}
