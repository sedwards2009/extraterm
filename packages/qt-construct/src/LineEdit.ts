/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QLineEdit } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";

export interface LineEditOptions extends WidgetOptions {
  text?: string;
  onTextEdited?: (newText: string) => void;
  placeholderText?: string;
}

export function LineEdit(options: LineEditOptions): QLineEdit {
  const { placeholderText, text, onTextEdited } = options;
  const lineEdit = new QLineEdit();

  ApplyWidgetOptions(lineEdit, options);

  if (text != null) {
    lineEdit.setText(text);
  }
  if (placeholderText != null) {
    lineEdit.setPlaceholderText(placeholderText);
  }
  if (onTextEdited !== undefined) {
    lineEdit.addEventListener("textEdited", onTextEdited);
  }
  return lineEdit;
}
