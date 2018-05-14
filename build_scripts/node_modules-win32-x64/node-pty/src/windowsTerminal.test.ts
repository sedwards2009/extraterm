/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 */

 import * as fs from 'fs';
import * as assert from 'assert';
import { WindowsTerminal } from './windowsTerminal';

if (process.platform === 'win32') {
  describe('WindowsTerminal', () => {
    describe('kill', () => {
      it('should not crash parent process', (done) => {
        const term = new WindowsTerminal('cmd.exe', [], {});
        term.kill();
        // Add done call to deferred function queue to ensure the kill call has completed
        (<any>term)._defer(done);
      });
    });

    describe('resize', () => {
      it('should throw a non-native exception when resizing an invalid value', () => {
        const term = new WindowsTerminal('cmd.exe', [], {});
        assert.throws(() => term.resize(-1, -1));
        assert.throws(() => term.resize(0, 0));
        assert.doesNotThrow(() => term.resize(1, 1));
      });
      it('should throw an non-native exception when resizing a killed terminal', (done) => {
        const term = new WindowsTerminal('cmd.exe', [], {});
        (<any>term)._defer(() => {
          term.destroy();
          assert.throws(() => term.resize(1, 1));
          done();
        });
      });
    });

    describe('Args as CommandLine', () => {
      it('should not fail running a shell containing a space in the path', (done) => {
        const gitBashDefaultPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
        if (!fs.existsSync(gitBashDefaultPath)) {
          // Skip test if git bash isn't installed
          return;
        }
        const term = new WindowsTerminal(gitBashDefaultPath, '-c "echo helloworld"', {});
        let result = '';
        term.on('data', (data) => {
          result += data;
        });
        term.on('exit', () => {
          assert.ok(result.indexOf('helloworld') >= 0);
          done();
        });
      });
    });

    describe('On close', () => {
      it('should return process zero exit codes', (done) => {
        const term = new WindowsTerminal('cmd.exe', '/C exit');
        term.on('exit', (code) => {
          assert.equal(code, 0);
          done();
        });
      });

      it('should return process non-zero exit codes', (done) => {
        const term = new WindowsTerminal('cmd.exe', '/C exit 2');
        term.on('exit', (code) => {
          assert.equal(code, 2);
          done();
        });
      });
    });
  });
}
