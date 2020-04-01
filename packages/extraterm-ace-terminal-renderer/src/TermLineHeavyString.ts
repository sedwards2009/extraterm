/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { HeavyString } from "@extraterm/ace-ts";
import * as TermApi from "term-api";
import { lastVisibleCellInLine } from "./LineFunctions";

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
    return termLine.getString(0,0, lastVisibleCellInLine(termLine) + 1);
  }
}
