/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { utf16LengthOfCodePoint, isEmojiWide } from "./UnicodeUtilities.js";

describe.each([
  ["A".codePointAt(0), 1],
  [0x1F346, 2],

])("UTF16 cases", (codePoint: number, length: number) => {

  test("utf16LengthOfCodePoint", done => {
    expect(utf16LengthOfCodePoint(codePoint)).toBe(length);
    done();
  });

});


describe.each([
  ["A", false],
  [0x2319, false],
  [0x231a, true],
  [0x231b, true],
  [0x231c, false],
  [0x1facf, false],
  [0x1fad0, true],
  [0x1fad6, true],
  [0x1fad7, false],
  [0x1f515, false],
  [0x1f516, true],
  [0x1f53d, true],
  [0x1f53e, false],
])("isEmojiWide case", (codePointOrString: number | string, isWide: boolean) => {

  const codePoint = (typeof codePointOrString == "string") ?
    codePointOrString.charCodeAt(0) : codePointOrString;

  test(isWide ? `Code point ${codePoint} is wide` : `Code point ${codePoint} is not wide`, done => {
    expect(isEmojiWide(codePoint)).toBe(isWide);
    done();
  });
});
