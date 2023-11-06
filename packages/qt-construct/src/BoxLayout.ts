/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { AlignmentFlag, Direction, QLayout, QBoxLayout, QWidget, SizeConstraint } from "@nodegui/nodegui";
import { Label } from "./Label.js";


export interface BoxLayoutItem {
  widget?: QWidget;
  layout?: QLayout;
  stretch?: number;
  alignment?: AlignmentFlag;
}

export interface BoxLayoutOptions {
  direction: Direction;
  children: (QWidget | string | BoxLayoutItem | QLayout)[];
  sizeConstraint?: SizeConstraint,
  spacing?: number;
  contentsMargins?: [number, number, number, number] | number;
}

export function BoxLayout(options: BoxLayoutOptions): QBoxLayout {
  const { children, contentsMargins, direction, sizeConstraint, spacing } = options;

  const boxLayout = new QBoxLayout(direction);
  if (spacing !== undefined) {
    boxLayout.setSpacing(spacing);
  }

  if (sizeConstraint !== undefined) {
    boxLayout.setSizeConstraint(sizeConstraint);
  }

  if (contentsMargins !== undefined) {
    if (typeof contentsMargins === "number") {
      boxLayout.setContentsMargins(contentsMargins, contentsMargins, contentsMargins, contentsMargins);
    } else {
      boxLayout.setContentsMargins(...contentsMargins);
    }
  }

  for (const child of children) {
    if (child) {
      if ((typeof child) === "string") {
        const kid = Label({text: <string> child});
        boxLayout.addWidget(kid);
      } else if (child instanceof QWidget) {
        boxLayout.addWidget(child);
      } else if (child instanceof QLayout) {
        boxLayout.addLayout(child);
      } else if (isBoxLayoutItem(child)) {
        if (child.widget !== undefined) {
          boxLayout.addWidget(child.widget, child.stretch === undefined ? 0 : child.stretch,
            child.alignment === undefined ? 0 as AlignmentFlag : child.alignment);
        } else if (child.layout !== undefined) {
          boxLayout.addLayout(child.layout, child.stretch === undefined ? 0 : child.stretch);
        }
      }
    }
  }

  return boxLayout;
}

function isBoxLayoutItem(item:any): item is BoxLayoutItem {
  return typeof item === "object" && (item.widget !== undefined || item.layout !== undefined);
}
