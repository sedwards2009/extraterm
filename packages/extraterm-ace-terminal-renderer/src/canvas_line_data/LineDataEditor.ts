/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Delta } from "ace-ts";
import { LineData } from "./LineData";
import { Line } from "term-api";
import { countCodePoints, stringToCodePointArray } from "extraterm-unicode-utilities";
import { CharCellGrid } from "extraterm-char-cell-grid";


/**
 * Class updating our list of TermApi.Line data structure via Ace-TS's Delta objects.
 */
export class LineDataEditor {
  constructor(private readonly _lineData: LineData) {
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
        const newLine = this._insertIntoLine(this._lineData.getLine(delta.start.row), delta.start.column, delta.lines[0]);
        this._lineData.setLine(delta.start.row, newLine);
      } else {
        this._insertRows(delta);
      }

    } else {
      // Something is being deleted too.
      this._updateRemove({
        action: "remove",
        start: delta.start,
        end: delta.end,
        lines: null
      });

      this._updateInsert({
        action: "insert",
        start: delta.start,
        end: delta.start,
        lines: delta.lines
      });
    }
  }

  private _insertIntoLine(line: Line, pos: number, str: string, ): Line {
    const usedLength = this._getUsedLineLength(line);
    const strLength = countCodePoints(str);
    if ((usedLength + strLength) > line.width) {
      // Resize the line
      const newLine = new CharCellGrid(usedLength + strLength, 1);
      newLine.pasteGrid(line, 0, 0);

      this._insertIntoLineNoResize(newLine, pos, str);
      return newLine;

    } else {
      this._insertIntoLineNoResize(line, pos, str);
      return line;
    }
  }

  private _insertIntoLineNoResize(line: Line, pos: number, str: string): void {
    const codePoints = stringToCodePointArray(str);
    const strLength = codePoints.length;

    line.shiftCellsRight(pos, 0, strLength);

    for (let i=0; i<strLength; i++) {
      line.setCodePoint(i+pos, 0, codePoints[i]);
    }
  }

  private _insertRows(delta: Delta): void {
    const firstLineOfChange = this._lineData.getLine(delta.start.row);
    const strLines = delta.lines;

    let leftLine = new CharCellGrid(delta.start.column, 1);
    leftLine.pasteGrid(firstLineOfChange, 0, 0);
    leftLine = this._insertIntoLine(leftLine, delta.start.column, strLines[0]);
    this._lineData.setLine(delta.start.row, leftLine);

    let rightLine = new CharCellGrid(firstLineOfChange.width - delta.start.column, 1);
    rightLine.pasteGrid(firstLineOfChange, -delta.start.column, 0);
    rightLine = this._insertIntoLine(rightLine, 0, strLines[strLines.length-1]);

    const insertLineList: Line[] = [];
    if (strLines.length > 2) {
      for (let i=1; i<strLines.length-1; i++) {
        const newLine = new CharCellGrid(countCodePoints(strLines[i]), 1);
        newLine.setString(0, 0, strLines[i]);
        insertLineList.push(newLine);    
      }
    }

    insertLineList.push(rightLine);

    this._lineData.insertLinesBeforeRow(delta.start.row+1, insertLineList);
  }

  private _updateRemove(delta: Delta): void {

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
      if ( ! line.getFgClutIndex(i, 257)) {
        break;
      }
      if ( ! line.isBgClut(i, 0)) {
        break;
      }
      if ( ! line.getBgClutIndex(i, 256)) {
        break;
      }
    }
    return i<0 ? 0 : i+1;
  }
}
