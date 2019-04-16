/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";

import { Segment, TemplateString, TextSegment, FieldSegment } from "../TemplateString";


describe.each([
    ["foo", [{ type: "text", text: "foo" }]],
    ["foo:bar", [{ type: "text", text: "foo:bar" }]],
    ["foo\\$bar", [{ type: "text", text: "foo$bar" }]],
    ["$foo: ", [{ type: "text", text: "$foo: " }]],

    ["foo${TERM:TITLE}", [
      { type: "text", text: "foo" },
      { type: "field", namespace: "TERM", key: "TITLE"}
    ]],

    ["foo ${TERM:TITLE} bar", [
      { type: "text", text: "foo " },
      { type: "field", namespace: "TERM", key: "TITLE"},
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

  ])("Test", (input: string, output: Segment[]) => {

  test(`parse ${input}`, () => {
    const ts = new TemplateString(input);
    expect(ts.segments.length).toBe(output.length);

    for (let i=0; i<ts.segments.length; i++) {
      const seg = ts.segments[i];
      const outSeg = output[i];
      expect(seg.type).toBe(outSeg.type);
      if (seg.type === "text") {
        expect((<TextSegment> seg).text).toBe((<TextSegment> outSeg).text);

      } else if(seg.type === "field") {
        expect((<FieldSegment> seg).namespace).toBe((<FieldSegment> outSeg).namespace);
        expect((<FieldSegment> seg).key).toBe((<FieldSegment> outSeg).key);
      }
    }
  });
});
