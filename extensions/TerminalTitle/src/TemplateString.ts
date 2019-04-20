/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const parser: {parse(source: string): Segment[]} = require("./template_string_parser");
import he = require("he");


export interface TextSegment {
  type: "text";
  text: string;
}

export interface FieldSegment {
  type: "field";
  namespace: string;
  key: string;
}

export interface ErrorSegment {
  type: "error";
  text: string;
  error: string;
}

export type Segment = TextSegment | FieldSegment | ErrorSegment;

export interface FieldFormatter {
  formatHtml(key: string): string;
  getErrorMessage(key: string): string;
}

export class TemplateString {

  private _template: string = null;
  _segments: Segment[] = null;

  private _formatterMap = new Map<string, FieldFormatter>();

  getTemplateString(): string {
    return this._template;
  }
  
  setTemplateString(template: string): void {
    this._template = template;
    this._segments = this._parse(template);
  }

  addFormatter(namespace: string, formatter: FieldFormatter): void {
    this._formatterMap.set(namespace.toLowerCase(), formatter);
  }

  private _parse(template: string): Segment[] {
    const result = parser.parse(template);
    return result;
  }

  formatHtml(): string {
    return this._segments.map(segment => {
      switch (segment.type) {
        case "text":
          return he.encode(segment.text);
        case "field":
          const namespace = segment.namespace.toLowerCase();
          const formatter = this._formatterMap.get(namespace);
          if (formatter == null) {
            return "";
          }
          return formatter.formatHtml(segment.key);
        case "error":
          return "";
      }      
    }).join("");
  }

  formatDiagnosticHtml(): string {
    return this._segments.map(segment => {
      switch (segment.type) {
        case "text":
          return `<span class="segment_text">${he.encode(segment.text)}</span>`;

        case "field":
          const namespace = segment.namespace.toLowerCase();
          const formatter = this._formatterMap.get(namespace);
          if (formatter == null) {
            return `<span class="segment_error">Unknown '${segment.namespace}'</span>`;
          }
          const errorMsg = formatter.getErrorMessage(segment.key);
          if (errorMsg == null) {
            return `<span class="segment_field">${formatter.formatHtml(segment.key)}</span>`;
          } else {
            return `<span class="segment_error">${errorMsg}</span>`;
          }

        case "error":
          return `<span class="segment_error">Unknown '${segment.text}'</span>`;
      }      
    }).join("");
  }
}
