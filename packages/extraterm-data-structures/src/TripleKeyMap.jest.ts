/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import "jest";
import { TripleKeyMap } from "./TripleKeyMap.js";


const TEST_ITEMS: Array<[Array<number>, string]> = [
  [[1, 4, 3], "1st value"],
  [[1, 0, 1], "101 value"],
  [[1, 0, 2], "102 value"],
  [[2, 4, 5], "2nd value"],
];

function testData(): TripleKeyMap<number, number, number, string> {
  const map3 = new TripleKeyMap<number, number, number, string>();
  for (const kvPair of TEST_ITEMS) {
    const key = kvPair[0];
    map3.set(key[0], key[1], key[2], kvPair[1]);
  }
  return map3;
}

describe.each(TEST_ITEMS)("Insert/get cases", (key: number[], value: string) => {
  test(`insert/get value ${value}`, done => {
    const data = testData();
    expect(data.get(key[0], key[1], key[2])).toBe(value);
    done();
  });
});

test(`get() on missing key return undefined`, done => {
  const data = testData();
  expect(data.get(0, 1, 3)).toBe(undefined);
  done();
});

test(`delete $(value)`, done => {
  const data = testData();
  expect(data.get(2, 4, 5)).toBe("2nd value");
  data.delete(2, 4, 5);
  expect(data.get(2, 4, 5)).toBe(undefined);
  done();
});

test(`values()`, done => {
  const data = testData();
  const valuesSet = new Set(data.values());

  expect(valuesSet.has("1st value")).toBe(true);
  expect(valuesSet.has("2nd value")).toBe(true);
  done();
});
