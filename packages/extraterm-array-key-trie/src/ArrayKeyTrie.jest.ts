/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { ArrayKeyTrie } from "./ArrayKeyTrie";


const TEST_ITEMS: Array<[Array<number>, string]> = [
  [[1], "first"],
  [[2, 3], "key with two elements"],
  [[1, 4], "key with overlapping elements"],
  [[1, 4, 5, 6, 7, 8], "long key"],
];

function testData(): ArrayKeyTrie<number, string> {
  const trie = new ArrayKeyTrie<number, string>();
  for (const kvPair of TEST_ITEMS) {
    trie.insert(kvPair[0], kvPair[1]);
  }
  return trie;
}

describe.each([...TEST_ITEMS, [[575], null]])("Insert/get cases", (key: number[], value: string) => {
  test(`insert/get value ${value}`, done => {
    const data = testData();
    expect(data.get(key)).toBe(value);
    done();
  });
});
