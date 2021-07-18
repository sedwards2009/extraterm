/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QSpinBox } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface SpinBoxOptions extends WidgetOptions {
  minimum?: number;
  maximum?: number;
  prefix?: string;
  suffix?: string;
  value?: number;
  onValueChanged?: (value: number) => void;
}

export function SpinBox(options: SpinBoxOptions): QSpinBox {
  const { prefix, maximum, minimum, suffix, value, onValueChanged } = options;
  const spinBox = new QSpinBox();

  ApplyWidgetOptions(spinBox, options);

  if (minimum !== undefined) {
    spinBox.setMinimum(minimum);
  }
  if (maximum !== undefined) {
    spinBox.setMaximum(maximum);
  }
  if (prefix !== undefined) {
    spinBox.setPrefix(prefix);
  }
  if (suffix !== undefined) {
    spinBox.setSuffix(suffix);
  }
  if (value !== undefined) {
    spinBox.setValue(value);
  }
  if (onValueChanged !== undefined) {
    spinBox.addEventListener("valueChanged", onValueChanged);
  }
  return spinBox;
}
