/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 */

 import * as assert from 'assert';
import { argsToCommandLine } from './windowsPtyAgent';

function check(file: string, args: string | string[], expected: string): void {
  assert.equal(argsToCommandLine(file, args), expected);
}

if (process.platform === 'win32') {
  describe('argsToCommandLine', () => {
    describe('Plain strings', () => {
      it('doesn\'t quote plain string', () => {
        check('asdf', [], 'asdf');
      });
      it('doesn\'t escape backslashes', () => {
        check('\\asdf\\qwer\\', [], '\\asdf\\qwer\\');
      });
      it('doesn\'t escape multiple backslashes', () => {
        check('asdf\\\\qwer', [], 'asdf\\\\qwer');
      });
      it('adds backslashes before quotes', () => {
        check('"asdf"qwer"', [], '\\"asdf\\"qwer\\"');
      });
      it('escapes backslashes before quotes', () => {
        check('asdf\\"qwer', [], 'asdf\\\\\\"qwer');
      });
    });

    describe('Quoted strings', () => {
      it('quotes string with spaces', () => {
        check('asdf qwer', [], '"asdf qwer"');
      });
      it('quotes empty string', () => {
        check('', [], '""');
      });
      it('quotes string with tabs', () => {
        check('asdf\tqwer', [], '"asdf\tqwer"');
      });
      it('escapes only the last backslash', () => {
        check('\\asdf \\qwer\\', [], '"\\asdf \\qwer\\\\"');
      });
      it('doesn\'t escape multiple backslashes', () => {
        check('asdf \\\\qwer', [], '"asdf \\\\qwer"');
      });
      it('adds backslashes before quotes', () => {
        check('"asdf "qwer"', [], '"\\"asdf \\"qwer\\""');
      });
      it('escapes backslashes before quotes', () => {
        check('asdf \\"qwer', [], '"asdf \\\\\\"qwer"');
      });
      it('escapes multiple backslashes at the end', () => {
        check('asdf qwer\\\\', [], '"asdf qwer\\\\\\\\"');
      });
    });

    describe('Multiple arguments', () => {
      it('joins arguments with spaces', () => {
        check('asdf', ['qwer zxcv', '', '"'], 'asdf "qwer zxcv" "" \\"');
      });
    });

    describe('Args as CommandLine', () => {
      it('should handle empty string', () => {
        check('file', '', 'file');
      });
      it('should not change args', () => {
        check('file', 'foo bar baz', 'file foo bar baz');
        check('file', 'foo \\ba"r \baz', 'file foo \\ba"r \baz');
      });
    });
  });
}
