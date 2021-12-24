/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QRadioButton } from "@nodegui/nodegui";
import { AbstractButtonOptions, ApplyAbstractButtonOptions } from "./AbstractButton";

export interface RadioButtonOptions extends AbstractButtonOptions {
}

export function RadioButton(options: RadioButtonOptions): QRadioButton {
  const radioButton = new QRadioButton();
  ApplyAbstractButtonOptions(radioButton, options);
  return radioButton;
}
