/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";
import * as path from 'path';
import {PythonFileFlattener} from '../ScriptBuilders';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


test("", () => {
  const flattener = new PythonFileFlattener(path.join(__dirname, "..", "..", "src", "test", "test_data"));
  const result = flattener.readAndInlineCommand('command');

  expect(result.length).not.toBe(0);

  const lines = result.split('\n');
  expect(lines.filter(line => line.indexOf('import os') !== -1).length).toBe(1);
  expect(lines.filter(line => line.indexOf('from library import *') !== -1).length).toBe(0);
  expect(lines.filter(line => line.indexOf('Library run') !== -1).length).toBe(1);
  expect(lines.filter(line => line.indexOf('Main run') !== -1).length).toBe(1);
});

