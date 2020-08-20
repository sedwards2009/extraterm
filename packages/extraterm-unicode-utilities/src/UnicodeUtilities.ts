/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as easta from "easta";
const emoji_table = require("./emoji_table");

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
  if (codePoint < 4352) {
    return false;
  }

  if (codePoint >= 0x10000) {
    return true;
  }

  const ch = String.fromCodePoint(codePoint);
  switch (easta(ch)) {
    case 'Na': //Narrow
      return isEmojiWide(codePoint);
    case 'F': //FullWidth
      return true;
    case 'W': // Wide
      return true;
    case 'H': // HalfWidth
      return false;
    case 'A': // Ambiguous
      return isEmojiWide(codePoint);
    case 'N': // Neutral
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

/**
 * Returns true if the given code point is wide according to its Emoji
 * related unicode properties.
 */
export function isEmojiWide(codePoint: number): boolean {
  if (codePoint < emoji_table.wideEmojiRanges[0]) {
    return false;
  }

  return searchEmojiRanges(codePoint, 0, emoji_table.wideEmojiRanges.length / 2);
}

function searchEmojiRanges(codePoint: number, startSearchRange: number, endSearchRange: number): boolean {
  if (endSearchRange - startSearchRange < 8) {
    return linearSearchEmojiRanges(codePoint, startSearchRange, endSearchRange);
  }

  const midPoint = startSearchRange + Math.floor((endSearchRange - startSearchRange)/ 2);
  const midStartRange = emoji_table.wideEmojiRanges[midPoint * 2];
  if (codePoint < midStartRange) {
    return searchEmojiRanges(codePoint, startSearchRange, midPoint);
  } else {
    return searchEmojiRanges(codePoint, midPoint, endSearchRange);
  }
}

function linearSearchEmojiRanges(codePoint: number, startSearchRange: number, endSearchRange: number): boolean {
  for (let i=startSearchRange; i<endSearchRange; i++) {
    const offset = i * 2;
    const startRange = emoji_table.wideEmojiRanges[offset];
    const endRange = emoji_table.wideEmojiRanges[offset+1];
    if (codePoint >= startRange  && codePoint <= endRange) {
      return true;
    }
  }
  return false;
}
