/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QAbstractButton, QIcon } from "@nodegui/nodegui";

import { ApplyWidgetOptions, WidgetOptions } from "./Widget";


export interface AbstractButtonOptions extends WidgetOptions {
  icon?: QIcon;
}

export function ApplyAbstractButtonOptions(button: QAbstractButton<any>, options: AbstractButtonOptions): void {
  ApplyWidgetOptions(button, options);
  const { icon } = options;
  if (icon !== undefined) {
    button.setIcon(icon);
  }
}
