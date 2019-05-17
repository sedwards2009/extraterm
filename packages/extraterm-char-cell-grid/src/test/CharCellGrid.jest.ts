/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";
import { CharCellGrid, STYLE_MASK_BOLD, STYLE_MASK_UNDERLINE } from "../CharCellGrid";


function makeGrid(): CharCellGrid {
  return new CharCellGrid(10, 12, [
    0x00000000,
    0xffffffff,
    0xff0000ff,
    0x00ff00ff,
    0x0000ffff,
    0xff00ffff,
    0xffff00ff,
  ]);
}

describe.each([
  [0, 0],
  [5, 3],
  [9, 9],
  [0, 0],
])("Code points", (x: number, y: number) => {

  describe.each([
    "A".codePointAt(0),
    " ".codePointAt(0),
    0x1f984
  ])("", (codePoint: number) => {

    test(`set/get (${x}, ${y}) = ${codePoint}`, () => {
      const grid = makeGrid();
  
      grid.setCodePoint(x, y, codePoint);
      expect(grid.getCodePoint(x, y)).toBe(codePoint);
    });

    test(`clear (${x}, ${y}) = ${codePoint}`, () => {
      const grid = makeGrid();
  
      grid.setCodePoint(x, y, codePoint);
      grid.clear();
      expect(grid.getCodePoint(x, y)).toBe(" ".codePointAt(0));
    });
  });

  describe.each([
    0xff00ffff,
    0x123456ff,
  ])("", (color: number) => {

    test(`FG (${x}, ${y}) = ${color}`, () => {
      const grid = makeGrid();
      grid.setFgRGBA(x, y, color);
      expect(grid.getFgRGBA(x, y)).toBe(color);
    });

    test(`BG (${x}, ${y}) = ${color}`, () => {
      const grid = makeGrid();  
      grid.setBgRGBA(x, y, color);
      expect(grid.getBgRGBA(x, y)).toBe(color);
    });
  });

  describe.each([
    0,
    1,
    5,
  ])("", (color: number) => {

    test(`FG CLUT (${x}, ${y}) = ${color}`, () => {
      const grid = makeGrid();
      grid.setFgClutIndex(x, y, color);
      expect(grid.getFgClutIndex(x, y)).toBe(color);
    });

    test(`BG CLUT (${x}, ${y}) = ${color}`, () => {
      const grid = makeGrid();  
      grid.setBgClutIndex(x, y, color);
      expect(grid.getBgClutIndex(x, y)).toBe(color);
    });
  });

  describe.each([
    0,
    1,
    5,
    255
  ])("", (style: number) => {
    test(`set/get style (${x}, ${y}) = ${style}`, () => {
      const grid = makeGrid();
      grid.setStyle(x, y, style);
      expect(grid.getStyle(x, y)).toBe(style);
    });
  });

  describe.each([
    true,
    false,
  ])("", (extraFontsFlags: boolean) => {
    test(`set/get extra font flags (${x}, ${y}) = ${extraFontsFlags}`, () => {
      const grid = makeGrid();
      grid.setExtraFontsFlag(x, y, extraFontsFlags);
      expect(grid.getExtraFontsFlag(x, y)).toBe(extraFontsFlags);
    });
  });


  describe.each([
    [0x808000ff, 0xd0d0d0ff, STYLE_MASK_BOLD | STYLE_MASK_UNDERLINE, 1, 2],

  ])("", (fgRGB: number, bgRGB: number, style: number, fgIndex: number, bgIndex: number) => {
    test(`Multi set/get RGB`, () => {
      const grid = makeGrid();

      grid.setFgRGBA(x, y, fgRGB);
      grid.setBgRGBA(x, y, bgRGB);
      grid.setStyle(x, y, style);

      expect(grid.getFgRGBA(x, y)).toBe(fgRGB);
      expect(grid.getBgRGBA(x, y)).toBe(bgRGB);
      expect(grid.getStyle(x, y)).toBe(style);
    });

    test(`Multi set/get RGB/CLUT`, () => {
      const grid = makeGrid();

      grid.setFgRGBA(x, y, fgRGB);
      grid.setBgClutIndex(x, y, bgIndex);
      grid.setStyle(x, y, style);

      expect(grid.getFgRGBA(x, y)).toBe(fgRGB);
      expect(grid.getBgClutIndex(x, y)).toBe(bgIndex);
      expect(grid.getStyle(x, y)).toBe(style);
    });

    test(`Multi set/get RGB/CLUT 2`, () => {
      const grid = makeGrid();

      grid.setFgClutIndex(x, y, fgIndex);
      grid.setBgRGBA(x, y, bgIndex);
      grid.setStyle(x, y, style);

      expect(grid.getFgClutIndex(x, y)).toBe(fgIndex);
      expect(grid.getBgRGBA(x, y)).toBe(bgIndex);
      expect(grid.getStyle(x, y)).toBe(style);
    });

  });
});

test("clearCell()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3,4, "A".codePointAt(0));
  grid.setCodePoint(4,4, "B".codePointAt(0));
  grid.setCodePoint(5,4, "C".codePointAt(0));

  grid.clearCell(4,4);
  
  expect(grid.getCodePoint(3,4)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4,4)).toBe(" ".codePointAt(0));
  expect(grid.getCodePoint(5,4)).toBe("C".codePointAt(0));
});

test("shiftCellsRight()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, 4, "A".codePointAt(0));
  grid.setCodePoint(4, 4, "B".codePointAt(0));
  grid.setCodePoint(5, 4, "C".codePointAt(0));
  grid.setCodePoint(6, 4, "D".codePointAt(0));

  grid.setCodePoint(0, 5, "X".codePointAt(0));
  grid.shiftCellsRight(4, 4, 1);

  expect(grid.getCodePoint(3, 4)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4, 4)).toBe("B".codePointAt(0));
  expect(grid.getCodePoint(5, 4)).toBe("B".codePointAt(0));
  expect(grid.getCodePoint(6, 4)).toBe("C".codePointAt(0));

  expect(grid.getCodePoint(0, 5)).toBe("X".codePointAt(0));  
});

test("shiftCellsLeft()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, 4, "A".codePointAt(0));
  grid.setCodePoint(4, 4, "B".codePointAt(0));
  grid.setCodePoint(5, 4, "C".codePointAt(0));
  grid.setCodePoint(6, 4, "D".codePointAt(0));
  grid.setCodePoint(7, 4, "E".codePointAt(0));
  grid.setCodePoint(8, 4, "F".codePointAt(0));
  grid.setCodePoint(9, 4, "G".codePointAt(0));

  grid.setCodePoint(0, 5, "X".codePointAt(0));

  grid.shiftCellsLeft(4, 4, 2);

  expect(grid.getCodePoint(3, 4)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4, 4)).toBe("D".codePointAt(0));
  expect(grid.getCodePoint(5, 4)).toBe("E".codePointAt(0));
  expect(grid.getCodePoint(6, 4)).toBe("F".codePointAt(0));
  expect(grid.getCodePoint(7, 4)).toBe("G".codePointAt(0));

  expect(grid.getCodePoint(0, 5)).toBe("X".codePointAt(0));  
});

test("copy()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, 4, "A".codePointAt(0));
  grid.setCodePoint(4, 4, "B".codePointAt(0));
  grid.setCodePoint(5, 4, "C".codePointAt(0));

  const grid2 = grid.copy();

  grid.setCodePoint(3, 4, "X".codePointAt(0));
  grid.setCodePoint(4, 4, "Y".codePointAt(0));
  grid.setCodePoint(5, 4, "Z".codePointAt(0));

  expect(grid2.width).toBe(grid.width);
  expect(grid2.height).toBe(grid.height);

  expect(grid2.getCodePoint(3, 4)).toBe("A".codePointAt(0));
  expect(grid2.getCodePoint(4, 4)).toBe("B".codePointAt(0));
  expect(grid2.getCodePoint(5, 4)).toBe("C".codePointAt(0));

  expect(grid.getCodePoint(3, 4)).toBe("X".codePointAt(0));
  expect(grid.getCodePoint(4, 4)).toBe("Y".codePointAt(0));
  expect(grid.getCodePoint(5, 4)).toBe("Z".codePointAt(0));
});

function printHorizontalBorder(width: number): string {
  const chars = [];
  for (let x=0; x<width; x++) {
    chars.push("-");
  }
  return "+" + chars.join("") + "+";
}

function printGrid(grid: CharCellGrid): void {
  const rows = [];

  rows.push(printHorizontalBorder(grid.width));
  for (let y=0; y<grid.height; y++) {
    const chars = [];
    for (let x=0; x<grid.width; x++) {
      chars.push(grid.getCodePoint(x, y));

    }
    rows.push("|" + String.fromCodePoint(...chars) + "|");
  }
  rows.push(printHorizontalBorder(grid.width));
  console.log(rows.join("\n"));
}
