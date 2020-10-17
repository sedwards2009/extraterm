/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { Color } from "./ColorUtilities";

describe.each([
  ["#123456", 0x123456ff, "#123456", "rgba(18,52,86,1)"],
  ["#1234567f", 0x1234567f, "#123456", "rgba(18,52,86,0.4980392156862745)"],
  ["#000001", 0x000001ff, "#000001", "rgba(0,0,1,1)"],

])(`Parsing`, (input: number, rgba: number, hexString: string, rgbaString: string) => {
  test(`${input} to RGBA number`, done => {
    const color = new Color(input);
    expect(color.toRGBA()).toBe(rgba);
    done();
  });

  test("Round trip ${input}", done => {
    const color = new Color(input);
    expect(color.toHexString()).toBe(hexString);
    done();
  });

  test(`${input} to CSS`, done => {
    const color = new Color(input);
    expect(color.toRGBAString()).toBe(rgbaString);
    done();
  });
});
