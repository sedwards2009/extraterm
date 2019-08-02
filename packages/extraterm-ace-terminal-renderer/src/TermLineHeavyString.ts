/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { HeavyString } from "ace-ts";
import * as TermApi from "term-api";
import { BG_COLOR_INDEX } from "extraterm-char-cell-grid";

const spaceCodePoint = " ".codePointAt(0);

export class TermLineHeavyString implements HeavyString {

  length: number;
  private _stringValue: string;

  constructor(public termLine: TermApi.Line) {
    this._stringValue = this._toTrimmedString(this.termLine);
    this.length = this._stringValue.length;
  }

  getString(): string {
    return this._stringValue;
  }

  private _toTrimmedString(termLine: TermApi.Line): string {
    let lastNonEmpty = 0;
    for (let i=0; i<termLine.width; i++) {
      const codePoint = termLine.getCodePoint(i, 0);
      if (codePoint !== spaceCodePoint ||
            termLine.getStyle(i, 0) !== 0 ||
            ! termLine.isBgClut(i, 0) ||
            termLine.getBgClutIndex(i, 0) !== BG_COLOR_INDEX) {
        lastNonEmpty = i;
      }
    }

    return termLine.getString(0, 0, lastNonEmpty+1);
  }
}
