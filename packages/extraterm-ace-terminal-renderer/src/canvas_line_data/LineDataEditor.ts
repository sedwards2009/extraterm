/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Delta, HeavyString } from "ace-ts";
import { LineData } from "./LineData";
import { Line } from "term-api";
import { countCodePoints, stringToCodePointArray } from "extraterm-unicode-utilities";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { TermLineHeavyString } from "../TermLineHeavyString";


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
      if (delta.lines.length == 1) {
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
    const usedLength = this._getUsedLineLength(line);
    const strLength = insertLine.width;
    if ((usedLength + strLength) > line.width) {
      // Resize the line
      const newLine = new CharCellGrid(usedLength + strLength, 1);
      newLine.pasteGrid(line, 0, 0);

      this._insertIntoLineNoResize(newLine, pos, insertLine);
      return newLine;

    } else {
      this._insertIntoLineNoResize(line, pos, insertLine);
      return line;
    }
  }

  private _insertIntoLineNoResize(line: Line, pos: number, insertLine: Line): void {
    line.shiftCellsRight(pos, 0, insertLine.width);
    line.pasteGrid(insertLine, pos, 0);
  }

  private _insertRows(delta: Delta): void {
    const firstLineOfChange = this._lineData.getLine(delta.start.row);
    const strLines = delta.lines;

    let leftLine = new CharCellGrid(delta.start.column, 1);
    leftLine.pasteGrid(firstLineOfChange, 0, 0);
    leftLine = this._insertIntoLine(leftLine, delta.start.column, this._getLineFromDeltaLine(strLines[0]));
    this._lineData.setLine(delta.start.row, leftLine);

    let rightLine = new CharCellGrid(firstLineOfChange.width - delta.start.column, 1);
    rightLine.pasteGrid(firstLineOfChange, -delta.start.column, 0);
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
      const newLine = new CharCellGrid(countCodePoints(line), 1);
      newLine.setString(0, 0, line);
      return newLine;
    } else {
      return (<TermLineHeavyString> line).termLine;
    }
  }

  private _updateRemove(delta: Delta): void {
    if (delta.start.row === delta.end.row) {
      const line = this._lineData.getLine(delta.start.row);

      const leftLine = new CharCellGrid(delta.start.column, 1);
      leftLine.pasteGrid(line, 0, 0);

      const newLine = new CharCellGrid(Math.max(0, delta.start.column + line.width-delta.end.column), 1);
      newLine.pasteGrid(line, -delta.end.column+delta.start.column, 0);
      newLine.pasteGrid(leftLine, 0, 0);
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

  /**
   * Get the length of the line after blank white space is stripped from the right side.
   */
  private _getUsedLineLength(line: Line): number {
    const spaceCodePoint = " ".codePointAt(0);
    let i = line.width-1;
    for (; i>=0; i--) {
      if (line.getCodePoint(i, 0) !== spaceCodePoint) {
        break;
      }
      if (line.getStyle(i, 0) !== 0) {
        break;
      }
      if ( ! line.isFgClut(i, 0)) {
        break;
      }
      if ( ! line.getFgClutIndex(i, 0)) {
        break;
      }
      if ( ! line.isBgClut(i, 0)) {
        break;
      }
      if ( ! line.getBgClutIndex(i, 0)) {
        break;
      }
    }
    return i<0 ? 0 : i+1;
  }

  private _lineLeft(line: Line, column: number): Line {
    const newLine = new CharCellGrid(column, 1);
    newLine.pasteGrid(line, 0, 0);
    return newLine;
  }

  private _lineRight(line: Line, column: number): Line {
    const newLine = new CharCellGrid(line.width-column, 1);
    newLine.pasteGrid(line, -column, 0);
    return newLine;
  }

  private _joinLines(leftLine: Line, rightLine: Line): Line {
    const newLine = new CharCellGrid(leftLine.width + rightLine.width, 1);
    newLine.pasteGrid(leftLine, 0, 0);
    newLine.pasteGrid(rightLine, leftLine.width, 0);
    return newLine;
  }
}
