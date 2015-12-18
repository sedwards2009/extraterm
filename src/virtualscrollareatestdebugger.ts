/**
 * Copyright 2015 Simon Edwards <simon@simonzone.com>
 */
 
// This is a small test harness to get the unit tests into iron-node for debugging.

import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import tests = require('./virtualscrollareatest');

sourceMapSupport.install();

const nodeunitTest: nodeunit.Test = {
		done(err?: any): void { },
		expect(num: number): void {},
		fail(actual: any, expected: any, message: string, operator: string): void { },
		assert(value: any, message: string): void { },
		ok(value: any, message?: string): void { },
		equal(actual: any, expected: any, message?: string): void { },
		notEqual(actual: any, expected: any, message?: string): void { },
		deepEqual(actual: any, expected: any, message?: string): void { },
		notDeepEqual(actual: any, expected: any, message?: string): void { },
		strictEqual(actual: any, expected: any, message?: string): void { },
		notStrictEqual(actual: any, expected: any, message?: string): void { },
		throws(block: any, error?: any, message?: string): void { },
		doesNotThrow(block: any, error?: any, message?: string): void { },
		ifError(value: any): void { },
		equals(actual: any, expected: any, message?: string): void { },
		same(actual: any, expected: any, message?: string): void { }
};
debugger;
tests.test3Scrollables(nodeunitTest);
