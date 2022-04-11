/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { ArrayKeyTrie } from "./ArrayKeyTrie.js";


const TEST_ITEMS: Array<[Array<number>, string]> = [
  [[1], "first"],
  [[2, 3], "key with two elements"],
  [[1, 4], "key with overlapping elements"],
  [[1, 4, 5, 6, 7, 8], "long key"],
];

function testData(): ArrayKeyTrie<string> {
  const trie = new ArrayKeyTrie<string>();
  for (const kvPair of TEST_ITEMS) {
    trie.set(kvPair[0], kvPair[1]);
  }
  return trie;
}

describe.each(TEST_ITEMS)("Insert/get cases", (key: number[], value: string) => {
  test(`insert/get value ${value}`, done => {
    const data = testData();
    expect(data.get(key)).toBe(value);
    done();
  });
});

test(`prefix length 3`, done => {
  const data = testData();
  expect(data.getPrefix([1, 4, 5]).value).toBe(undefined);
  expect(data.getPrefix([1, 4, 5]).length).toBe(3);
  done();
});

test(`get() on missing key return undefined`, done => {
  const data = testData();
  expect(data.get([3])).toBe(undefined);
  expect(data.get([1, 3])).toBe(undefined);
  done();
});

test(`delete $(value)`, done => {
  const data = testData();
  expect(data.get([2, 3])).toBe("key with two elements");
  data.delete([2, 3]);
  expect(data.get([2, 3])).toBe(undefined);
  done();
});

test(`delete shouldn't kill close keys`, done => {
  const data = testData();
  expect(data.get([1, 4])).toBe("key with overlapping elements");
  expect(data.get([1, 4, 5, 6, 7, 8])).toBe("long key");

  data.delete([1, 4]);
  expect(data.get([1, 4])).toBe(undefined);
  expect(data.get([1, 4, 5, 6, 7, 8])).toBe("long key");

  done();
});

test(`delete shouldn't kill close keys. 2.`, done => {
  const data = testData();
  expect(data.get([1, 4])).toBe("key with overlapping elements");
  expect(data.get([1, 4, 5, 6, 7, 8])).toBe("long key");

  data.delete([1, 4, 5, 6, 7, 8]);
  expect(data.get([1, 4])).toBe("key with overlapping elements");
  expect(data.get([1, 4, 5, 6, 7, 8])).toBe(undefined);

  done();
});

test(`values()`, done => {
  const data = testData();
  const valuesSet = new Set(data.values());

  expect(valuesSet.has("first")).toBe(true);
  expect(valuesSet.has("key with two elements")).toBe(true);
  expect(valuesSet.has("key with overlapping elements")).toBe(true);
  expect(valuesSet.has("long key")).toBe(true);
  done();
});
