/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { CharCellGrid, STYLE_MASK_BOLD, STYLE_MASK_UNDERLINE, STYLE_MASK_HYPERLINK } from "../CharCellGrid.js";


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

function fillGrid(grid: CharCellGrid, char: string): void {
  const codePoint = char.codePointAt(0);
  for (let y=0; y<grid.height; y++) {
    for (let x=0; x<grid.width; x++) {
      grid.setCodePoint(x, y, codePoint);
    }
  }
}

function isGridFilled(grid: CharCellGrid, char: string): boolean {
  const codePoint = char.codePointAt(0);
  for (let y=0; y<grid.height; y++) {
    for (let x=0; x<grid.width; x++) {
      if (grid.getCodePoint(x, y) !== codePoint) {
        return false;
      }
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

test("clone()", () => {
  const grid = makeGrid();
  grid.setCodePoint(3, 4, "A".codePointAt(0));
  grid.setCodePoint(4, 4, "B".codePointAt(0));
  grid.setCodePoint(5, 4, "C".codePointAt(0));

  const grid2 = grid.clone();

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

test("pasteGrid() 0,0", () => {
  const srcGrid = new CharCellGrid(4, 6);
  const destGrid = new CharCellGrid(20, 15);
  fillGrid(srcGrid, "S");
  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, 0, 0);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(0, 0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(3, 0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(4, 0)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(5, 0)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(0, 5)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(0, 6)).toBe(dotCodePoint);
});

test("pasteGrid() with palette", () => {
  const srcGrid = new CharCellGrid(10, 1);
  const palette = xtermPalette();
  const destGrid = new CharCellGrid(10, 1, palette);
  fillGrid(srcGrid, "S");
  srcGrid.setFgClutIndex(0, 0, 2);

  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, 0, 0);

  expect(destGrid.getFgRGBA(0, 0)).toBe(palette[2]);
});



test("pasteGrid() 2,3", () => {
  const srcGrid = new CharCellGrid(4, 6);
  const destGrid = new CharCellGrid(20, 15);
  fillGrid(srcGrid, "S");
  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, 2, 3);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(1, 3)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(2, 3)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(5, 3)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(6, 3)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(7, 3)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(2, 8)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(2, 9)).toBe(dotCodePoint);
});

test("pasteGrid() oversize", () => {
  const srcGrid = new CharCellGrid(10, 20);
  const destGrid = new CharCellGrid(5, 15);
  fillGrid(srcGrid, "S");
  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, 0, 0);

  expect(isGridFilled(destGrid, "S")).toBe(true);
});

test("pasteGrid() oversize and offset", () => {
  const srcGrid = new CharCellGrid(10, 20);
  const destGrid = new CharCellGrid(5, 15);
  fillGrid(srcGrid, "S");
  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, 3, 10);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(2, 10)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(3, 10)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(3, 9)).toBe(dotCodePoint);
});

test("pasteGrid() neg offset", () => {
  const srcGrid = new CharCellGrid(5, 8);
  const destGrid = new CharCellGrid(20, 15);
  fillGrid(srcGrid, "S");
  fillGrid(destGrid, ".");

  destGrid.pasteGrid(srcGrid, -3, -5);

  const sCodePoint = "S".codePointAt(0);
  const dotCodePoint = ".".codePointAt(0);
  expect(destGrid.getCodePoint(0, 0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(1, 0)).toBe(sCodePoint);
  expect(destGrid.getCodePoint(2, 0)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(19, 0)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(0, 3)).toBe(dotCodePoint);
  expect(destGrid.getCodePoint(4, 3)).toBe(dotCodePoint);
});

test("palette update", () => {
  const srcGrid = new CharCellGrid(5, 10, xtermPalette());
  fillGrid(srcGrid, "S");
  srcGrid.setFgClutIndex(0, 0, 1);
  srcGrid.setBgClutIndex(0, 0, 3);

  srcGrid.setFgClutIndex(4, 9, 2);
  srcGrid.setBgClutIndex(4, 9, 4);

  const newPalette = xtermPalette();
  newPalette[1] = 0x12345678;
  newPalette[2] = 0x11223344;
  newPalette[3] = 0x87654321;
  newPalette[4] = 0xabcdefff;

  srcGrid.setPalette(newPalette);

  expect(srcGrid.getFgRGBA(0, 0)).toBe(0x12345678);
  expect(srcGrid.getBgRGBA(0, 0)).toBe(0x87654321);

  expect(srcGrid.getFgRGBA(4, 9)).toBe(0x11223344);
  expect(srcGrid.getBgRGBA(4, 9)).toBe(0xabcdefff);
});

test("bold bright colors", () => {
  const palette = xtermPalette();
  const NORMAL_1 = 0x12345678;
  const BRIGHT_1 = 0x11223344;

  palette[1] = NORMAL_1;
  palette[8+1] = BRIGHT_1;

  const grid = new CharCellGrid(5, 10, palette);
  fillGrid(grid, "S");

  grid.setFgClutIndex(0, 0, 1);
  expect(grid.getFgRGBA(0, 0)).toBe(NORMAL_1);

  grid.setStyle(0, 0, STYLE_MASK_BOLD);
  expect(grid.getFgRGBA(0, 0)).toBe(BRIGHT_1);

  grid.setStyle(0, 0, 0);
  expect(grid.getFgRGBA(0, 0)).toBe(NORMAL_1);

  const palette2 = xtermPalette();
  const NORMAL_1_2 = 0x22334455;
  const BRIGHT_1_2 = 0x33445566;
  palette2[1] = NORMAL_1_2;
  palette2[8+1] = BRIGHT_1_2;

  grid.setPalette(palette2);
  expect(grid.getFgRGBA(0, 0)).toBe(NORMAL_1_2);
});

test("scroll up", () => {
  const grid = new CharCellGrid(5, 10);
  fillGrid(grid, ".");
  grid.setCodePoint(1, 5, "X".codePointAt(0));

  grid.scrollVertical(-2);

  expect(grid.getCodePoint(1, 5)).toBe(".".codePointAt(0));
  expect(grid.getCodePoint(1, 3)).toBe("X".codePointAt(0));
});

test("scroll down", () => {
  const grid = new CharCellGrid(5, 10);
  fillGrid(grid, ".");
  grid.setCodePoint(1, 5, "X".codePointAt(0));

  grid.scrollVertical(2);

  expect(grid.getCodePoint(1, 5)).toBe(".".codePointAt(0));
  expect(grid.getCodePoint(1, 7)).toBe("X".codePointAt(0));
});

test("character width", () => {
  const grid = new CharCellGrid(5, 10);
  fillGrid(grid, ".");
  expect(grid.getCharExtraWidth(0, 0)).toBe(0);

  grid.setCodePoint(0, 0, 0x1f600); // emoji
  expect(grid.getCharExtraWidth(0, 0)).toBe(1);

  grid.setCodePoint(0, 0, 65);
  expect(grid.getCharExtraWidth(0, 0)).toBe(0);
});

test("ligature length", () => {
  const grid = new CharCellGrid(20, 5);
  grid.setString(0, 0, "Foo --> Bar");
  expect(grid.getLigature(0, 0)).toBe(0);
  expect(grid.getLigature(4, 0)).toBe(0);
  grid.setLigature(4, 0, 3);
  expect(grid.getLigature(0, 0)).toBe(0);
  expect(grid.getLigature(4, 0)).toBe(3);
});

test("ligature length reset", () => {
  const grid = new CharCellGrid(20, 5);
  grid.setString(0, 0, "Foo --> Bar");
  grid.setLigature(4, 0, 3);
  expect(grid.getLigature(4, 0)).toBe(3);
  grid.setLigature(4, 0, 0);
  expect(grid.getLigature(4, 0)).toBe(0);
});

test("Get/set row of flags", () => {
  const createGrid = () => {
    const grid = new CharCellGrid(40, 5);
    for (let i=0; i<5; i++) {
      grid.setString(0, i, "Foo --> Bar and some random =!= stuff");
    }
    return grid;
  };
  const ROW = 1;

  const firstGrid = createGrid();
  firstGrid.setLigature(4, ROW, 3);
  firstGrid.setLigature(20, ROW, 2);
  const flags = firstGrid.getRowFlags(ROW);

  for (let x=0; x<firstGrid.width; x++) {
    expect(flags[x]).toBe(firstGrid.getFlags(x, ROW));
  }

  const secondGrid = createGrid();
  secondGrid.setRowFlags(ROW, flags);

  for (let x=0; x<firstGrid.width; x++) {
    expect(firstGrid.getFlags(x, ROW)).toBe(secondGrid.getFlags(x, ROW));
  }
});

test("Link style", () => {
  const grid = new CharCellGrid(40, 5);
  grid.setLinkID(1, 2, 1);
  expect(grid.getLinkID(1, 2)).toBe(1);
  expect(grid.getStyle(1, 2) & STYLE_MASK_HYPERLINK).toBe(STYLE_MASK_HYPERLINK);

  grid.setLinkID(1, 2, 0);
  expect(grid.getLinkID(1, 2)).toBe(0);
  expect(grid.getStyle(1, 2) & STYLE_MASK_HYPERLINK).toBe(0);
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
