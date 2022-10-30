/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { CharCellLine, STYLE_MASK_BOLD, STYLE_MASK_UNDERLINE, STYLE_MASK_HYPERLINK } from "../CharCellGrid.js";


function makeGrid(): CharCellLine {
  return new CharCellLine(10, [
    0x00000000,
    0xffffffff,
    0xff0000ff,
    0x00ff00ff,
    0x0000ffff,
    0xff00ffff,
    0xffff00ff,
  ]);
}

function fillLine(grid: CharCellLine, char: string): void {
  const codePoint = char.codePointAt(0);
  for (let x=0; x<grid.width; x++) {
    grid.setCodePoint(x, codePoint);
  }
}

function isLineFilled(grid: CharCellLine, char: string): boolean {
  const codePoint = char.codePointAt(0);
  for (let x=0; x<grid.width; x++) {
    if (grid.getCodePoint(x) !== codePoint) {
      return false;
    }
  }
  return true;
}


const xtermColors: number[] = [
  // dark:
  0x000000ff, // black
  0xcd0000ff, // red3
  0x00cd00ff, // green3
  0xcdcd00ff, // yellow3
  0x0000eeff, // blue2
  0xcd00cdff, // magenta3
  0x00cdcdff, // cyan3
  0xe5e5e5ff, // gray90
  // bright:
  0x7f7f7fff, // gray50
  0xff0000ff, // red
  0x00ff00ff, // green
  0xffff00ff, // yellow
  0x5c5cffff, // rgb:5c/5c/ff
  0xff00ffff, // magenta
  0x00ffffff, // cyan
  0xffffffff  // white
];

// Colors 0-15 + 16-255
// Much thanks to TooTallNate for writing this.
function xtermPalette(): number[] {
  const colors = xtermColors;
  const r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

  const out = (r: number, g: number, b: number) => {
    colors.push( (r << 24) | (g << 16) | (b << 8) | 0xff);
  };

  let i;

  // 16-231
  i = 0;
  for (; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  i = 0;
  for (; i < 24; i++) {
    const v = 8 + i * 10;
    out(v, v, v);
  }

  // Default BG/FG
  colors[256] = 0x00000000;
  colors[257] = 0xf0f0f0ff;
  return colors;
}


describe.each([0, 5, 9, 0,])("Code points", (x: number) => {

  describe.each([
    "A".codePointAt(0),
    " ".codePointAt(0),
    0x1f984
  ])("", (codePoint: number) => {

    test(`set/get ${x} = ${codePoint}`, () => {
      const grid = makeGrid();

      grid.setCodePoint(x, codePoint);
      expect(grid.getCodePoint(x)).toBe(codePoint);
    });

    test(`clear ${x} = ${codePoint}`, () => {
      const grid = makeGrid();

      grid.setCodePoint(x, codePoint);
      grid.clear();
      expect(grid.getCodePoint(x)).toBe(" ".codePointAt(0));
    });
  });

  describe.each([
    0xff00ffff,
    0x123456ff,
  ])("", (color: number) => {

    test(`FG ${x} = ${color}`, () => {
      const grid = makeGrid();
      grid.setFgRGBA(x, color);
      expect(grid.getFgRGBA(x)).toBe(color);
    });

    test(`BG ${x} = ${color}`, () => {
      const grid = makeGrid();
      grid.setBgRGBA(x, color);
      expect(grid.getBgRGBA(x)).toBe(color);
    });
  });

  describe.each([
    0,
    1,
    5,
  ])("", (color: number) => {

    test(`FG CLUT ${x} = ${color}`, () => {
      const grid = makeGrid();
      grid.setFgClutIndex(x, color);
      expect(grid.getFgClutIndex(x)).toBe(color);
    });

    test(`BG CLUT ${x} = ${color}`, () => {
      const grid = makeGrid();
      grid.setBgClutIndex(x, color);
      expect(grid.getBgClutIndex(x)).toBe(color);
    });
  });

  describe.each([
    0,
    1,
    5,
    255
  ])("", (style: number) => {
    test(`set/get style ${x} = ${style}`, () => {
      const grid = makeGrid();
      grid.setStyle(x, style);
      expect(grid.getStyle(x)).toBe(style);
    });
  });

  describe.each([
    true,
    false,
  ])("", (extraFontsFlags: boolean) => {
    test(`set/get extra font flags ${x} = ${extraFontsFlags}`, () => {
      const grid = makeGrid();
      grid.setExtraFontsFlag(x, extraFontsFlags);
      expect(grid.getExtraFontsFlag(x)).toBe(extraFontsFlags);
    });
  });


  describe.each([
    [0x808000ff, 0xd0d0d0ff, STYLE_MASK_BOLD | STYLE_MASK_UNDERLINE, 1, 2],

  ])("", (fgRGB: number, bgRGB: number, style: number, fgIndex: number, bgIndex: number) => {
    test(`Multi set/get RGB`, () => {
      const grid = makeGrid();

      grid.setFgRGBA(x, fgRGB);
      grid.setBgRGBA(x, bgRGB);
      grid.setStyle(x, style);

      expect(grid.getFgRGBA(x)).toBe(fgRGB);
      expect(grid.getBgRGBA(x)).toBe(bgRGB);
      expect(grid.getStyle(x)).toBe(style);
    });

    test(`Multi set/get RGB/CLUT`, () => {
      const grid = makeGrid();

      grid.setFgRGBA(x, fgRGB);
      grid.setBgClutIndex(x, bgIndex);
      grid.setStyle(x, style);

      expect(grid.getFgRGBA(x)).toBe(fgRGB);
      expect(grid.getBgClutIndex(x)).toBe(bgIndex);
      expect(grid.getStyle(x)).toBe(style);
    });

    test(`Multi set/get RGB/CLUT 2`, () => {
      const grid = makeGrid();

      grid.setFgClutIndex(x, fgIndex);
      grid.setBgRGBA(x, bgIndex);
      grid.setStyle(x, style);

      expect(grid.getFgClutIndex(x)).toBe(fgIndex);
      expect(grid.getBgRGBA(x)).toBe(bgIndex);
      expect(grid.getStyle(x)).toBe(style);
    });

  });
});

test("clearCell()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, "A".codePointAt(0));
  grid.setCodePoint(4, "B".codePointAt(0));
  grid.setCodePoint(5, "C".codePointAt(0));

  grid.clearCell(4);

  expect(grid.getCodePoint(3)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4)).toBe(" ".codePointAt(0));
  expect(grid.getCodePoint(5)).toBe("C".codePointAt(0));
});

test("shiftCellsRight()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, "A".codePointAt(0));
  grid.setCodePoint(4, "B".codePointAt(0));
  grid.setCodePoint(5, "C".codePointAt(0));
  grid.setCodePoint(6, "D".codePointAt(0));

  grid.setCodePoint(0, "X".codePointAt(0));
  grid.shiftCellsRight(4, 1);

  expect(grid.getCodePoint(3)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4)).toBe("B".codePointAt(0));
  expect(grid.getCodePoint(5)).toBe("B".codePointAt(0));
  expect(grid.getCodePoint(6)).toBe("C".codePointAt(0));

  expect(grid.getCodePoint(0)).toBe("X".codePointAt(0));
});

test("shiftCellsLeft()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, "A".codePointAt(0));
  grid.setCodePoint(4, "B".codePointAt(0));
  grid.setCodePoint(5, "C".codePointAt(0));
  grid.setCodePoint(6, "D".codePointAt(0));
  grid.setCodePoint(7, "E".codePointAt(0));
  grid.setCodePoint(8, "F".codePointAt(0));
  grid.setCodePoint(9, "G".codePointAt(0));

  grid.setCodePoint(0, "X".codePointAt(0));

  grid.shiftCellsLeft(4, 2);

  expect(grid.getCodePoint(3)).toBe("A".codePointAt(0));
  expect(grid.getCodePoint(4)).toBe("D".codePointAt(0));
  expect(grid.getCodePoint(5)).toBe("E".codePointAt(0));
  expect(grid.getCodePoint(6)).toBe("F".codePointAt(0));
  expect(grid.getCodePoint(7)).toBe("G".codePointAt(0));

  expect(grid.getCodePoint(0)).toBe("X".codePointAt(0));
});

test("clone()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, "A".codePointAt(0));
  grid.setCodePoint(4, "B".codePointAt(0));
  grid.setCodePoint(5, "C".codePointAt(0));

  const grid2 = grid.clone();

  grid.setCodePoint(3, "X".codePointAt(0));
  grid.setCodePoint(4, "Y".codePointAt(0));
  grid.setCodePoint(5, "Z".codePointAt(0));

  expect(grid2.width).toBe(grid.width);

  expect(grid2.getCodePoint(3)).toBe("A".codePointAt(0));
  expect(grid2.getCodePoint(4)).toBe("B".codePointAt(0));
  expect(grid2.getCodePoint(5)).toBe("C".codePointAt(0));

  expect(grid.getCodePoint(3)).toBe("X".codePointAt(0));
  expect(grid.getCodePoint(4)).toBe("Y".codePointAt(0));
  expect(grid.getCodePoint(5)).toBe("Z".codePointAt(0));
});

test("pasteGrid() 0", () => {
  const srcGrid = new CharCellLine(4);
  const destGrid = new CharCellLine(20);
  fillLine(srcGrid, "S");
  fillLine(destGrid, ".");

  destGrid.pasteLine(srcGrid, 0);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(3)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(4)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(5)).toBe(dotCodePoint);
});

test("pasteGrid() with palette", () => {
  const srcGrid = new CharCellLine(10);
  const palette = xtermPalette();
  const destGrid = new CharCellLine(10, palette);
  fillLine(srcGrid, "S");
  srcGrid.setFgClutIndex(0, 2);

  fillLine(destGrid, ".");

  destGrid.pasteLine(srcGrid, 0);

  expect(destGrid.getFgRGBA(0)).toBe(palette[2]);
});

test("pasteGrid() oversize", () => {
  const srcGrid = new CharCellLine(10);
  const destGrid = new CharCellLine(5);
  fillLine(srcGrid, "S");
  fillLine(destGrid, ".");

  destGrid.pasteLine(srcGrid, 0);

  expect(isLineFilled(destGrid, "S")).toBe(true);
});

test("pasteGrid() oversize and offset", () => {
  const srcGrid = new CharCellLine(10);
  fillLine(srcGrid, "S");

  const destGrid = new CharCellLine(5);
  fillLine(destGrid, ".");

  destGrid.pasteLine(srcGrid, 3);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(2)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(3)).toBe(sCodePoint);
});

test("pasteGrid() neg offset", () => {
  const srcGrid = new CharCellLine(5);
  const destGrid = new CharCellLine(20);
  fillLine(srcGrid, "S");
  fillLine(destGrid, ".");

  destGrid.pasteLine(srcGrid, -3);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(1)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(2)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(19)).toBe(dotCodePoint);
});

test("palette update", () => {
  const srcGrid = new CharCellLine(5, xtermPalette());
  fillLine(srcGrid, "S");
  srcGrid.setFgClutIndex(0, 1);
  srcGrid.setBgClutIndex(0, 3);

  srcGrid.setFgClutIndex(4, 2);
  srcGrid.setBgClutIndex(4, 4);

  const newPalette = xtermPalette();
  newPalette[1] = 0x12345678;
  newPalette[2] = 0x11223344;
  newPalette[3] = 0x87654321;
  newPalette[4] = 0xabcdefff;

  srcGrid.setPalette(newPalette);

  expect(srcGrid.getFgRGBA(0)).toBe(0x12345678);
  expect(srcGrid.getBgRGBA(0)).toBe(0x87654321);

  expect(srcGrid.getFgRGBA(4)).toBe(0x11223344);
  expect(srcGrid.getBgRGBA(4)).toBe(0xabcdefff);
});

test("bold bright colors", () => {
  const palette = xtermPalette();
  const NORMAL_1 = 0x12345678;
  const BRIGHT_1 = 0x11223344;

  palette[1] = NORMAL_1;
  palette[8+1] = BRIGHT_1;

  const grid = new CharCellLine(5, palette);
  fillLine(grid, "S");

  grid.setFgClutIndex(0, 1);
  expect(grid.getFgRGBA(0)).toBe(NORMAL_1);

  grid.setStyle(0, STYLE_MASK_BOLD);
  expect(grid.getFgRGBA(0)).toBe(BRIGHT_1);

  grid.setStyle(0, 0);
  expect(grid.getFgRGBA(0)).toBe(NORMAL_1);

  const palette2 = xtermPalette();
  const NORMAL_1_2 = 0x22334455;
  const BRIGHT_1_2 = 0x33445566;
  palette2[1] = NORMAL_1_2;
  palette2[8+1] = BRIGHT_1_2;

  grid.setPalette(palette2);
  expect(grid.getFgRGBA(0)).toBe(NORMAL_1_2);
});

test("character width", () => {
  const grid = new CharCellLine(5);
  fillLine(grid, ".");
  expect(grid.getCharExtraWidth(0)).toBe(0);

  grid.setCodePoint(0, 0x1f600); // emoji
  expect(grid.getCharExtraWidth(0)).toBe(1);

  grid.setCodePoint(0, 65);
  expect(grid.getCharExtraWidth(0)).toBe(0);
});

test("ligature length", () => {
  const grid = new CharCellLine(20);
  grid.setString(0, "Foo --> Bar");
  expect(grid.getLigature(0)).toBe(0);
  expect(grid.getLigature(4)).toBe(0);
  grid.setLigature(4, 3);
  expect(grid.getLigature(0)).toBe(0);
  expect(grid.getLigature(4)).toBe(3);
});

test("ligature length reset", () => {
  const grid = new CharCellLine(20);
  grid.setString(0, "Foo --> Bar");
  grid.setLigature(4, 3);
  expect(grid.getLigature(4)).toBe(3);
  grid.setLigature(4, 0);
  expect(grid.getLigature(4)).toBe(0);
});

test("Get/set row of flags", () => {
  const createGrid = () => {
    const grid = new CharCellLine(40);
    grid.setString(0, "Foo --> Bar and some random =!= stuff");
    return grid;
  };

  const firstGrid = createGrid();
  firstGrid.setLigature(4, 3);
  firstGrid.setLigature(20, 2);
  const flags = firstGrid.getRowFlags();

  for (let x=0; x<firstGrid.width; x++) {
    expect(flags[x]).toBe(firstGrid.getFlags(x));
  }

  const secondGrid = createGrid();
  secondGrid.setRowFlags(flags);

  for (let x=0; x<firstGrid.width; x++) {
    expect(firstGrid.getFlags(x)).toBe(secondGrid.getFlags(x));
  }
});

test("Link style", () => {
  const grid = new CharCellLine(40);
  grid.setLinkID(1, 1);
  expect(grid.getLinkID(1)).toBe(1);
  expect(grid.getStyle(1) & STYLE_MASK_HYPERLINK).toBe(STYLE_MASK_HYPERLINK);

  grid.setLinkID(1, 0);
  expect(grid.getLinkID(1)).toBe(0);
  expect(grid.getStyle(1) & STYLE_MASK_HYPERLINK).toBe(0);
});


function printHorizontalBorder(width: number): string {
  const chars = [];
  for (let x=0; x<width; x++) {
    chars.push("-");
  }
  return "+" + chars.join("") + "+";
}

function printGrid(grid: CharCellLine): void {
  const rows = [];

  rows.push(printHorizontalBorder(grid.width));
  const chars = [];
  for (let x=0; x<grid.width; x++) {
    chars.push(grid.getCodePoint(x));

  }
  rows.push("|" + String.fromCodePoint(...chars) + "|");
  rows.push(printHorizontalBorder(grid.width));
  console.log(rows.join("\n"));
}
