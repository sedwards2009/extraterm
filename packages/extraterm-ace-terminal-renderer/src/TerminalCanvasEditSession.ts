/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Document,
         EditSession,
         Delta,
         Fold,
         LanguageMode,
         TextMode, RangeBasic } from "ace-ts";

import * as TermApi from "term-api";
import { LineData } from "./canvas_line_data/LineData";
import { LineDataEditor } from "./canvas_line_data/LineDataEditor";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";


export class TerminalCanvasEditSession extends EditSession {
  private _lineData: TermApi.Line[] = [];
  private _lineDataEditor: LineDataEditor = null;
  private _log: Logger = null;

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
    this._log = getLogger("TerminalCanvasEditSession", this);

    const lineData: LineData = {
      getLine: (row: number): TermApi.Line => {
        let data = this._lineData[row];
        if (data == null) {
          const text = this.getLine(row);
          data = new CharCellGrid(text.length, 1);
          this._lineData[row] = data;
        }
        return data;
      },

      setLine: (row: number, line: TermApi.Line): void => {
        this._lineData[row] = line;
      },

      insertLinesBeforeRow: (row: number, lines: TermApi.Line[]): void => {
        this._lineData.splice(row, 0, ...lines);
      },
    
      deleteLines: (startRow: number, endRow: number): void => {
        this._lineData.splice(startRow, endRow-startRow);
      }
    };
    this._lineDataEditor = new LineDataEditor(lineData);
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

    const newText = line.getString(0,0);
    this.replace(range, newText);
    this._lineData[row] = line;
    return true;
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

    const newText = line.getString(0, 0);
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

    const newText = line.getString(0, 0);
    this.replace(range, newText + "\n");
    this._lineData[row] = line;
  }

  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);
    this._lineDataEditor.update(delta);
    return folds;
  }
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
