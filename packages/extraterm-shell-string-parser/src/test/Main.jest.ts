/*
 * Copyright 2018 Nick Shanny <nshanny@shannymusings.com>
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";

import { ShellStringParser } from '../main';


function arrayEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i=0; i<a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

describe.each([
  ["", []],
  ["   ", []],
  ["  One  ", ["One"]],
  ["One ' Spacey '", ["One", " Spacey "]],
  ["One", ["One"]],
  ["One\'", ["One\'"]],
  ["One Two", ["One", "Two"]],
  ["One Two 'Three Four'", ["One", "Two", "Three Four"]],
  ["One Two \"Three Four\"", ["One", "Two", "Three Four"]],
  ["/C 'c:\\foo\\bar\\nick.txt'", ["/C", "c:\\foo\\bar\\nick.txt"]],
  ["/C \"c:\\foo\\bar\\nick.txt\"", ["/C", "c:\\foo\\bar\\nick.txt"]],
  ["/C \"c:\\foo\\bar\\nick.txt", ["/C", "\"c:\\foo\\bar\\nick.txt"]],
])("", (input, output) => {

  test(`parse "${input}"`, () => {
    expect(arrayEqual(ShellStringParser(input), output)).toBe(true);
  });
});
