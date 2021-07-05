/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QBoxLayout, QWidget } from "@nodegui/nodegui";


export interface BoxLayoutItem {
  widget: QWidget;
  stretch?: number;
  alignment?: AlignmentFlag;
}

export interface BoxLayoutOptions {
  direction: Direction;
  children: (QWidget | BoxLayoutItem)[];
}

export function BoxLayout(options: BoxLayoutOptions): QBoxLayout {
  const { children, direction } = options;

  const boxLayout = new QBoxLayout(direction);

  for (const child of children) {
    if (child instanceof QWidget) {
      boxLayout.addWidget(child);
    } else {
      boxLayout.addWidget(child.widget, child.stretch === undefined ? 0 : child.stretch,
        child.alignment === undefined ? 0 : child.alignment);
    }
  }

  return boxLayout;
}
