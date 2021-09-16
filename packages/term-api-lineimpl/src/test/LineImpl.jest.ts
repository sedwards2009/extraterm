
/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { LineImpl } from "../LineImpl";

const EXTRATERM_URL = "https://extraterm.org/";

test("pasteGridWithLinks()", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH, 5);

  const sourceLine = new LineImpl(GRID_WIDTH, 1);
  sourceLine.setString(0, 0, "extraterm.org");
  setCellsLink(sourceLine, 0, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, 0, 1);

  const checkRow = (row: number): void => {
    for (let i=0; i<GRID_WIDTH; i++) {
      expect(destGrid.getLinkID(i, row)).toBe(0);
    }
  };
  checkRow(0);
  checkRow(2);
  checkRow(3);
  checkRow(4);

  for (let i=0; i<"extraterm.org".length; i++) {
    const linkID = destGrid.getLinkID(i, 1);
    expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
  }
});

test("pasteGridWithLinks() over existing links", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH, 5);
  destGrid.setString(5, 0, "reddit.com");
  setCellsLink(destGrid, 5, 0, "reddit.com".length, "https://reddit.com/");

  const sourceLine = new LineImpl(GRID_WIDTH, 1);
  sourceLine.setString(0, 0, "extraterm.org");
  setCellsLink(sourceLine, 0, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, 0, 1);

  const checkRow = (row: number): void => {
    for (let i=0; i<GRID_WIDTH; i++) {
      expect(destGrid.getLinkID(i, row)).toBe(0);
    }
  };

  expect(destGrid.getLinkURLByID(destGrid.getLinkID(5, 0))).toEqual({ url: "https://reddit.com/", group: "" });

  checkRow(2);
  checkRow(3);
  checkRow(4);

  for (let i=0; i<"extraterm.org".length; i++) {
    const linkID = destGrid.getLinkID(i, 1);
    expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
  }
});

test("pasteGridWithLinks() over existing links, offset", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH, 5);
  destGrid.setString(5, 0, "reddit.com");
  setCellsLink(destGrid, 5, 0, "reddit.com".length, "https://reddit.com/");

  const sourceLine = new LineImpl(GRID_WIDTH, 1);
  sourceLine.setString(0, 0, "extraterm.org");
  setCellsLink(sourceLine, 0, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, -8, 1);

  const checkRow = (row: number): void => {
    for (let i=0; i<GRID_WIDTH; i++) {
      expect(destGrid.getLinkID(i, row)).toBe(0);
    }
  };

  expect(destGrid.getLinkURLByID(destGrid.getLinkID(5, 0))).toEqual({ url: "https://reddit.com/", group: "" });
  expect(destGrid.getLinkURLByID(destGrid.getLinkID(4, 1))).toEqual({ url: EXTRATERM_URL, group: "" });
  expect(destGrid.getLinkID(5, 1)).toBe(0);

  checkRow(2);
  checkRow(3);
  checkRow(4);

  for (let i=0; i<"extraterm.org".length; i++) {
    if (i >= 8) {
      const linkID = destGrid.getLinkID(i-8, 1);
      expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
    }
  }
});

test("LinkID overflow", () => {
  const GRID_WIDTH = 20;
  const grid = new LineImpl(GRID_WIDTH, 5);

  grid.setString(0, 0, "extraterm.org");
  for (let i=0; i < 255; i++) {
    setCellsLink(grid, 0, 0, "extraterm.org".length, `https://extraterm.org/${i}`);
  }

  setCellsLink(grid, 0, 0, "extraterm.org".length, `https://extraterm.org/`);

  expect(grid.getLinkURLByID(grid.getLinkID(0, 0))).toEqual( { url: "https://extraterm.org/", group: "" });
});

test("getString()", () => {
  const contents = "extraterm.org";
  const grid = new LineImpl(contents.length, 1);
  grid.setString(0, 0, contents);

  expect(grid.getString(5, 0)).toBe("term.org");
});

function setCellsLink(grid: LineImpl, x: number, y: number, len: number, url: string): void {
  const linkID = grid.getOrCreateLinkIDForURL(url);
  for (let i=0; i<len; i++) {
    grid.setLinkID(x + i, y, linkID);
  }
}

function printHorizontalBorder(width: number): string {
  const chars = [];
  for (let x=0; x<width; x++) {
    chars.push("-");
  }
  return "+" + chars.join("") + "+";
}

function printGrid(grid: LineImpl): void {
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

function printGridLinkID(grid: LineImpl): void {
  const rows = [];

  rows.push(printHorizontalBorder(grid.width * 4));
  for (let y=0; y<grid.height; y++) {
    const chars = [];
    for (let x=0; x<grid.width; x++) {
      chars.push(`${grid.getLinkID(x, y)}`.padStart(3, " ") + " ");

    }
    rows.push("|" + chars.join("") + "|");
  }
  rows.push(printHorizontalBorder(grid.width * 4));
  console.log(rows.join("\n"));
}
