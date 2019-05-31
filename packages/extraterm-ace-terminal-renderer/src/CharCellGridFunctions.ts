/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import * as TermApi from "term-api";
import { Cell, CharCellGrid } from "extraterm-char-cell-grid";


const DEFAULT_CELL: Cell = {
  codePoint: " ".codePointAt(0),
  bgClutIndex: 256,
  fgClutIndex: 257,
  flags: 0,
  style: 0,
  bgRGBA: 0x00000000,
  fgRGBA: 0xffffffff,
};

export function insertSpaces(line: TermApi.Line, column: number, count: number): void {
  line.shiftCellsRight(column, 0, count);

  const cellAttr = line.width === 0 ? DEFAULT_CELL : line.getCell(Math.max(0, column-1), 0);
  cellAttr.codePoint = " ".codePointAt(0);
  for (let i=column; i<column+count; i++) {
    line.setCell(i, 0, cellAttr);
  }
}

export function split(line: TermApi.Line, column: number): { leftLine: TermApi.Line, rightLine: TermApi.Line} {
  const leftLine = new CharCellGrid(column, 1);
  leftLine.pasteGrid(line, 0, 0);

  const rightLine = new CharCellGrid(line.width-column, 1);
  rightLine.pasteGrid(line, -column, 0);

  return {
    leftLine,
    rightLine
  };
}

export function toString(line: TermApi.Line): string {
  const codePoints = [];
  for (let i=0; i<line.width; i++) {
    codePoints.push(line.getCodePoint(i, 0));
  }
  return String.fromCodePoint(...codePoints);
}
