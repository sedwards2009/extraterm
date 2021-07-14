/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QRadioButton } from "@nodegui/nodegui";

export interface RadioButtonOptions {
  text?: string;
  checked?: boolean;
}

export function RadioButton(options: RadioButtonOptions): QRadioButton {
  const radioButton = new QRadioButton();
  const { checked, text } = options;

  if (text !== undefined) {
    radioButton.setText(text);
  }
  if (checked !== undefined) {
    radioButton.setChecked(checked);
  }
  return radioButton;
}
