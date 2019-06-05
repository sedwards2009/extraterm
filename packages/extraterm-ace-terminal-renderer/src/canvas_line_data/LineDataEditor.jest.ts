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

  insertLinesBeforeRow(row: number, lines: Line[]): void {
    this._linesList.splice(row, 0, ...lines);
  }

  deleteLines(startRow: number, endRow: number): void {
    this._linesList.splice(startRow, endRow-startRow);
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

test("insert into 1 row with 2 rows", done => {
  const lineData = createLineDataFromString("0123456789", 10);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc", "def"]
  };
  editor.update(delta);
  
  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("01234abc");
  expect(lineData.getLine(1).getString(0, 0).trim()).toBe("def56789");

  done();
});

test("insert into 1 row with 4 rows", done => {
  const lineData = createLineDataFromString("0123456789", 10);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc", "def", "ghi", "jkl"]
  };
  editor.update(delta);
  
  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("01234abc");
  expect(lineData.getLine(1).getString(0, 0).trim()).toBe("def");
  expect(lineData.getLine(2).getString(0, 0).trim()).toBe("ghi");
  expect(lineData.getLine(3).getString(0, 0).trim()).toBe("jkl56789");

  done();
});

test("remove middle of 1 row", done => {
  const lineData = createLineDataFromString("0123456789", 10);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "remove",
    start: { row: 0, column: 4},
    end: { row: 0, column: 6},
    lines: []
  };
  editor.update(delta);
  
  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("01236789");

  done();
});

test("remove many rows", done => {
  const lineData = createLineDataFromString("0123456789\nabcdefgh\nijklmnopq", 10);
  const editor = new LineDataEditor(lineData);

  const delta: Delta = {
    action: "remove",
    start: { row: 0, column: 4},
    end: { row: 2, column: 1},
    lines: []
  };
  editor.update(delta);
  
  expect(lineData.getLine(0).getString(0, 0).trim()).toBe("0123jklmnopq");

  done();
});

