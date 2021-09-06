/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QLabel, QWidget, TextFormat } from "@nodegui/nodegui";
import { BoxLayout, Label } from "qt-construct";
import { UiStyle } from "./UiStyle";

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

export interface LinkLabelOptions {
  onLinkActivated?: (url: string) => void;
  openExternalLinks?: boolean;
  text: string;
  uiStyle: UiStyle;
  wordWrap?: boolean;
}

/**
 * Create a QLabel which looks like a HTML link.
 *
 * Contents are rich text and the link responds to hover correctly.
 */
export function makeLinkLabel(options: LinkLabelOptions): QLabel {
  const { onLinkActivated, openExternalLinks, text, uiStyle, wordWrap } = options;
  const normalText = `${uiStyle.getLinkLabelCSS()}${text}`;
  const hoverText = `<span class="hover">${normalText}</span>`;
  const label = Label({
    text: normalText,
    onLinkActivated,
    openExternalLinks,
    textFormat: TextFormat.RichText,
    onEnter: () => label.setText(hoverText),
    onLeave: () => label.setText(normalText),
    wordWrap
  });
  return label;
}
