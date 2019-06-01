/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

function newUint32Array(length: number): Uint32Array {
  return new Uint32Array(Math.max(length, 0));
}


export function stringToCodePointArray(str: string): Uint32Array {
  const codePointArray = newUint32Array(countCodePoints(str));
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    codePointArray[c] = codePoint;
    if (codePoint > 0xffff) {
      i += 2;
    } else {
      i++;
    }
    c++;
  }

  return codePointArray;
}

export function countCodePoints(str: string): number {
  const len = str.length;
  let c = 0;
  let i = 0;
  while (i < len) {
    const codePoint = str.codePointAt(i);
    if (codePoint > 0xffff) {
      i += 2;
    } else {
      i++;
    }
    c++;
  }
  return c;
}
