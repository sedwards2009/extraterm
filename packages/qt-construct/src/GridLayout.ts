/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { NodeLayout, QGridLayout, QWidget } from "@nodegui/nodegui";
import { Label } from "./Label";

export interface GridLayoutOptions {
  columns: number;
  children: (QWidget| string | NodeLayout<any>)[];
}

export function GridLayout(options: GridLayoutOptions): QGridLayout {
  const { columns, children } = options;
  const gridLayout = new QGridLayout();

  for (let i=0; i<children.length; i++) {
    let kid: QWidget | null = null;
    const candidate = children[i];

    const row = Math.floor(i / columns);
    const column = i % columns;
    if ((typeof candidate) === "string") {
      kid = Label({text: <string> candidate});
      gridLayout.addWidget(kid, row, column);
    } else if (candidate instanceof NodeLayout) {
      gridLayout.addLayout(candidate, row, column);
    } else {
      kid = <QWidget> candidate;
      gridLayout.addWidget(kid, row, column);
    }
  }

  return gridLayout;
}
