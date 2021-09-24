/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QAbstractButton, QIcon } from "@nodegui/nodegui";

import { ApplyWidgetOptions, WidgetOptions } from "./Widget";


export interface AbstractButtonOptions extends WidgetOptions {
  autoExclusive?: boolean;
  checkable?: boolean;
  checked?: boolean;
  icon?: QIcon;
}

export function ApplyAbstractButtonOptions(button: QAbstractButton<any>, options: AbstractButtonOptions): void {
  ApplyWidgetOptions(button, options);
  const { autoExclusive, checkable, checked, icon } = options;
  if (autoExclusive !== undefined) {
    button.setAutoExclusive(autoExclusive);
  }
  if (checkable !== undefined) {
    button.setCheckable(checkable);
  }
  if (checked !== undefined) {
    button.setChecked(checked);
  }
  if (icon !== undefined) {
    button.setIcon(icon);
  }
}
