/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, QLayout, QGridLayout, QWidget } from "@nodegui/nodegui";
import { Label } from "./Label.js";

export interface GridLayoutItem {
  widget?: QWidget;
  layout?: QLayout;
  colSpan?: number;
  alignment?: AlignmentFlag;
}

export type GridLayoutChild = QWidget | string | QLayout | GridLayoutItem | false | null | undefined;

export interface GridLayoutOptions {
  columns: number;
  children: GridLayoutChild[];
  contentsMargins?: [number, number, number, number] | number;
  spacing?: number;
  columnsMinimumWidth?: (number | undefined)[];
  columnsStretch?: (number | undefined)[];
}

export function GridLayout(options: GridLayoutOptions): QGridLayout {
  const { children, columns, contentsMargins, columnsMinimumWidth, columnsStretch, spacing } = options;
  const gridLayout = new QGridLayout();

  if (contentsMargins !== undefined) {
    if (typeof contentsMargins === "number") {
      gridLayout.setContentsMargins(contentsMargins, contentsMargins, contentsMargins, contentsMargins);
    } else {
      gridLayout.setContentsMargins(...contentsMargins);
    }
  }
  if (spacing !== undefined) {
    gridLayout.setSpacing(spacing);
  }

  let col = 0;
  for (let i=0; i<children.length; i++) {
    let kid: QWidget | null = null;
    const candidate = children[i];

    if (candidate === false || candidate == null) {
      continue;
    }

    const row = Math.floor(col / columns);
    const column = col % columns;
    if ((typeof candidate) === "string") {
      kid = Label({text: <string> candidate});
      gridLayout.addWidget(kid, row, column);
    } else if (candidate instanceof QLayout) {
      gridLayout.addLayout(candidate, row, column);
    } else if (isGridLayoutItem(candidate)) {
      const colSpan = candidate.colSpan ?? 1;
      if (candidate.widget !== undefined) {
        const alignment = candidate.alignment ?? AlignmentFlag.AlignLeft;
        gridLayout.addWidget(candidate.widget, row, column, 1, colSpan, alignment);
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

  if (columnsMinimumWidth !== undefined) {
    for (let i=0; i<columnsMinimumWidth.length; i++) {
      const width = columnsMinimumWidth[i];
      if (width !== undefined) {
        gridLayout.setColumnMinimumWidth(i, width);
      }
    }
  }

  if (columnsStretch !== undefined) {
    for (let i=0; i<columnsStretch.length; i++) {
      const stretch = columnsStretch[i];
      if (stretch !== undefined) {
        gridLayout.setColumnStretch(i, stretch);
      }
    }
  }

  return gridLayout;
}

function isGridLayoutItem(item: any): item is GridLayoutItem {
  return typeof item === "object" && (! (item instanceof QWidget)) &&
    (item.widget != null || item.layout != null);
}
