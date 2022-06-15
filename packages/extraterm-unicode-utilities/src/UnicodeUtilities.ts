/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import easta from "easta";
import * as emoji_table from "./emoji_table.js";

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

/**
 * Count the number of cells required to display this string.
 *
 * This takes UTF16 surrogate pairs into account and full width characters.
 */
export function countCells(str: string): number {
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    i += utf16LengthOfCodePoint(codePoint);
    c++;
    if (isWide(codePoint)) {
      c++;
    }
  }
  return c;
}

/**
 * Reverse a string.
 *
 * This takes UTF16 surrogate pairs into account
 */
export function reverseString(str: string): string {
  const codePoints = stringToCodePointArray(str);

  for (let left=0, right=codePoints.length-1; left < right; left++, right--) {
    const tmp = codePoints[left];
    codePoints[left] = codePoints[right];
    codePoints[right] = tmp;
  }
  return String.fromCodePoint(...codePoints);
}

export function isWide(codePoint: number): boolean {
  if (codePoint < 4352) {
    return false;
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
 * Returns true if the given code point has marked with Emoji_presention=true
 */
export function hasEmojiPresentation(codePoint: number): boolean {
  if (codePoint < emoji_table.emojiRanges[0]) {
    return false;
  }

  return searchEmojiRanges(emoji_table.emojiRanges, codePoint, 0, emoji_table.emojiRanges.length / 2);
}

/**
 * Returns true if the given code point is wide according to its Emoji
 * related unicode properties.
 */
export function isEmojiWide(codePoint: number): boolean {
  if (codePoint < emoji_table.wideEmojiRanges[0]) {
    return false;
  }

  return searchEmojiRanges(emoji_table.wideEmojiRanges, codePoint, 0, emoji_table.wideEmojiRanges.length / 2);
}

function searchEmojiRanges(ranges: Uint32Array, codePoint: number, startSearchRange: number, endSearchRange: number): boolean {
  if (endSearchRange - startSearchRange < 8) {
    return linearSearchEmojiRanges(ranges, codePoint, startSearchRange, endSearchRange);
  }

  const midPoint = startSearchRange + Math.floor((endSearchRange - startSearchRange)/ 2);
  const midStartRange = ranges[midPoint * 2];
  if (codePoint < midStartRange) {
    return searchEmojiRanges(ranges, codePoint, startSearchRange, midPoint);
  } else {
    return searchEmojiRanges(ranges, codePoint, midPoint, endSearchRange);
  }
}

function linearSearchEmojiRanges(ranges: Uint32Array, codePoint: number, startSearchRange: number, endSearchRange: number): boolean {
  for (let i=startSearchRange; i<endSearchRange; i++) {
    const offset = i * 2;
    const startRange = ranges[offset];
    const endRange = ranges[offset+1];
    if (codePoint >= startRange  && codePoint <= endRange) {
      return true;
    }
  }
  return false;
}
