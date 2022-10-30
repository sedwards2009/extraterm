/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import {
  CharCellLine, FLAG_MASK_LIGATURE, FLAG_MASK_WIDTH, FLAG_WIDTH_SHIFT, FLAG_MASK_EXTRA_FONT
} from "extraterm-char-cell-line";

export interface NormalizedCell {
  x: number;
  segment: number;
  codePoint: number;
  extraFontFlag: boolean;

  isLigature: boolean;
  ligatureCodePoints: number[];
  linkID: number;
}

/**
 * Iterate through a row of cells and emit a 'cell' which contains extra data
 * about where it is in a ligature etc.
 *
 * Looping through a `CharCellGrid` and keeping track or where you are w.r.t.
 * ligatures and wide chars is a PITA, but this simpliies the bookkeeping
 * considerably.
 *
 * The `result` is constantly recycled to avoid memory allocations.
 */
export function* normalizedCellIterator(cellGrid: CharCellLine, result: NormalizedCell): IterableIterator<number> {
  const rowLength = cellGrid.width;
  let x = 0;
  while (x < rowLength) {
    const flags = cellGrid.getFlags(x);

    const widthChars = ((flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT) + 1;
    const isLigature = flags & FLAG_MASK_LIGATURE;

    if (isLigature) {
      // Ligature case
      const extraFontFlag = (cellGrid.getFlags(x) & FLAG_MASK_EXTRA_FONT) !== 0;
      const linkID = cellGrid.getLinkID(x);

      const ligatureCodePoints: number[] = [];
      for (let k=0; k<widthChars; k++) {
        ligatureCodePoints[k] = cellGrid.getCodePoint(x+k);
      }

      for (let i=0; i<widthChars; i++) {
        result.x = x;
        result.segment = i;
        result.codePoint = null;
        result.extraFontFlag = extraFontFlag;
        result.isLigature = true;
        result.ligatureCodePoints = ligatureCodePoints;
        result.linkID = linkID;

        yield x;
        x++;
      }
    } else {
      // Normal and wide character case
      const codePoint = cellGrid.getCodePoint(x);
      const extraFontFlag = (cellGrid.getFlags(x) & FLAG_MASK_EXTRA_FONT) !== 0;
      const linkID = cellGrid.getLinkID(x);
      for (let k=0; k<widthChars; k++) {
        result.x = x;
        result.segment = k;
        result.codePoint = codePoint;
        result.extraFontFlag = extraFontFlag;
        result.isLigature = false;
        result.ligatureCodePoints = null;
        result.linkID = linkID;

        yield x;
        x++;
      }
    }
  }
}
