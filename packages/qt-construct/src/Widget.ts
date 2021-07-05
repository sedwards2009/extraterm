/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { NodeLayout, QWidget } from "@nodegui/nodegui";

export interface WidgetOptions {
  layout?: NodeLayout<any>;
}

export function ApplyWidgetOptions(widget: QWidget, options: WidgetOptions): void {
  if (options.layout !== undefined) {
    widget.setLayout(options.layout);
  }
}

export function Widget(options: WidgetOptions): QWidget {
  const widget = new QWidget();
  ApplyWidgetOptions(widget, options);
  return widget;
}
