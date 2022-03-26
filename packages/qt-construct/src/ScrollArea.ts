/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QScrollArea, QScrollBar, QWidget, ScrollBarPolicy, Shape } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget";

export interface ScrollAreaOptions extends WidgetOptions {
  frameShape?: Shape,
  widget: QWidget;
  widgetResizable?: boolean;
  verticalScrollBar?: QScrollBar,
  verticalScrollBarPolicy?: ScrollBarPolicy;
}

export function ScrollArea(options: ScrollAreaOptions): QScrollArea {
  const { frameShape, widgetResizable, verticalScrollBar, verticalScrollBarPolicy } = options;
  const scrollArea = new QScrollArea();
  ApplyWidgetOptions(scrollArea, options);

  if (widgetResizable !== undefined) {
    scrollArea.setWidgetResizable(widgetResizable);
  }

  if (frameShape !== undefined) {
    scrollArea.setFrameShape(frameShape);
  }

  if (verticalScrollBarPolicy !== undefined) {
    scrollArea.setVerticalScrollBarPolicy(verticalScrollBarPolicy);
  }
  if (verticalScrollBar !== undefined) {
    scrollArea.setVerticalScrollBar(verticalScrollBar);
  }
  scrollArea.setWidget(options.widget);
  return scrollArea;
}
