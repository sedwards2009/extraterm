/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import {Emulator} from './Term';
const performanceNow = require('performance-now');

function waitOnEmulator(emulator: Emulator): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

export async function testBasic(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({performanceNowFunc: performanceNow});
  emulator.write('Hello');

  await waitOnEmulator(emulator);

  test.equals(emulator.getLineText(0).trim(), 'Hello');
  test.done();
}

export async function testWrap(test: nodeunit.Test): Promise<void> {
  const emulator = new Emulator({rows: 10, columns: 20, performanceNowFunc: performanceNow});
  emulator.write('abcdefghijklmnopqrstuvwxyz');

  await waitOnEmulator(emulator);

  test.equals(emulator.getLineText(0).trim(), 'abcdefghijklmnopqrst');
  test.equals(emulator.getLineText(1).trim(), 'uvwxyz');
  test.done();
}
