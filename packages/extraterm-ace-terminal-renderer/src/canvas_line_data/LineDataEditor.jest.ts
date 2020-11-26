/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import "jest";

import { LineDataEditor } from "./LineDataEditor";
import { LineData } from "./LineData";
import { Line } from "term-api";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { Delta } from "@extraterm/ace-ts";
import { LineImpl } from "term-api-lineimpl";


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

  createLine(width: number): Line {
    return new LineImpl(width, 1);
  }
}

function createLineDataFromString(str: string, width: number): LineData {
  const strLines = str.split("\n");
  const lineList: Line[] = [];
  for (const str of strLines) {
    const line = new LineImpl(str.length, 1);
    line.setString(0, 0, str);
    lineList.push(line);
  }

  return new LineDataImpl(lineList);
}

const testCases: [string, string, Delta, string][] = [
  ["insert into one row", "0123456789", {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc"]
  }, "01234abc56789"],

  ["insert at start of row", "0123456789", {
    action: "insert",
    start: { row: 0, column: 0},
    end: { row: 0, column: 0},
    lines: ["abc"]
  }, "abc0123456789"],

  ["insert at end of one row", "0123456789", {
    action: "insert",
    start: { row: 0, column: 10},
    end: { row: 0, column: 10},
    lines: ["abc"]
  }, "0123456789abc"],

  ["remove across rows", "0123456789\nabcdefgh\nijklmnopq", {
    action: "remove",
    start: { row: 0, column: 4},
    end: { row: 2, column: 1},
    lines: []
  }, "0123jklmnopq"],

  ["remove inside one line", "0123456789", {
    action: "remove",
    start: { row: 0, column: 4},
    end: { row: 0, column: 6},
    lines: []
  }, "01236789"],

  ["insert into 1 row with 4 rows", "0123456789", {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc", "def", "ghi", "jkl"]
  }, "01234abc\ndef\nghi\njkl56789"],

  ["insert into 1 row with 2 rows", "0123456789", {
    action: "insert",
    start: { row: 0, column: 5},
    end: { row: 0, column: 5},
    lines: ["abc", "def"]
  }, "01234abc\ndef56789"],

  ["delete in front", "0123456789\nabcdefgh\nijklmnopq", {
    action: "remove",
    start: { row: 0, column: 0},
    end: { row: 1, column: 0},
    lines: null
  }, "abcdefgh\nijklmnopq"],

  ["insert in front", "0123456789\nabcdefgh\nijklmnopq", {
    action: "insert",
    start: { row: 0, column: 0},
    end: { row: 0, column: 0},
    lines: ["XXX", ""]
  }, "XXX\n0123456789\nabcdefgh\nijklmnopq"],

];

describe.each(testCases)("Evaluate", (name: string, input: string, delta: Delta, output: string) => {
  test(`${name} test`, done => {
    const width = input.split("\n").reduce((accu, txt) => {
      return Math.max(accu, txt.length);
    }, 0);

    const lineData = createLineDataFromString(input, width);
    const editor = new LineDataEditor(lineData);

    editor.update(delta);

    const outputTextRows = output.split("\n");
    for (let i=0; i < outputTextRows.length; i++) {
      expect(lineData.getLine(i).getString(0, 0)).toBe(outputTextRows[i]);
    }

    done();
  });
});
