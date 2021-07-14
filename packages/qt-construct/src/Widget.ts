/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { NodeLayout, NodeWidget, QWidget } from "@nodegui/nodegui";

export interface WidgetOptions {
  enabled?: boolean;
  id?: string;
  layout?: NodeLayout<any>;
  cssClass?: string | string[];
}

export function ApplyWidgetOptions(widget: NodeWidget<any>, options: WidgetOptions): void {
  const { enabled, id, cssClass, layout } = options;
  if (enabled !== undefined) {
    widget.setEnabled(enabled);
  }
  if (id !== undefined) {
    widget.setObjectName(id);
  }
  if (layout !== undefined) {
    widget.setLayout(layout);
  }
  if (cssClass !== undefined) {
    widget.setProperty("cssClass", cssClass);
  }
}

export function Widget(options: WidgetOptions): QWidget {
  const widget = new QWidget();
  ApplyWidgetOptions(widget, options);
  return widget;
}
