/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

export function RGBAToCss(rgba: number): string {
  const red = (rgba >> 24) & 0xff;
  const green = (rgba >> 16) & 0xff;
  const blue = (rgba >> 8) & 0xff;
  const alpha = (rgba & 0xff) / 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
