import { Document } from "ace-ts/build/Document";
import { EditSession } from "ace-ts/build/EditSession";
import { HighlighterToken } from "ace-ts/build/mode/Highlighter";
import { TokenWithIndex } from "ace-ts/build/Token";
import { RowAttributes } from "./RowAttributes";
import { Delta } from "ace-ts/build/Delta";
import { Fold } from "ace-ts/build/Fold";
import { LanguageMode } from "ace-ts/build/LanguageMode";
import { TextMode } from "ace-ts/build/mode/TextMode";


export class TerminalEditSession extends EditSession {

  private _rowAttributesList: RowAttributes[] = [];

  constructor(doc: string | Document, mode: LanguageMode = new TextMode(), callback?) {
    super(doc, mode, callback);
    this._initializeRowAttributes();
  }

  private _initializeRowAttributes(): void {
    const numberOfRows = this.doc.getLength();
    for (let i=0; i<numberOfRows; i++) {
      const line = this.doc.getLine(i);
      this._rowAttributesList.push(new RowAttributes(line.length));
    }

  }

  getTokens(row: number): HighlighterToken[] {
    const ra = this._rowAttributesList[row]
    const rowText = this.doc.getLine(row);
    return ra.getTokens(rowText);
  }

  protected _updateInternalDataOnChange(delta: Delta): Fold[] {
    const folds = super._updateInternalDataOnChange(delta);
    console.log("delta:", delta);

    if (delta.action === "insert") {
      this._updateDeltaInsert(delta);
    } else {
      this._updateDeltaRemove(delta);
    }

    return folds;
  }

  private _updateDeltaInsert(delta: Delta): void {
    const rowAttr = this._rowAttributesList[delta.start.row];
    if (delta.lines.length == 1) {
      rowAttr.insertSpaces(delta.start.column, delta.lines[0].length);
    } else {

      // Start row
      const endRowAttr = rowAttr.split(delta.start.column);
      rowAttr.insertSpaces(delta.start.column, delta.lines[0].length);

      // Middle rows
      if (delta.lines.length > 2) {
        const middleLast = delta.lines.length-1;
        const middleRows: RowAttributes[] = [];
        for (let i=1; i<middleLast; i++) {
          middleRows.push(new RowAttributes(delta.lines[i].length));
        }
        this._rowAttributesList.splice.apply(this._rowAttributesList, [delta.start.row+1, 0, ...middleRows]);
      }

      // End row
      endRowAttr.insertSpaces(0, delta.lines[delta.lines.length-1].length);
      this._rowAttributesList.splice(delta.start.row + delta.lines.length-1, 0, endRowAttr);
    }
  }

  private _updateDeltaRemove(delta: Delta): void {
    const startRow = delta.start.row;
    const endColumn = delta.end.column;
    const endRow = delta.end.row;
    if (startRow === endRow) {
      this._rowAttributesList[startRow].cut(delta.start.column, endColumn);
    } else {
      const startRowAttr = this._rowAttributesList[startRow];
      startRowAttr.cut(delta.start.column);
      const endRowAttr = this._rowAttributesList[delta.end.row];
      endRowAttr.cut(0, delta.end.column);
      startRowAttr.insert(startRowAttr.length, endRowAttr);
      if (delta.lines.length > 1) {
        this._rowAttributesList.splice(delta.start.row+1, delta.lines.length-1);
      }
    }
  }
}
