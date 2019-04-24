/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";

import { Segment, TemplateString, TextSegment, FieldSegment } from "../TemplateString";


describe.each([
    ["foo", [{ type: "text", text: "foo", startColumn: 0, endColumn: 3 }]],
    ["foo:bar", [{ type: "text", text: "foo:bar", startColumn: 0, endColumn: 7 }]],
    ["foo\\$bar", [{ type: "text", text: "foo$bar", startColumn: 0, endColumn: 8 }]],
    ["$foo: ", [{ type: "text", text: "$foo: " }]],

    ["foo${TERM:TITLE}", [
      { type: "text", text: "foo", startColumn: 0, endColumn: 3 },
      { type: "field", namespace: "TERM", key: "TITLE", startColumn: 3, endColumn: 16 }
    ]],

    ["foo ${TERM:TITLE} bar", [
      { type: "text", text: "foo " },
      { type: "field", namespace: "TERM", key: "TITLE", startColumn: 4, endColumn: 17},
      { type: "text", text: " bar" },
    ]],

    ["${TERM:TITLE}", [
      { type: "field", namespace: "TERM", key: "TITLE"}
    ]],

    ["${TERM:ROWS}x${TERM:COLUMNS}", [
      { type: "field", namespace: "TERM", key: "ROWS"},
      { type: "text", text: "x" },
      { type: "field", namespace: "TERM", key: "COLUMNS"},
    ]],

    ["${awe:fa far linux} ${TERM:TITLE}", [
      { type: "field", namespace: "awe", key: "fa far linux"},
      { type: "text", text: " " },
      { type: "field", namespace: "TERM", key: "TITLE"},
    ]],

    ["foo ${TERMTITLE} bar", [
      { type: "text", text: "foo " },
      { type: "error", text: "TERMTITLE"},
      { type: "text", text: " bar" },
    ]],

    ["foo ${TERM:} bar", [
      { type: "text", text: "foo " },
      { type: "error", text: "TERM:"},
      { type: "text", text: " bar" },
    ]],

    ["foo ${TER", [
      { type: "text", text: "foo " },
      { type: "error", text: "TER"},
    ]],

  ])("Test", (input: string, output: Segment[]) => {

  test(`parse ${input}`, () => {
    const ts = new TemplateString();
    ts.setTemplateString(input);
    expect(ts._segments.length).toBe(output.length);

    for (let i=0; i<ts._segments.length; i++) {
      const seg = ts._segments[i];
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
