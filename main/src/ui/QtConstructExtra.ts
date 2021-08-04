/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QWidget } from "@nodegui/nodegui";
import { BoxLayout, Label } from "qt-construct";

export interface CompactGroupOptions {
  children: (QWidget | string)[];
}

/**
 * Visually group a bunch of widgets
 *
 * Strings are turned into labels
 */
export function makeGroupLayout(...children: (QWidget | string)[]): QBoxLayout {

  const expandedChildren: QWidget[] = children.map((c): QWidget => {
    if ((typeof c) === "string") {
      return Label({text: <string>c, cssClass: ["group-middle"]});
    } else {
      (<QWidget>c).setProperty("cssClass", ["group-middle"]);
      return <QWidget>c;
    }
  });

  if (expandedChildren.length !== 0) {
    expandedChildren[0].setProperty("cssClass", ["group-left"]);
    expandedChildren[expandedChildren.length-1].setProperty("cssClass", ["group-right"]);
  }

  return BoxLayout({
    direction: Direction.LeftToRight,
    spacing: 0,
    contentsMargins: [0, 0, 0, 0],
    children: expandedChildren,
  });
}
