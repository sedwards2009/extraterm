/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
const { performance } = require('perf_hooks');

import { ArrayKeyTrie } from "./ArrayKeyTrie";
import { TripleKeyMap } from "./TripleKeyMap";

const NUMBER_OF_KEYS = 20480;
const NUMBER_OF_LOOPS = 200;

const log = console.log.bind(console);


function random32bit(): number {
  return Math.random() * 0xffffffff;
}

function generateData(): number[][] {
  const data: number[][] = [];
  for (let i=0; i<NUMBER_OF_KEYS; i++) {
    data.push([random32bit(), random32bit(), random32bit()]);
  }
  return data;
}

function timeIt(name: string, func: Function): void {
  const start = performance.now();
  for (let i=0; i<NUMBER_OF_LOOPS; i++) {
    func();
  }
  const end = performance.now();
  const duration = (end - start) / NUMBER_OF_LOOPS;
  log(`'${name}' took ${duration}ms per loop`);
}

test(`Speed test`, done => {
  const trie = new ArrayKeyTrie<number>();

  const data = generateData();
  const tripleMap = new TripleKeyMap<number, number, number, number>();
  for (const key of data) {
    trie.set(key, key[0]);
    tripleMap.set(key[0], key[1], key[2], key[0]);
  }

  timeIt("ArrayKeyTrie", () => {
    let total = 0;
    for (const key of data) {
      const value = trie.get(key);
      total += value;
    }
    // log(total);
  });

  timeIt("TripleNumberKeyMap", () => {
    let total = 0;
    for (const key of data) {
      const value = tripleMap.get(key[0], key[1], key[2]);
      total += value;
    }
    // log(total);
  });
  done();
});
