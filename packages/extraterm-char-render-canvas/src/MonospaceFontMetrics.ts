/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */


export interface MonospaceFontMetrics {
  fontSizePx: number,
  fontFamily: string,

  fillTextYOffset: number;  // Offset to add to y when rendering text.
  fillTextXOffset: number;  // Offset to add to x when rendering text.

  widthPx: number;
  heightPx: number;

  strikethroughY: number;
  strikethroughHeight: number;
  underlineY: number;
  underlineHeight: number;
}
