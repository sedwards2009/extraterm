/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Orientation, QScrollBar } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";


export interface ScrollBarOptions extends WidgetOptions {
  orientation?: Orientation;
  maximum?: number;
  onActionTriggered?: (action: number) => void;
  onRangeChanged?: (min: number, max: number) => void;
  onValueChanged?: (value: number) => void;
  value?: number;
}

export function ScrollBar(options: ScrollBarOptions): QScrollBar {
  const { maximum, onActionTriggered, onRangeChanged, onValueChanged, orientation, value } = options;
  const scrollBar = new QScrollBar();
  ApplyWidgetOptions(scrollBar, options);

  if (orientation !== undefined) {
    scrollBar.setOrientation(orientation);
  }
  if (maximum !== undefined) {
    scrollBar.setMaximum(maximum);
  }
  if (value !== undefined) {
    scrollBar.setValue(value);
  }
  if (onActionTriggered !== undefined) {
    scrollBar.addEventListener("actionTriggered", onActionTriggered);
  }
  if (onRangeChanged !== undefined) {
    scrollBar.addEventListener("rangeChanged", onRangeChanged);
  }
  if (onValueChanged !== undefined) {
    scrollBar.addEventListener("valueChanged", onValueChanged);
  }
  return scrollBar;
}
