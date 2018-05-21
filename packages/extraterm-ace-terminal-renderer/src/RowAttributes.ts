import { HighlighterToken } from "ace-ts/build/mode/Highlighter";

interface CellAttributes {
  bold: boolean;
  foregroundColor: number;
  backgroundColor: number;
}

const DEFAULT_CELL = {
  bold: false,
  foregroundColor: 1,
  backgroundColor: 0
}


export class RowAttributes {

  private _cells: CellAttributes[];

  constructor(length: number) {
    this._cells = [];

    const otherCell = {
      bold: false,
      foregroundColor: 0,
      backgroundColor: 0
    }

    for (let i=0; i<length; i++) {
      this._cells.push(i % 4 === 0 ? otherCell : DEFAULT_CELL);
    }
  }
  
  getTokens(rowText: string): HighlighterToken[] {
    const tokens: HighlighterToken[] = [];

    for (let i=0; i<rowText.length; i++) {
      tokens.push({
        value: rowText.charAt(i),
        type: this._cells[i].foregroundColor % 2 === 0 ? "storage" : "string"
      });
    }
    return tokens;
  }

  get length(): number {
    return this._cells.length;
  }

  insert(column: number, attrs: RowAttributes): void {
    this._cells.splice.apply(this._cells, [column, 0, ...attrs._cells]);
  }

  insertSpaces(column: number, spaces: number): void {
    const cellAttr = this._cells.length === 0 ? DEFAULT_CELL : this._cells[Math.max(0, column-1)];
    for (let i=0; i<spaces; i++) {
      this._cells.splice(column, 0, cellAttr);
    }
  }

  cut(startColumn: number, endColumn?: number): void {
    if (endColumn === undefined) {
      this._cells.splice(startColumn, this._cells.length-startColumn);
    } else {
      this._cells.splice(startColumn, endColumn-startColumn);
    }
  }

  split(column: number): RowAttributes {
    const newRowAttr = new RowAttributes(0);
    newRowAttr._cells = this._cells.slice(column);
    this._cells = this._cells.slice(0, column);
    return newRowAttr;
  }
}

