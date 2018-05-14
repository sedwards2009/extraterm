/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 */

import * as assert from 'assert';
import { WindowsTerminal } from './windowsTerminal';
import { UnixTerminal } from './unixTerminal';

let PlatformTerminal: WindowsTerminal | UnixTerminal;
if (process.platform === 'win32') {
  PlatformTerminal = require('./windowsTerminal');
} else {
  PlatformTerminal = require('./unixTerminal');
}

describe('Terminal', () => {
  describe('constructor', () => {
    it('should do basic type checks', () => {
      assert.throws(
        () => new (<any>PlatformTerminal)('a', 'b', { 'name': {} }),
        'name must be a string (not a object)'
      );
    });
  });
});
