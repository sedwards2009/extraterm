/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { NodeLayout, NodeWidget, QGridLayout, QWidget } from "@nodegui/nodegui";
import { Label } from "./Label";

export interface GridLayoutItem {
  widget?: QWidget;
  layout?: NodeLayout<any>;
  colSpan?: number;
}

export interface GridLayoutOptions {
  columns: number;
  children: (QWidget| string | NodeLayout<any> | GridLayoutItem)[];
}

export function GridLayout(options: GridLayoutOptions): QGridLayout {
  const { columns, children } = options;
  const gridLayout = new QGridLayout();

  let col = 0;
  for (let i=0; i<children.length; i++) {
    let kid: QWidget | null = null;
    const candidate = children[i];

    const row = Math.floor(col / columns);
    const column = col % columns;
    if ((typeof candidate) === "string") {
      kid = Label({text: <string> candidate});
      gridLayout.addWidget(kid, row, column);
    } else if (candidate instanceof NodeLayout) {
      gridLayout.addLayout(candidate, row, column);
    } else if (isGridLayoutItem(candidate)) {
      const colSpan = candidate.colSpan ?? 1;
      if (candidate.widget !== undefined) {
        gridLayout.addWidget(candidate.widget, row, column, 1, colSpan);
      } else if (candidate.layout !== undefined) {
        gridLayout.addLayout(candidate.layout, row, column, 1, colSpan);
      }
      col += colSpan - 1;
    } else {
      kid = <QWidget> candidate;
      gridLayout.addWidget(kid, row, column);
    }
    col++;
  }

  return gridLayout;
}

function isGridLayoutItem(item: any): item is GridLayoutItem {
  return typeof item === "object" && (! (item instanceof NodeWidget)) &&
    (typeof item.widget === "number" || item.layout !== "number");
}
