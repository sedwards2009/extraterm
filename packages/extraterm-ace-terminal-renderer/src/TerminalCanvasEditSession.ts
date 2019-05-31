/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Document,
         EditSession,
         HighlighterToken,
         TokenWithIndex,
         Delta,
         Fold,
         LanguageMode,
         TextMode, RangeBasic } from "ace-ts";

import * as TermApi from "term-api";
import * as CharCellGridFunctions from "./CharCellGridFunctions";
import { CharCellGrid } from "extraterm-char-cell-grid";


export class TerminalCanvasEditSession extends EditSession {

  private _lineData: TermApi.Line[] = [];

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
console.log("TerminalCanvasEditSession");
  }

  getState(row: number): string {
    return "";
  }

  /**
   * 
   * @return True if the text changed.
   */
  setTerminalLine(row: number, sourceLine: TermApi.Line): boolean {
    const line = this._trimRightWhitespace(sourceLine);
    const range: RangeBasic = {
      start: {
        row,
        column: 0
      },
      end: {
        row,
        column: this.getLine(row).length
      }
    };

    const newText = CharCellGridFunctions.toString(line);
    const oldText = this.getLine(row);
    if (newText !== oldText) {
      this.replace(range, newText);
      this._lineData[row] = line;
      return true;
    } else {
      this._lineData[row] = line;
      return false;
    }
  }

  getTerminalLine(row: number): TermApi.Line {
    return this._lineData[row];
  }

  private _trimRightWhitespace(sourceLine: TermApi.Line): TermApi.Line {
    return sourceLine;
  }

  appendTerminalLine(sourceLine: TermApi.Line): void {
    const line = this._trimRightWhitespace(sourceLine);
    const rowCount = this.getLength();
    const range: RangeBasic = {
      start: {
        row: rowCount-1,
        column: this.getLine(rowCount-1).length
      },
      end: {
        row: rowCount,
        column: 0
      }
    };

    const newText = CharCellGridFunctions.toString(line);
    const lineDataLen = this._lineData.length;
    this.replace(range,"\n" + newText);
    this._lineData[lineDataLen] = line;
  }

  insertTerminalLine(row: number, sourceLine: TermApi.Line): void {
    const line = this._trimRightWhitespace(sourceLine);
    const range: RangeBasic = {
      start: {
        row,
        column: 0
      },
      end: {
        row,
        column: 0
      }
    };

    const newText = CharCellGridFunctions.toString(line);
    this.replace(range, newText + "\n");
    this._lineData[row] = line;
  }

  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);

    // if (delta.action === "insert") {
    //   this._updateDeltaInsert(delta);
    // } else {
    //   this._updateDeltaRemove(delta);
    // }

    return folds;
  }

  private _getLineData(row: number): TermApi.Line {
    let data = this._lineData[row];
    if (data == null) {
      const text = this.getLine(row);
      data = new CharCellGrid(text.length, 1);
      this._lineData[row] = data;
    }
    return data;
  }

  // private _updateDeltaInsert(delta: Delta): void {
  //   const lineData = this._getLineData(delta.start.row);

  //   if (delta.lines.length == 1) {
  //     CharCellGridFunctions.insertSpaces(lineData, delta.start.column, delta.lines[0].length);
  //   } else {

  //     // Start row
  //     const { leftLine, rightLine } = CharCellGridFunctions.split(lineData, delta.start.column);
  //     this._setLineData(delta.start.row, leftLine);


  //     CharCellGridFunctions.insertSpaces(lineData, delta.start.column, delta.lines[0].length);

  //     // Middle rows
  //     if (delta.lines.length > 2) {
  //       const middleLast = delta.lines.length-1;
  //       const middleRows: TermApi.Line[] = [];
  //       for (let i=1; i<middleLast; i++) {
  //         middleRows.push(new CharCellGrid(delta.lines[i].length, 1));  // FIXME count codepoints
  //       }
  //       this._lineData.splice.apply(this._lineData, [delta.start.row+1, 0, ...middleRows]);
  //     }

  //     // End row
  //     CharCellGridFunctions.insertSpaces(endRowAttr, 0, delta.lines[delta.lines.length-1].length);
  //     this._lineData.splice(delta.start.row + delta.lines.length-1, 0, endRowAttr);
  //   }
  // }

  // private _updateDeltaRemove(delta: Delta): void {
  //   const startRow = delta.start.row;
  //   const endColumn = delta.end.column;
  //   const endRow = delta.end.row;
  //   if (startRow === endRow) {
  //     CharCellGridFunctions.cut(this._getLineData(startRow), delta.start.column, endColumn);
  //   } else {
  //     const startRowLine = this._getLineData(startRow);
  //     CharCellGridFunctions.cut(startRowLine, delta.start.column);
  //     const endRowLine = this._getLineData(delta.end.row);
  //     CharCellGridFunctions.cut(endRowLine, 0, delta.end.column);
  //     CharCellGridFunctions.insert(startRowLine, startRowLine.attrs.length, endRowLine);
  //     if (delta.lines.length > 1) {
  //       this._lineData.splice(delta.start.row+1, delta.lines.length-1);
  //     }
  //   }
  // }
}

function maxNormalWidthCodePoint(): number {
  return 0x01c3;  // Last char before the Croatian digraphs. DejaVuSansMono has some extra wide chars after this.
}

/**
 * Return true if a code point has a normal monospace width of one cell.
 * 
 * @param the unicode code point to test
 * @return true if the code point has a normal monospace width of one cell.
 */
function isCodePointNormalWidth(codePoint: number): boolean {
  if (codePoint < 0x01c4) { // Latin up to the Croatian digraphs.
    return true;
  }

  if (codePoint <= 0x1cc) {// Croatian digraphs can be a problem.
    return false; 
  }

  if (codePoint < 0x1f1) {  // Up to Latin leter DZ.
    return true;
  }
  if (codePoint <= 0x1f3) { // Latin letter DZ.
    return false;
  }

  return false;
}

function isFirstSurogate(s: string): boolean {
  const codePoint = s.codePointAt(0);
  return (codePoint & 0xFC00) == 0xD800;
}
