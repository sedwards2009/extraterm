/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Delta, HeavyString } from "@extraterm/ace-ts";
import { LineData } from "./LineData";
import { Line } from "term-api";
import { countCodePoints } from "extraterm-unicode-utilities";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { TermLineHeavyString } from "../TermLineHeavyString";
import { lastVisibleCellInLine } from "../LineFunctions";


/**
 * Class updating our list of TermApi.Line data structure via Ace-TS's Delta objects.
 */
export class LineDataEditor {
  private _log: Logger = null;

  constructor(private readonly _lineData: LineData) {
    this._log = getLogger("LineDataEditor", this);
  }

  update(delta: Delta): void {
    if (delta.action === "insert") {
      this._updateInsert(delta);
    } else {
      this._updateRemove(delta);
    }
  }

  private _updateInsert(delta: Delta): void {
    if (delta.start.row === delta.end.row && delta.start.column === delta.end.column) {
      // Simple insert with no deletion.
      if (delta.lines.length === 1) {
        const newLine = this._insertIntoLine(this._lineData.getLine(delta.start.row), delta.start.column,
                          this._getLineFromDeltaLine(delta.lines[0]));
        this._lineData.setLine(delta.start.row, newLine);
      } else {
        this._insertRows(delta);
      }

    } else {
      this._updateInsert({
        action: "insert",
        start: delta.start,
        end: delta.start,
        lines: delta.lines
      });
    }
  }

  private _insertIntoLine(line: Line, pos: number, insertLine: Line): Line {
    const usedLength = lastVisibleCellInLine(line, 0) + 1;
    const strLength = insertLine.width;
    if ((usedLength + strLength) > line.width) {
      // Resize the line
      const newLine = this._lineData.createLine(usedLength + strLength);
      newLine.pasteGridWithLinks(line, 0, 0);

      this._insertIntoLineNoResize(newLine, pos, insertLine);
      return newLine;

    } else {
      this._insertIntoLineNoResize(line, pos, insertLine);
      return line;
    }
  }

  private _insertIntoLineNoResize(line: Line, pos: number, insertLine: Line): void {
    line.shiftCellsRight(pos, 0, insertLine.width);
    line.pasteGridWithLinks(insertLine, pos, 0);
  }

  private _insertRows(delta: Delta): void {
    const firstLineOfChange = this._lineData.getLine(delta.start.row);
    const strLines = delta.lines;

    let leftLine = this._lineData.createLine(delta.start.column);
    leftLine.pasteGridWithLinks(firstLineOfChange, 0, 0);
    leftLine = this._insertIntoLine(leftLine, delta.start.column, this._getLineFromDeltaLine(strLines[0]));
    this._lineData.setLine(delta.start.row, leftLine);

    let rightLine = this._lineData.createLine(firstLineOfChange.width - delta.start.column);
    rightLine.pasteGridWithLinks(firstLineOfChange, -delta.start.column, 0);
    rightLine = this._insertIntoLine(rightLine, 0, this._getLineFromDeltaLine(strLines[strLines.length-1]));

    const insertLineList: Line[] = [];
    if (strLines.length > 2) {
      for (let i=1; i<strLines.length-1; i++) {
        insertLineList.push(this._getLineFromDeltaLine(strLines[i]));
      }
    }

    insertLineList.push(rightLine);

    this._lineData.insertLinesBeforeRow(delta.start.row+1, insertLineList);
  }

  private _getLineFromDeltaLine(line: string | HeavyString): Line {
    if (typeof line === "string") {
      const newLine = this._lineData.createLine(countCodePoints(line));
      newLine.setString(0, 0, line);
      return newLine;
    } else {
      return (<TermLineHeavyString> line).termLine;
    }
  }

  private _updateRemove(delta: Delta): void {
    if (delta.start.row === delta.end.row) {
      const line = this._lineData.getLine(delta.start.row);

      const leftLine = this._lineData.createLine(delta.start.column);
      leftLine.pasteGridWithLinks(line, 0, 0);

      const newLine = this._lineData.createLine(Math.max(0, delta.start.column + line.width-delta.end.column));
      newLine.pasteGridWithLinks(line, -delta.end.column+delta.start.column, 0);
      newLine.pasteGridWithLinks(leftLine, 0, 0);
      this._lineData.setLine(delta.start.row, newLine);
    } else {
      const firstLine = this._lineData.getLine(delta.start.row);
      const lastLine = this._lineData.getLine(delta.end.row);
      const cutLeftLine = this._lineLeft(firstLine, delta.start.column);
      const cutRightLine = this._lineRight(lastLine, delta.end.column);
      const joinedLine = this._joinLines(cutLeftLine, cutRightLine);
      this._lineData.setLine(delta.start.row, joinedLine);
      this._lineData.deleteLines(delta.start.row+1, delta.end.row+1);
    }
  }

  private _lineLeft(line: Line, column: number): Line {
    const newLine = this._lineData.createLine(column);
    newLine.pasteGridWithLinks(line, 0, 0);
    return newLine;
  }

  private _lineRight(line: Line, column: number): Line {
    const newLine = this._lineData.createLine(Math.max(line.width-column, 0));
    newLine.pasteGridWithLinks(line, -column, 0);
    return newLine;
  }

  private _joinLines(leftLine: Line, rightLine: Line): Line {
    const newLine = this._lineData.createLine(leftLine.width + rightLine.width);
    newLine.pasteGridWithLinks(leftLine, 0, 0);
    newLine.pasteGridWithLinks(rightLine, leftLine.width, 0);
    return newLine;
  }
}
