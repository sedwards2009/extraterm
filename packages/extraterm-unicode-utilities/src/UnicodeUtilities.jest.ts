/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { utf16LengthOfCodePoint } from "./UnicodeUtilities";

describe.each([
  ["A".codePointAt(0), 1],
  [0x1F346, 2],
  
])("UTF16 cases", (codePoint: number, length: number) => {
  
  test("utf16LengthOfCodePoint", done => {
    expect(utf16LengthOfCodePoint(codePoint)).toBe(length);
    done();
  });

});
