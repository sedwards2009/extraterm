/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QIcon, QListWidgetItem } from "@nodegui/nodegui";


export interface ListWidgetItemOptions {
  icon?: QIcon;
  text?: string;
  selected?: boolean;
}

export function ListWidgetItem(options: ListWidgetItemOptions): QListWidgetItem {
  const listWidgetItem = new QListWidgetItem();
  const { icon, text, selected } = options;
  if (icon !== undefined) {
    listWidgetItem.setIcon(icon);
  }
  if (text !== undefined) {
    listWidgetItem.setText(text);
  }
  if (selected !== undefined) {
    listWidgetItem.setSelected(selected);
  }
  return listWidgetItem;
}
