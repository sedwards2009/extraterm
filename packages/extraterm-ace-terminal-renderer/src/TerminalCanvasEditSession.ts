/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { Document,
         EditSession,
         Delta,
         Fold,
         LanguageMode,
         TextMode, RangeBasic, OrientedRange } from "ace-ts";

import * as TermApi from "term-api";
import { LineData } from "./canvas_line_data/LineData";
import { LineDataEditor } from "./canvas_line_data/LineDataEditor";
import { CharCellGrid } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { TermLineHeavyString } from "./TermLineHeavyString";
import { stringToCodePointArray } from "extraterm-unicode-utilities";

// FIXME de-duplicate this class
class LineImpl extends CharCellGrid implements TermApi.Line {
  wrapped = false;

  constructor(width: number, height: number, _palette: number[]=null, __bare__=false) {
    super(width, height, _palette, __bare__);
  }

  clone(): TermApi.Line {
    const grid = new LineImpl(this.width, this.height, this.palette);
    this.cloneInto(grid);
    return grid;
  }
}


export class TerminalCanvasEditSession extends EditSession {
  private _lineData: TermApi.Line[] = [];
  private _lineDataEditor: LineDataEditor = null;
  private _log: Logger = null;

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
    this._log = getLogger("TerminalCanvasEditSession", this);

    const lineData: LineData = {
      createLine: (width: number): TermApi.Line => {
        return new LineImpl(width, 1);
      },

      getLine: (row: number): TermApi.Line => {
        let data = this._lineData[row];
        if (data == null) {
          const text = this.getLine(row);
          data = new LineImpl(text.length, 1);
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
  setTerminalLines(startRow: number, sourceLines: TermApi.Line[]): boolean {
    const lastRow = startRow + sourceLines.length - 1;
    const existingEndLine = this.getTerminalLine(lastRow);
    const range: RangeBasic = {
      start: {
        row: startRow,
        column: 0
      },
      end: {
        row: lastRow,
        column: existingEndLine != null ? existingEndLine.getUTF16StringLength(0, 0) : 0
      }
    };

    this.replace(range, sourceLines.map(line => this._createHeavyString(line)));
    return true;
  }

  private _createHeavyString(sourceLine: TermApi.Line): TermLineHeavyString {
    return new TermLineHeavyString(sourceLine);
  }

  getTerminalLine(row: number): TermApi.Line {
    return this._lineData[row];
  }

  appendTerminalLine(sourceLine: TermApi.Line): void {
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

    this.replace(range, ["", this._createHeavyString(sourceLine)]);
  }

  insertTerminalLines(row: number, lines: TermApi.Line[]): void {
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

    this.replace(range, [...lines.map(this._createHeavyString), ""]);
  }
  
  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);
    this._lineDataEditor.update(delta);
    return folds;
  }

  getStringScreenWidth(str: string, maxScreenColumn?: number, screenColumn?: number): number[] {
    if (maxScreenColumn === 0) {
      return [0, 0];
    }
    if (maxScreenColumn == null) {
      maxScreenColumn = Infinity;
    }
    screenColumn = screenColumn || 0;

    const codePoints = stringToCodePointArray(str);

    let codePoint: number;
    let column: number;
    for (column = 0; column < codePoints.length; column++) {
      codePoint = codePoints[column];

      // tab
      if (codePoint === 9) {
        screenColumn += this.getScreenTabSize(screenColumn);
      } else {
        // Yes, we treat full width chars as being 1 cell because
        // Term.ts pads then with an extra space char.
        screenColumn += 1;
      }

      if (screenColumn > maxScreenColumn) {
        break;
      }
    }
    return [screenColumn, column];
  }

  getUnwrappedTextRange(range: OrientedRange): string {
    const doc = this.docOrThrow();
    const wrappedText = doc.getTextRange(range);
    const lines = wrappedText.split("\n");

    const unwrappedLines: string[] = [];
    const startRow = range.start.row;
    for (let i=0; i<(lines.length-1); i++) {
      const terminalLine = this.getTerminalLine(startRow + i);
      unwrappedLines.push(lines[i]);
      if ( ! terminalLine.wrapped) {
        unwrappedLines.push("\n");
      }
    }
    unwrappedLines.push(lines[lines.length-1]);
    return unwrappedLines.join("");
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
