/*
 * Copyright 2018 Nick Shanny <nshanny@shannymusings.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodeunit from 'nodeunit';
import { ShellStringParser } from '../main';


function arrayEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i=0; i<a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}


export function testShellStringParser(test: nodeunit.Test): void {

  test.ok(arrayEqual(ShellStringParser(""), []));
  test.ok(arrayEqual(ShellStringParser("One"), ["One"]));
  test.ok(arrayEqual(ShellStringParser("One\'"), ["One\'"]));
  test.ok(arrayEqual(ShellStringParser("One Two"), ["One", "Two"]));
  test.ok(arrayEqual(ShellStringParser("One Two 'Three Four'"), ["One", "Two", "Three Four"]));
  test.ok(arrayEqual(ShellStringParser("One Two \"Three Four\""), ["One", "Two", "Three Four"]));
  test.ok(arrayEqual(ShellStringParser("/C 'c:\foo\bar\nick.txt'"), ["/C", "c:\foo\bar\nick.txt"]));
  test.ok(arrayEqual(ShellStringParser("/C \"c:\foo\bar\nick.txt\""), ["/C", "c:\foo\bar\nick.txt"]));
  test.ok(arrayEqual(ShellStringParser("/C \"c:\foo\bar\nick.txt"), ["/C", "\"c:\foo\bar\nick.txt"]));

  test.done();
}
