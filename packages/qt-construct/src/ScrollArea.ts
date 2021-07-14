/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QScrollArea, QWidget } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface ScrollAreaOptions extends WidgetOptions {
  widget: QWidget;
  widgetResizable?: boolean;
}

export function ScrollArea(options: ScrollAreaOptions): QScrollArea {
  const { widgetResizable } = options;
  const scrollArea = new QScrollArea();
  ApplyWidgetOptions(scrollArea, options);

  if (widgetResizable !== undefined) {
    scrollArea.setWidgetResizable(widgetResizable);
  }

  scrollArea.setWidget(options.widget);
  return scrollArea;
}
