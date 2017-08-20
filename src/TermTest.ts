/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as SourceMapSupport from 'source-map-support';
import * as nodeunit from 'nodeunit';
import {Emulator} from './Term';
const performanceNow = require('performance-now');

export function testBasic(test: nodeunit.Test): void {

  const emulator = new Emulator({performanceNowFunc: performanceNow});
  emulator.write('Hello');

  setTimeout(() => {
    test.equals(emulator.getLineText(0).trim(), 'Hello');
    test.done();
  }, 100);
}
