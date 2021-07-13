/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLineEdit } from "@nodegui/nodegui";

export interface LineEditOptions {
  text?: string;
}

export function LineEdit(options: LineEditOptions): QLineEdit {
  const { text } = options;
  const lineEdit = new QLineEdit();
  if (text != null) {
    lineEdit.setText(text);
  }
  return lineEdit;
}
