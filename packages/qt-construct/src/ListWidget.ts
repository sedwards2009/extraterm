/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QListWidget, QListWidgetItem } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";


export interface ListWidgetOptions extends WidgetOptions {
  items: QListWidgetItem[];
  currentRow?: number;
  onItemActivated?: (item: QListWidgetItem) => void;
  onCurrentRowChanged?: (currentRow: number) => void;
}

export function ListWidget(options: ListWidgetOptions): QListWidget {
  const listWidget = new QListWidget();

  ApplyWidgetOptions(listWidget, options);
  const { currentRow, items, onCurrentRowChanged, onItemActivated } = options;

  for (const item of items) {
    listWidget.addItem(item);
  }

  if (currentRow !== undefined) {
    listWidget.setCurrentRow(currentRow);
  }
  if (onItemActivated !== undefined) {
    listWidget.addEventListener("itemActivated", onItemActivated);
  }
  if (onCurrentRowChanged !== undefined) {
    listWidget.addEventListener("currentRowChanged", onCurrentRowChanged);
  }
  return listWidget;
}
