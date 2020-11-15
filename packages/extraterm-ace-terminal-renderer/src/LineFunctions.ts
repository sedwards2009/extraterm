import * as TermApi from "term-api";
import { BG_COLOR_INDEX } from "extraterm-char-cell-grid";

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
