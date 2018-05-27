import * as TermApi from "term-api";

const DEFAULT_CELL = TermApi.packAttr(0, 257, 256);

export function create(length: number): TermApi.Line {
  const attrs = new Uint32Array(length);
  for (let i=0; i<length; i++) {
    attrs[i] = DEFAULT_CELL;
  }

  return {
    chars: null,
    attrs
  };  
}

export function insertSpaces(line: TermApi.Line, column: number, count: number): void {
  const newAttr = new Uint32Array(line.attrs.length + count);
  newAttr.set(line.attrs, 0);
  newAttr.set(line.attrs.slice(column), column + count);

  const cellAttr = line.attrs.length === 0 ? DEFAULT_CELL : line.attrs[Math.max(0, column-1)];
  newAttr.fill(cellAttr, column, column + count);
  line.attrs = newAttr;
}

export function split(line: TermApi.Line, column: number): TermApi.Line {
  const leftAttr = new Uint32Array(line.attrs.slice(0, column));
  const rightAttr = new Uint32Array(line.attrs.length - column);
  rightAttr.set(line.attrs.slice(column), 0);
  line.attrs = leftAttr;
  return {
    chars: null,
    attrs: rightAttr
  };
}

export function cut(line: TermApi.Line, startColumn: number, endColumn?: number): void {
  if (endColumn == null) {
    const newAttr = new Uint32Array(line.attrs.slice(0, startColumn));
    line.attrs = newAttr;
  } else {
    const newAttr = new Uint32Array(startColumn + line.attrs.length - endColumn);
    newAttr.set(line.attrs.slice(0, startColumn), 0);
    newAttr.set(line.attrs.slice(endColumn), startColumn);
    line.attrs = newAttr;
  }
}

export function insert(line: TermApi.Line, column: number, insetLine: TermApi.Line): void {
  const leftAttr = new Uint32Array(line.attrs.length + insetLine.attrs.length);
  leftAttr.set(line.attrs.slice(0, column), 0);
  leftAttr.set(insetLine.attrs, column);
  leftAttr.set(line.attrs.slice(column), column + insetLine.attrs.length);
  line.attrs = leftAttr;
}
