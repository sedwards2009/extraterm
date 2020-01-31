/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as easta from "easta";

function newUint32Array(length: number): Uint32Array {
  return new Uint32Array(Math.max(length, 0));
}

/**
 * Convert a JS style UTF16 string to a Uint32Array of unicode code points
 */
export function stringToCodePointArray(str: string): Uint32Array {
  const codePointArray = newUint32Array(countCodePoints(str));
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    codePointArray[c] = codePoint;
    i += utf16LengthOfCodePoint(codePoint);
    c++;
  }

  return codePointArray;
}

/**
 * Count the number of code points in a JS UTF16 string
 */
export function countCodePoints(str: string): number {
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    i += utf16LengthOfCodePoint(codePoint);
    c++;
  }
  return c;
}

export function isWide(codePoint: number): boolean {
  if (codePoint >= 0x10000) {
    return true;
  }

  const ch = String.fromCodePoint(codePoint);
  switch (easta(ch)) {
    case 'Na': //Narrow
      return false;
    case 'F': //FullWidth
      return true;
    case 'W': // Wide
      return true;
    case 'H': //HalfWidth
      return false;
    case 'A': //Ambiguous
      return false;
    case 'N': //Neutral
      return false;
    default:
      return false;
  }
}

/**
 * Get the UTF16 size in 16bit words of a unicode code point
 */
export function utf16LengthOfCodePoint(codePoint: number): number {
  return codePoint > 0xffff ? 2 : 1;
}
