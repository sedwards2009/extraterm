/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QFrame } from "@nodegui/nodegui";
import { ApplyWidgetOptions, WidgetOptions } from "./Widget.js";


export interface FrameOptions extends WidgetOptions {
}

export function Frame(options: FrameOptions): QFrame {
  const frame = new QFrame();

  ApplyWidgetOptions(frame, options);

  return frame;
}
