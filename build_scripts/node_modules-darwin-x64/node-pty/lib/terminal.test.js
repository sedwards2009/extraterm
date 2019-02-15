"use strict";
/**
 * Copyright (c) 2017, Daniel Imms (MIT License).
 * Copyright (c) 2018, Microsoft Corporation (MIT License).
 */
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var terminalCtor;
if (process.platform === 'win32') {
    terminalCtor = require('./windowsTerminal');
}
else {
    terminalCtor = require('./unixTerminal');
}
describe('Terminal', function () {
    describe('constructor', function () {
        it('should do basic type checks', function () {
            assert.throws(function () { return new terminalCtor('a', 'b', { 'name': {} }); }, 'name must be a string (not a object)');
        });
    });
});
//# sourceMappingURL=terminal.test.js.map