/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 */

import { QColor } from "@nodegui/nodegui";

export function RGBAToQColor(rgba: number): QColor {
  const red = (rgba >> 24) & 0xff;
  const green = (rgba >> 16) & 0xff;
  const blue = (rgba >> 8) & 0xff;
  const alpha = (rgba & 0xff);
  return new QColor(red, green, blue, alpha);
}
