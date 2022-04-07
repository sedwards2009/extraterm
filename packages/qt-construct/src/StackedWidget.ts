/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QStackedWidget, QWidget } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";

export interface StackedWidgetOptions extends WidgetOptions {
  children: QWidget[];
  currentIndex?: number;
  onCurrentChanged?: (index: number) => void;
}

export function StackedWidget(options: StackedWidgetOptions): QStackedWidget {
  const stackedWidget = new QStackedWidget();

  ApplyWidgetOptions(stackedWidget, options);

  const { children, currentIndex, onCurrentChanged } = options;
  for (const child of children) {
    stackedWidget.addWidget(child);
  }

  if (onCurrentChanged !== undefined) {
    stackedWidget.addEventListener("currentChanged", onCurrentChanged);
  }

  if (currentIndex !== undefined) {
    stackedWidget.setCurrentIndex(currentIndex);
  }

  return stackedWidget;
}