import * as TermApi from "term-api";
import { BG_COLOR_INDEX } from "extraterm-char-cell-grid";

const DEFAULT_CELL = TermApi.packAttr(0, 257, 256);

function newUint32Array(length: number): Uint32Array {
  return new Uint32Array(Math.max(length, 0));
}

export function create(length: number): TermApi.OldLine {
  const attrs= new Uint32Array(length);
  for (let i=0; i<length; i++) {
    attrs[i] = DEFAULT_CELL;
  }

  return {
    chars: null,
    attrs
  };  
}

export function insertSpaces(line: TermApi.OldLine, column: number, count: number): void {
  const newAttr = newUint32Array(line.attrs.length + count);
  newAttr.set(line.attrs, 0);
  newAttr.set(line.attrs.slice(column), column + count);

  const cellAttr = line.attrs.length === 0 ? DEFAULT_CELL : line.attrs[Math.max(0, column-1)];
  newAttr.fill(cellAttr, column, column + count);
  line.attrs = newAttr;
}

export function split(line: TermApi.OldLine, column: number): TermApi.OldLine {
  const leftAttr = new Uint32Array(line.attrs.slice(0, column));
  const rightAttr = newUint32Array(line.attrs.length - column);
  rightAttr.set(line.attrs.slice(column), 0);
  line.attrs = leftAttr;
  return {
    chars: null,
    attrs: rightAttr
  };
}

export function cut(line: TermApi.OldLine, startColumn: number, endColumn?: number): void {
  if (endColumn == null) {
    const newAttr = new Uint32Array(line.attrs.slice(0, startColumn));
    line.attrs = newAttr;
  } else {
    const newAttr = newUint32Array(startColumn + line.attrs.length - endColumn);
    newAttr.set(line.attrs.slice(0, startColumn), 0);
    newAttr.set(line.attrs.slice(endColumn), startColumn);
    line.attrs = newAttr;
  }
}

export function insert(line: TermApi.OldLine, column: number, insetLine: TermApi.OldLine): void {
  const leftAttr = newUint32Array(line.attrs.length + insetLine.attrs.length);
  leftAttr.set(line.attrs.slice(0, column), 0);
  leftAttr.set(insetLine.attrs, column);
  leftAttr.set(line.attrs.slice(column), column + insetLine.attrs.length);
  line.attrs = leftAttr;
}

export function copy(sourceLine: TermApi.OldLine): TermApi.OldLine {
  return {
    attrs: new Uint32Array(sourceLine.attrs),
    chars: new Uint32Array(sourceLine.chars),
  };
}

const spaceCodePoint = " ".codePointAt(0);

export function lastVisibleCellInLine(termLine: TermApi.Line, row=0): number {
  let lastNonEmpty = -1;
  for (let i=0; i<termLine.width; i++) {
    const codePoint = termLine.getCodePoint(i, row);
    if (codePoint !== spaceCodePoint ||
          termLine.getStyle(i, 0) !== 0 ||
          ! termLine.isBgClut(i, 0) ||
          termLine.getBgClutIndex(i, 0) !== BG_COLOR_INDEX) {
      lastNonEmpty = i;
    }
  }
  return lastNonEmpty;
}
