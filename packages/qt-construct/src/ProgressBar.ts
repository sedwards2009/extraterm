/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QProgressBar } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";

export interface ProgressBarOptions extends WidgetOptions {
  minimum?: number;
  maximum?: number;
  value?: number;
  textVisible?: boolean;
}

export function ProgressBar(options: ProgressBarOptions): QProgressBar {
  const { minimum, maximum, textVisible, value } = options;
  const progressBar = new QProgressBar();
  ApplyWidgetOptions(progressBar, options);

  if (minimum !== undefined) {
    progressBar.setMinimum(minimum);
  }
  if (maximum !== undefined) {
    progressBar.setMaximum(maximum);
  }
  if (value !== undefined) {
    progressBar.setValue(value);
  }
  if (textVisible !== undefined) {
    progressBar.setTextVisible(textVisible);
  }
  return progressBar;
}
