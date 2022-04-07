/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QComboBox, QIcon, QVariant } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";

export interface ComboBoxItem {
  icon?: QIcon;
  text: string;
  userData?: QVariant | string | number;
}

export interface ComboBoxOptions extends WidgetOptions {
  id?: string;
  currentIndex?: number;
  editable?: boolean;
  currentText?: string;
  items: (ComboBoxItem | string)[];
  onActivated?: (index: number) => void;
  onCurrentTextChanged?: (newText: string) => void;
}

export function ComboBox(options: ComboBoxOptions): QComboBox {
  const comboBox = new QComboBox();
  ApplyWidgetOptions(comboBox, options);
  const { id, items, currentIndex, currentText, editable, onActivated, onCurrentTextChanged } = options;
  if (id !== undefined) {
    comboBox.setObjectName(id);
  }

  if (editable !== undefined) {
    comboBox.setEditable(editable);
  }

  if (currentText !== undefined) {
    comboBox.setCurrentText(currentText);
  }

  for (const item of items) {
    if (typeof item === "string") {
      comboBox.addItem(undefined, item, undefined);
    } else if (item != null) {
      const userData = item.userData instanceof QVariant ? item.userData : new QVariant(item.userData);
      comboBox.addItem(item.icon, item.text, userData);
    }
  }

  if (currentIndex !== undefined) {
    comboBox.setCurrentIndex(currentIndex);
  }
  if (onActivated !== undefined) {
    comboBox.addEventListener("activated", onActivated);
  }
  if (onCurrentTextChanged !== undefined) {
    comboBox.addEventListener("currentTextChanged", onCurrentTextChanged);
  }
  return comboBox;
}
