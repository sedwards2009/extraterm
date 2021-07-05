/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLabel } from "@nodegui/nodegui";

export interface LabelOptions {
  id?: string;
  text?: string;
}

export function Label(options: LabelOptions): QLabel {
  const label = new QLabel();
  if (options.id !== undefined) {
    label.setObjectName(options.id);
  }
  if (options.text !== undefined) {
    label.setText(options.text);
  }
  return label;
}
