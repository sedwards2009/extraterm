/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";

import { Segment, TemplateString, TextSegment, FieldSegment } from "../TemplateString.js";


const args: [string, Segment[]][] = [
    ["foo", [{ type: "text", text: "foo", startColumn: 0, endColumn: 3 }]],
    ["foo:bar", [{ type: "text", text: "foo:bar", startColumn: 0, endColumn: 7 }]],
    ["foo\\$bar", [{ type: "text", text: "foo$bar", startColumn: 0, endColumn: 8 }]],
    ["$foo: ", [{ type: "text", text: "$foo: ", startColumn: 0, endColumn: 6 }]],

    ["foo${TERM:TITLE}", [
      { type: "text", text: "foo", startColumn: 0, endColumn: 3 },
      { type: "field", namespace: "TERM", key: "TITLE", startColumn: 3, endColumn: 16, text: "", error: "" }
    ]],

    ["foo ${TERM:TITLE} bar", [
      { type: "text", text: "foo ", startColumn: 0, endColumn: 4 },
      { type: "field", namespace: "TERM", key: "TITLE", startColumn: 4, endColumn: 17, text: "", error: "" },
      { type: "text", text: " bar", startColumn: 17, endColumn: 21 },
    ]],

    ["${TERM:TITLE}", [
      { type: "field", namespace: "TERM", key: "TITLE", text: "", error: "", startColumn: 0, endColumn: 13 }
    ]],

    ["${TERM:ROWS}x${TERM:COLUMNS}", [
      { type: "field", namespace: "TERM", key: "ROWS", text: "", error: "", startColumn: 0, endColumn: 12 },
      { type: "text", text: "x", startColumn: 12, endColumn: 13 },
      { type: "field", namespace: "TERM", key: "COLUMNS", text: "", error: "", startColumn: 13, endColumn: 28 },
    ]],

    ["${awe:fa far linux} ${TERM:TITLE}", [
      { type: "field", namespace: "awe", key: "fa far linux", text: "", error: "", startColumn: 0, endColumn: 19 },
      { type: "text", text: " ", startColumn: 19, endColumn: 20 },
      { type: "field", namespace: "TERM", key: "TITLE", text: "", error: "", startColumn: 20, endColumn: 33 },
    ]],

    ["foo ${TERMTITLE} bar", [
      { type: "text", text: "foo ", startColumn: 0, endColumn: 4 },
      { type: "error", text: "TERMTITLE", error: "", startColumn: 4, endColumn: 16 },
      { type: "text", text: " bar", startColumn: 16, endColumn: 20 },
    ]],

    ["foo ${TERM:} bar", [
      { type: "text", text: "foo ", startColumn: 0, endColumn: 4 },
      { type: "error", text: "TERM:", error: "", startColumn: 4, endColumn: 12 },
      { type: "text", text: " bar", startColumn: 12, endColumn: 16 },
    ]],

    ["foo ${TER", [
      { type: "text", text: "foo ", startColumn: 0, endColumn: 4 },
      { type: "error", text: "TER", error: "", startColumn: 4, endColumn: 9 },
    ]],
];

describe.each(args)("Test", (input: string, output: Segment[]) => {

  test(`parse ${input}`, () => {
    const ts = new TemplateString();
    ts.setTemplateString(input);
    expect(ts.getSegments().length).toBe(output.length);

    for (let i=0; i<ts.getSegments().length; i++) {
      const seg = ts.getSegments()[i];
      const outSeg = output[i];
      expect(seg.type).toBe(outSeg.type);

      if (outSeg.startColumn !== undefined) {
        expect(seg.startColumn).toBe(outSeg.startColumn);
      }
      if (outSeg.endColumn !== undefined) {
        expect(seg.endColumn).toBe(outSeg.endColumn);
      }
      if (seg.type === "text") {
        expect((<TextSegment> seg).text).toBe((<TextSegment> outSeg).text);

      } else if(seg.type === "field") {
        expect((<FieldSegment> seg).namespace).toBe((<FieldSegment> outSeg).namespace);
        expect((<FieldSegment> seg).key).toBe((<FieldSegment> outSeg).key);
      }
    }
  });
});
