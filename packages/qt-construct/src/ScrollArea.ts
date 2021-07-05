/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QScrollArea, QWidget } from "@nodegui/nodegui";

export interface ScrollAreaOptions {
  widget: QWidget;
}

export function ScrollArea(options: ScrollAreaOptions): QScrollArea {
  const scrollArea = new QScrollArea();
  scrollArea.setWidget(options.widget);
  return scrollArea;
}
