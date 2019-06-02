/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import "jest";

import { LineDataEditor } from "./LineDataEditor";
import { LineData } from "./LineData";
import { Line } from "term-api";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { Delta } from "ace-ts";


class LineDataImpl implements LineData {

  private _linesList: Line[] = [];

  constructor(lines: Line[]) {
    this._linesList = lines;
  }

  getLine(row: number): Line {
    return this._linesList[row];
  }

  setLine(row: number, line: Line): void {
    this._linesList[row] = line;
  }
}

function createLineDataFromString(str: string, width: number): LineData {
  const strLines = str.split("\n");
  const lineList: Line[] = [];
  for (const str of strLines) {
    const line = new CharCellGrid(width, 1);
    line.setString(0, 0, str);
    lineList.push(line);
  }

  return new LineDataImpl(lineList);
}


test("insert into 1 row", done => {

  const lineData = createLineDataFromString("0123456789", 20);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc"]
  };
  editor.update(delta);

  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("01234abc56789");

  done();
});

test("insert into 1 row with resize", done => {
  const lineData = createLineDataFromString("0123456789", 10);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc"]
  };
  editor.update(delta);
  
  expect(lineData.getLine(0).width).toBe(13);
  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("01234abc56789");

  done();
});
