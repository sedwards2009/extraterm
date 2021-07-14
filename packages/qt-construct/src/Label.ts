/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLabel } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface LabelOptions extends WidgetOptions {
  text?: string;
}

export function Label(options: LabelOptions): QLabel {
  const label = new QLabel();

  ApplyWidgetOptions(label, options);

  if (options.text !== undefined) {
    label.setText(options.text);
  }
  return label;
}
