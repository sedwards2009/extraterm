/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { HeavyString } from "ace-ts";
import * as TermApi from "term-api";

export interface TermLineHeavyString extends HeavyString {
  termLine: TermApi.Line
}
