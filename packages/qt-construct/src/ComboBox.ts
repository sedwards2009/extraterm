/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QComboBox, QIcon, QVariant, WidgetEventTypes } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface ComboBoxItem {
  icon?: QIcon;
  text: string;
  userData?: QVariant | string | number;
}

export interface ComboBoxOptions extends WidgetOptions {
  id?: string;
  currentIndex?: number;
  items: (ComboBoxItem | string)[];
  onActivated?: (index: number) => void;
}

export function ComboBox(options: ComboBoxOptions): QComboBox {
  const comboBox = new QComboBox();
  ApplyWidgetOptions(comboBox, options);
  const { id, items, currentIndex, onActivated } = options;
  if (id !== undefined) {
    comboBox.setObjectName(id);
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
  return comboBox;
}
