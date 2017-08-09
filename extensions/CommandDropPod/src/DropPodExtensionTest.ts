/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

//import * as SourceMapSupport from 'source-map-support';
import * as path from 'path';
import * as nodeunit from 'nodeunit';
import * as DropPodExtension from './DropPodExtension';

//SourceMapSupport.install();

export function testContext(test: nodeunit.Test): void {
  
  const flattener = new DropPodExtension.PythonFileFlattener(path.join(__dirname, 'test_data'));
  const result = flattener.readAndInlineCommand('command');

  test.ok(result.length !== 0, 'Test for anything');
  
  const lines = result.split('\n');
  test.equal(lines.filter(line => line.indexOf('import os') !== -1).length, 1);
  test.equal(lines.filter(line => line.indexOf('from library import *') !== -1).length, 0);
  test.equal(lines.filter(line => line.indexOf('Library run') !== -1).length, 1);
  test.equal(lines.filter(line => line.indexOf('Main run') !== -1).length, 1);

  test.done();
}
