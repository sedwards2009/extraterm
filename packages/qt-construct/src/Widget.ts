/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { FocusPolicy, NodeLayout, NodeWidget, QWidget, WidgetEventTypes } from "@nodegui/nodegui";

export interface WidgetOptions {
  enabled?: boolean;
  id?: string;
  layout?: NodeLayout<any>;
  cssClass?: string | string[];
  windowTitle?: string;
  focusPolicy?: FocusPolicy;
  onKeyPress?: (nativeEvent /* NativeQEvent */) => void;
}

export function ApplyWidgetOptions(widget: NodeWidget<any>, options: WidgetOptions): void {
  const { enabled, id, cssClass, focusPolicy, layout, onKeyPress, windowTitle } = options;
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
  if (windowTitle !== undefined) {
    widget.setWindowTitle(windowTitle);
  }
  if (focusPolicy !== undefined) {
    widget.setFocusPolicy(focusPolicy);
  }
  if (onKeyPress !== undefined) {
    widget.addEventListener(WidgetEventTypes.KeyPress, onKeyPress);
  }
}

export function Widget(options: WidgetOptions): QWidget {
  const widget = new QWidget();
  ApplyWidgetOptions(widget, options);
  return widget;
}
