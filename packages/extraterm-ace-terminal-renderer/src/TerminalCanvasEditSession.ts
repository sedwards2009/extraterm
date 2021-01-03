/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { Document,
         EditSession,
         Delta,
         Fold,
         LanguageMode,
         Position,
         TextMode,
         RangeBasic,
         OrientedRange } from "@extraterm/ace-ts";

import * as TermApi from "term-api";
import { LineData } from "./canvas_line_data/LineData";
import { LineDataEditor } from "./canvas_line_data/LineDataEditor";
import { log, Logger, getLogger } from "extraterm-logging";
import { TermLineHeavyString } from "./TermLineHeavyString";
import { stringToCodePointArray } from "extraterm-unicode-utilities";
import { LineImpl } from "term-api-lineimpl";


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

  // Our optimised version which doesn't need to support wrapping or folds.
  // The cost of this method becomes significant when thousands of lines are
  // in the document.
  screenPositionToDocumentPosition(screenRow: number, screenColumn: number): Position {
    if (isNaN(screenRow) || screenRow < 0) {
      return { row: 0, column: 0 };
    }

    const docRow = Math.floor(screenRow);
    const maxRow = this.getLength() - 1;
    if (docRow > maxRow) {
      // clip at the end of the document
      return {
        row: maxRow,
        column: this.getLine(maxRow).length
      };
    }

    const line = this.getLine(docRow);
    return {
      row: docRow,
      column: this.getStringScreenWidth(line, screenColumn)[1]
    };
  }

  getHyperlinkAtTextCoordinates(pos: Position): string {
    const line = this.getTerminalLine(pos.row);
    const linkID = line.getLinkID(pos.column, 0);
    return linkID === 0 ? null : line.getLinkURLByID(linkID).url;
  }

  applyHyperlinkAtTextCoordinates(pos: Position, length: number, url: string, group: string=""): void {
    const line = this.getTerminalLine(pos.row);
    const linkID = line.getOrCreateLinkIDForURL(url, group);
    for (let i = 0; i < length; i++) {
      line.setLinkID(pos.column + i, 0, linkID);
    }
  }

  removeHyperlinks(lineNumber: number, group: string=""): boolean {
    const line = this.getTerminalLine(lineNumber);
    const width = line.width;
    let didRemove = false;
    if (group === "") {
      for (let i=0; i<width; i++) {
        const linkID = line.getLinkID(i, 0);
        if (linkID !== 0) {
          line.setLinkID(i, 0, 0);
          didRemove = true;
        }
      }

    } else {
      const targetLinkIDs = line.getAllLinkIDs(group);
      if (targetLinkIDs.length !== 0) {
        for (let i=0; i<width; i++) {
          const linkID = line.getLinkID(i, 0);
          if (targetLinkIDs.includes(linkID)) {
            line.setLinkID(i, 0, 0);
            didRemove = true;
          }
        }
      }
    }

    return didRemove;
  }
}
