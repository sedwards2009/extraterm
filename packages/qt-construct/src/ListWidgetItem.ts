/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QListWidgetItem } from "@nodegui/nodegui";


export interface ListWidgetItemOptions {
  text?: string;
  selected?: boolean;
}

export function ListWidgetItem(options: ListWidgetItemOptions): QListWidgetItem {
  const listWidgetItem = new QListWidgetItem();

  if (options.text !== undefined) {
    listWidgetItem.setText(options.text);
  }
  if (options.selected !== undefined) {
    listWidgetItem.setSelected(options.selected);
  }
  return listWidgetItem;
}
