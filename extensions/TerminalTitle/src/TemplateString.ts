/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const parser: {parse(source: string): Segment[]} = require("./template_string_parser");

export interface Segment {
  type: string;
}

export interface TextSegment extends Segment {
  type: "text";
  text: string;
}

export interface FieldSegment extends Segment {
  type: "field";
  namespace: string;
  key: string;
  html: string;
  error: string;
}

export interface ErrorSegment extends Segment {
  type: "error";
  text: string;
  message: string;
}

export class TemplateString {

  private _template: string = null;
  segments: Segment[] = null;

  constructor(template: string) {
    this._template = template;
    this.segments = this._parse(template);
  }

  private _parse(template: string): Segment[] {
    const result = parser.parse(template);
    console.log(result);
    return result;
  }
}
