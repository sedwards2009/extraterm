/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { CharCellGrid } from "extraterm-char-cell-grid";

import { LigatureMarker } from "./LigatureMarker";


const validLigatures = ["***", "-->", "<--", "=!=", "=>"];

describe.each([
  ["***", 3],
  ["=!=", 3],
  ["Z=!=", 0],
  ["-", 0],
  ["=", 0],
  ["=X", 0],
  ["--", 0],
  ["=>", 2],
  ["=>X", 2],
])("Ligature length",
  (input: string, output: number): void => {
    test(`${input} is ${output}`, done => {
      const marker = new LigatureMarker(validLigatures);
      expect(marker.getLigatureLength(input)).toBe(output);
      done();
    });
  });

test("Mark ligatures", done => {
  const grid = new CharCellGrid(10, 5);
  grid.setString(0, 0, "Foo --> Bar");

  const marker = new LigatureMarker(validLigatures);
  marker.markLigatures(grid, 0);

  expect(grid.getLigature(0, 0)).toBe(0);
  expect(grid.getLigature(1, 0)).toBe(0);
  expect(grid.getLigature(2, 0)).toBe(0);
  expect(grid.getLigature(3, 0)).toBe(0);
  expect(grid.getLigature(4, 0)).toBe(3);
  expect(grid.getLigature(5, 0)).toBe(0);
  done();
});
