"use strict";
/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var PlatformTerminal;
if (process.platform === 'win32') {
    PlatformTerminal = require('./windowsTerminal');
}
else {
    PlatformTerminal = require('./unixTerminal');
}
describe('Terminal', function () {
    describe('constructor', function () {
        it('should do basic type checks', function () {
            assert.throws(function () { return new PlatformTerminal('a', 'b', { 'name': {} }); }, 'name must be a string (not a object)');
        });
    });
});
//# sourceMappingURL=terminal.test.js.map