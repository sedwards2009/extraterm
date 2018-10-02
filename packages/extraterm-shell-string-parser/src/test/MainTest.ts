/*
 * Copyright 2018 Nick Shanny <nshanny@shannymusings.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodeunit from 'nodeunit';
import { ShellStringParser } from '../main';

// arrayCompare :: (a -> a -> Bool) -> [a] -> [a] -> Bool
const arrayCompare = f => ([x,...xs]) => ([y,...ys]) =>
  x === undefined && y === undefined
    ? true
    : Boolean (f (x) (y)) && arrayCompare (f) (xs) (ys)

// equal :: a -> a -> Bool
const equal = x => y =>
  x === y // notice: triple equal

// arrayEqual :: [a] -> [a] -> Bool
const arrayEqual =
  arrayCompare (equal)

export function testShellStringParser(test: nodeunit.Test): void {

  test.ok(arrayEqual (ShellStringParser("One"))  (["One"]));
  test.ok(arrayEqual (ShellStringParser("One Two"))  (["One", "Two"]));
  test.ok(arrayEqual (ShellStringParser("One Two 'Three Four'"))  (["One", "Two", "Three Four"]));
  test.ok(arrayEqual (ShellStringParser("One Two \"Three Four\""))  (["One", "Two", "Three Four"]));
  test.ok(arrayEqual (ShellStringParser("/C 'c:\foo\bar\nick.txt'"))  (["/C", "c:\foo\bar\nick.txt"]));
  test.ok(arrayEqual (ShellStringParser("/C \"c:\foo\bar\nick.txt\""))  (["/C", "c:\foo\bar\nick.txt"]));
  test.ok(arrayEqual (ShellStringParser("/C \"c:\foo\bar\nick.txt"))  (["/C", "\"c:\foo\bar\nick.txt"]));

  test.done();
}
