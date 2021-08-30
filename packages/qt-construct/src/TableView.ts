/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QAbstractItemModel, QTableView, QAbstractItemViewSelectionBehavior, SelectionMode, NativeElement
} from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

// TODO: Introduce an AbstractItemViewOptions

export interface TableViewOptions extends WidgetOptions {
  model?: QAbstractItemModel;
  showGrid?: boolean;
  selectionBehavior?: QAbstractItemViewSelectionBehavior;
  selectionMode?: SelectionMode;
  cornerButtonEnabled?: boolean;

  onActivated?:(index: NativeElement /* QModelIndex */) => void;
  onClicked?:(index: NativeElement /* QModelIndex */) => void;
  onDoubleClicked?:(index: NativeElement /* QModelIndex */) => void;
  onEntered?:(index: NativeElement /* QModelIndex */) => void;
  onPressed?:(index: NativeElement /* QModelIndex */) => void;
}

export function TableView(options: TableViewOptions): QTableView {
  const tableView = new QTableView();

  ApplyWidgetOptions(tableView, options);
  const { cornerButtonEnabled, model, showGrid, selectionBehavior, selectionMode, onActivated, onClicked,
    onDoubleClicked, onEntered, onPressed } = options;
  if (model !== undefined) {
    tableView.setModel(model);
  }
  if (showGrid !== undefined) {
    tableView.setShowGrid(showGrid);
  }
  if (selectionBehavior !== undefined) {
    tableView.setSelectionBehavior(selectionBehavior);
  }
  if (selectionMode !== undefined) {
    tableView.setSelectionMode(selectionMode);
  }
  if (cornerButtonEnabled !== undefined) {
    tableView.setCornerButtonEnabled(false);
  }
  if (onActivated !== undefined) {
    tableView.addEventListener("activated", onActivated);
  }
  if (onClicked !== undefined) {
    tableView.addEventListener("clicked", onClicked);
  }
  if (onDoubleClicked !== undefined) {
    tableView.addEventListener("doubleClicked", onDoubleClicked);
  }
  if (onEntered !== undefined) {
    tableView.addEventListener("entered", onEntered);
  }
  if (onPressed !== undefined) {
    tableView.addEventListener("pressed", onPressed);
  }
  return tableView;
}
