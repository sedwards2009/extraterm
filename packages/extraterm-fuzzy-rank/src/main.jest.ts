/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { MatchRange, rankList } from "./main";

interface ExpectedResult {
  text: string;
  matchRanges?: MatchRange[];
}

const TEST_ITEMS: Array<[string, Array<string>, ExpectedResult]> = [
  // Exact match
  ["raspberry", ["strawberry", "raspberry", "dingleberry"], { text: "raspberry"}],

  // Case insensitive exact match
  ["Raspberry", ["Strawberry", "RaspBerry", "Dingleberry"],
    { text: "RaspBerry", matchRanges: [ { start: 0, stop: 9 } ] }],

  // Substring index match
  ["berry", ["strawberry", "raspberry", "dingleberry"], { text: "raspberry" }],

  // Case insensitive substring index match
  ["Berry", ["strawberry", "raspberry", "dingleberry"], { text: "raspberry" }],

  // Substring index match with multiple candidates
  ["ra", ["strawberry", "raspberry", "dingleberry"], { text: "raspberry" }],

  ["berry", ["A strawberry", "eat a berry", "random stuff"],
    { text: "eat a berry", matchRanges: [ { start: 6, stop: 11 }] }],

  ["Berry", ["A strawberry", "Pick and eat a berry", "random stuff"], { text: "Pick and eat a berry" }],

];

describe.each(TEST_ITEMS)("Match cases", (searchText: string, candidates: string[], expectedResult: ExpectedResult) => {
  test(`Search ${searchText} gives top result "${expectedResult.text}"`, done => {
    const result = rankList(searchText, candidates);
    expect(result[0].text).toBe(expectedResult.text);
    if (expectedResult.matchRanges != null) {
      expect(expectedResult.matchRanges.length).toBe(result[0].matchRanges.length);
      for (let i=0; i<expectedResult.matchRanges.length; i++) {
        expect(result[0].matchRanges[i].start).toBe(expectedResult.matchRanges[i].start);
        expect(result[0].matchRanges[i].stop).toBe(expectedResult.matchRanges[i].stop);
      }
    }
    done();
  });
});
