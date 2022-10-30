
/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { LineImpl } from "../LineImpl.js";

const EXTRATERM_URL = "https://extraterm.org/";

test("pasteGridWithLinks()", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH);

  const sourceLine = new LineImpl(GRID_WIDTH);
  sourceLine.setString(0, "extraterm.org");
  setCellsLink(sourceLine, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, 0);

  for (let i=0; i<GRID_WIDTH; i++) {
    const linkID = destGrid.getLinkID(i);
    if (i < "extraterm.org".length) {
      expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
    } else {
      expect(linkID).toBe(0);
    }
  }
});

test("pasteGridWithLinks() over existing links", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH);
  destGrid.setString(5, "reddit.com");
  setCellsLink(destGrid, 5, "reddit.com".length, "https://reddit.com/");

  const sourceLine = new LineImpl(GRID_WIDTH);
  sourceLine.setString(0, "extraterm.org");
  setCellsLink(sourceLine, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, 0);

  for (let i=0; i<"extraterm.org".length; i++) {
    const linkID = destGrid.getLinkID(i);
    expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
  }
});

test("pasteGridWithLinks() over existing links, offset", () => {
  const GRID_WIDTH = 20;
  const destGrid = new LineImpl(GRID_WIDTH);
  destGrid.setString(5, "reddit.com");
  setCellsLink(destGrid, 5, "reddit.com".length, "https://reddit.com/");

  const sourceLine = new LineImpl(GRID_WIDTH);
  sourceLine.setString(0, "extraterm.org");
  setCellsLink(sourceLine, 0, "extraterm.org".length, EXTRATERM_URL);

  destGrid.pasteGridWithLinks(sourceLine, -8);

  expect(destGrid.getLinkURLByID(destGrid.getLinkID(4))).toEqual({ url: EXTRATERM_URL, group: "" });
  expect(destGrid.getLinkID(5)).toBe(0);

  for (let i=0; i<"extraterm.org".length; i++) {
    if (i >= 8) {
      const linkID = destGrid.getLinkID(i-8);
      expect(destGrid.getLinkURLByID(linkID)).toEqual({ url: EXTRATERM_URL, group: "" });
    }
  }
});

test("LinkID overflow", () => {
  const GRID_WIDTH = 300;
  const grid = new LineImpl(GRID_WIDTH);

  grid.setString(0, "E");
  for (let i=0; i < 255; i++) {
    grid.setString(i, "E");
    setCellsLink(grid, 0, 1, `https://extraterm.org/${i}`);
  }

  setCellsLink(grid, 0, 1, `https://extraterm.org/`);

  expect(grid.getLinkURLByID(grid.getLinkID(0))).toEqual( { url: "https://extraterm.org/", group: "" });
});

test("getString()", () => {
  const contents = "extraterm.org";
  const grid = new LineImpl(contents.length);
  grid.setString(0, contents);

  expect(grid.getString(5)).toBe("term.org");
});

function setCellsLink(grid: LineImpl, x: number, len: number, url: string): void {
  const linkID = grid.getOrCreateLinkIDForURL(url);
  for (let i=0; i<len; i++) {
    grid.setLinkID(x + i, linkID);
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
  const chars = [];
  for (let x=0; x<grid.width; x++) {
    chars.push(grid.getCodePoint(x));
  }
  rows.push("|" + String.fromCodePoint(...chars) + "|");
  rows.push(printHorizontalBorder(grid.width));
  console.log(rows.join("\n"));
}

function printGridLinkID(grid: LineImpl): void {
  const rows = [];

  rows.push(printHorizontalBorder(grid.width * 4));
  const chars = [];
  for (let x=0; x<grid.width; x++) {
    chars.push(`${grid.getLinkID(x)}`.padStart(3, " ") + " ");
  }
  rows.push("|" + chars.join("") + "|");
  rows.push(printHorizontalBorder(grid.width * 4));
  console.log(rows.join("\n"));
}
