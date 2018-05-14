"use strict";
/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var assert = require("assert");
var windowsTerminal_1 = require("./windowsTerminal");
if (process.platform === 'win32') {
    describe('WindowsTerminal', function () {
        describe('kill', function () {
            it('should not crash parent process', function (done) {
                var term = new windowsTerminal_1.WindowsTerminal('cmd.exe', [], {});
                term.kill();
                // Add done call to deferred function queue to ensure the kill call has completed
                term._defer(done);
            });
        });
        describe('resize', function () {
            it('should throw a non-native exception when resizing an invalid value', function () {
                var term = new windowsTerminal_1.WindowsTerminal('cmd.exe', [], {});
                assert.throws(function () { return term.resize(-1, -1); });
                assert.throws(function () { return term.resize(0, 0); });
                assert.doesNotThrow(function () { return term.resize(1, 1); });
            });
            it('should throw an non-native exception when resizing a killed terminal', function (done) {
                var term = new windowsTerminal_1.WindowsTerminal('cmd.exe', [], {});
                term._defer(function () {
                    term.destroy();
                    assert.throws(function () { return term.resize(1, 1); });
                    done();
                });
            });
        });
        describe('Args as CommandLine', function () {
            it('should not fail running a shell containing a space in the path', function (done) {
                var gitBashDefaultPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
                if (!fs.existsSync(gitBashDefaultPath)) {
                    // Skip test if git bash isn't installed
                    return;
                }
                var term = new windowsTerminal_1.WindowsTerminal(gitBashDefaultPath, '-c "echo helloworld"', {});
                var result = '';
                term.on('data', function (data) {
                    result += data;
                });
                term.on('exit', function () {
                    assert.ok(result.indexOf('helloworld') >= 0);
                    done();
                });
            });
        });
        describe('On close', function () {
            it('should return process zero exit codes', function (done) {
                var term = new windowsTerminal_1.WindowsTerminal('cmd.exe', '/C exit');
                term.on('exit', function (code) {
                    assert.equal(code, 0);
                    done();
                });
            });
            it('should return process non-zero exit codes', function (done) {
                var term = new windowsTerminal_1.WindowsTerminal('cmd.exe', '/C exit 2');
                term.on('exit', function (code) {
                    assert.equal(code, 2);
                    done();
                });
            });
        });
    });
}
//# sourceMappingURL=windowsTerminal.test.js.map