/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { LigatureMarker } from "./LigatureMarker";


const validLigatures = ["***", "-->", "<--", "=!=", "=>"];

describe.each([
  ["***", 3],
  ["=!=", 3],
  ["Z=!=", 0],
  ["-", 0],
  ["=", 0],
  ["=X", 0],
  ["--", 0],
  ["=>", 2],
  ["=>X", 2],
])("Ligature length",
  (input: string, output: number): void => {
    test(`${input} is ${output}`, done => {
      const marker = new LigatureMarker(validLigatures);
      expect(marker.getLigatureLength(input)).toBe(output);
      done();
    });
  });
