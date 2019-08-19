/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import * as TermApi from "term-api";

export interface LineData {
  createLine(width: number): TermApi.Line;
  getLine(row: number): TermApi.Line;
  setLine(row: number, line: TermApi.Line): void;
  insertLinesBeforeRow(row: number, lines: TermApi.Line[]): void;
  deleteLines(startRow: number, endRow: number): void;
}
