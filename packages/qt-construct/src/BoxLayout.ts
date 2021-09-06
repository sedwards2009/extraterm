/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, NodeLayout, NodeWidget, QBoxLayout, QWidget } from "@nodegui/nodegui";


export interface BoxLayoutItem {
  widget?: QWidget;
  layout?: NodeLayout<any>;
  stretch?: number;
  alignment?: AlignmentFlag;
}

export interface BoxLayoutOptions {
  direction: Direction;
  children: (NodeWidget<any> | BoxLayoutItem | NodeLayout<any>)[];
  spacing?: number;
  contentsMargins?: [number, number, number, number];
}

export function BoxLayout(options: BoxLayoutOptions): QBoxLayout {
  const { children, contentsMargins, direction, spacing } = options;

  const boxLayout = new QBoxLayout(direction);
  if (spacing !== undefined) {
    boxLayout.setSpacing(spacing);
  }

  if (contentsMargins !== undefined) {
    boxLayout.setContentsMargins(...contentsMargins);
  }

  for (const child of children) {
    if (child) {
      if (child instanceof NodeWidget) {
        boxLayout.addWidget(child);
      } else if (child instanceof NodeLayout) {
        boxLayout.addLayout(child);
      } else {
        if (child.widget !== undefined) {
          boxLayout.addWidget(child.widget, child.stretch === undefined ? 0 : child.stretch,
            child.alignment === undefined ? 0 : child.alignment);
        } else if (child.layout !== undefined) {
          boxLayout.addLayout(child.layout, child.stretch === undefined ? 0 : child.stretch);
        }
      }
    }
  }

  return boxLayout;
}
