/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QTextEdit } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface TextEditOptions extends WidgetOptions {
  plainText?: string;
  placeholderText?: string;
  onTextChanged?: () => void;
}

export function TextEdit(options: TextEditOptions): QTextEdit {
  const { onTextChanged, placeholderText, plainText } = options;
  const textEdit = new QTextEdit();

  ApplyWidgetOptions(textEdit, options);

  if (plainText != null) {
    textEdit.setText(plainText);
  }
  if (placeholderText != null) {
    textEdit.setPlaceholderText(placeholderText);
  }
  if (onTextChanged !== undefined) {
    textEdit.addEventListener("textChanged", onTextChanged);
  }
  return textEdit;
}
