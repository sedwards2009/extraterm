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
  text?: string;
  onClicked?: (checked: boolean) => void;
  onToggled?: (checked: boolean) => void;
}

export function ApplyAbstractButtonOptions(button: QAbstractButton<any>, options: AbstractButtonOptions): void {
  ApplyWidgetOptions(button, options);
  const { autoExclusive, checkable, checked, icon, onClicked, onToggled, text } = options;
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
  if (text !== undefined) {
    button.setText(text);
  }
  if (onClicked !== undefined) {
    button.addEventListener("clicked", onClicked);
  }
  if (onToggled !== undefined) {
    button.addEventListener("toggled", onToggled);
  }
}
