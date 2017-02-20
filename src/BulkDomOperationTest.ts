/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import sourceMapSupport = require('source-map-support');
import nodeunit = require('nodeunit');
import * as BulkDomOperation from './BulkDomOperation';

sourceMapSupport.install();

export function testOne(test: nodeunit.Test): void {
  let wasCalled = false;
  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    wasCalled = true;
    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(BulkDomOperation.fromGenerator(generator.bind(this)()));

  test.equal(wasCalled, true);
  test.done();
}

export function testTwo(test: nodeunit.Test): void {
  let wasCalled = false;
  let wasCalled2 = false;

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    wasCalled = true;
    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const generator2 = function* generator2(): IterableIterator<BulkDomOperation.GeneratorResult> {
    wasCalled2 = true;
    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(
    BulkDomOperation.parallel( [ BulkDomOperation.fromGenerator(generator.bind(this)()),
                                  BulkDomOperation.fromGenerator(generator2.bind(this)())
                                ]));

  test.equal(wasCalled, true);
  test.equal(wasCalled2, true);
  test.done();
}

export function testOneSequence(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(BulkDomOperation.fromGenerator(generator.bind(this)()));

  test.equal(log, "RWRF");
  test.done();
}

export function testTwoSequence(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(
    BulkDomOperation.parallel( [ BulkDomOperation.fromGenerator(generator.bind(this)()),
                                  BulkDomOperation.fromGenerator(generator.bind(this)())
                                ]));

  test.equal(log, "RRWWRRFF");
  test.done();
}

export function testOrdered(test: nodeunit.Test): void {
  let log = "";

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const generator2 = function* generator2(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(
    BulkDomOperation.parallel( [ BulkDomOperation.fromGenerator(generator.bind(this)()),
                                  BulkDomOperation.fromGenerator(generator2.bind(this)())
                                ]));

  test.equal(log, "RWFF");
  test.done();
}

export function testExtraOp(test: nodeunit.Test): void {
  let log = "";

  const childGenerator = function* childGenerator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield { phase: BulkDomOperation.GeneratorPhase.BEGIN_FINISH, extraOperation: BulkDomOperation.fromGenerator(childGenerator.bind(this)()) };
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(BulkDomOperation.fromGenerator(generator.bind(this)()));

  test.equal(log, "WRFF");
  test.done();
}

export function testExtraOp2(test: nodeunit.Test): void {
  let log = "";

  const childGenerator = function* childGenerator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W";

    yield { phase: BulkDomOperation.GeneratorPhase.BEGIN_FINISH, extraOperation: BulkDomOperation.fromGenerator(childGenerator.bind(this)()) };
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  BulkDomOperation.execute(
    BulkDomOperation.parallel( [ BulkDomOperation.fromGenerator(generator.bind(this)()),
                                  BulkDomOperation.fromGenerator(generator.bind(this)()),
                                  BulkDomOperation.fromGenerator(generator.bind(this)())
                                ]));

  test.equal(log, "WWWRRRFFFFFF");
  test.done();
}

export function testWait(test: nodeunit.Test): void {
  let log = "";

  const generator2 = function* generator2(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE;
    log += "W2";

    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R2";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const generator = function* generator(): IterableIterator<BulkDomOperation.GeneratorResult> {
    yield BulkDomOperation.GeneratorPhase.BEGIN_DOM_READ;
    log += "R";

    const extraOp = BulkDomOperation.fromGenerator(generator2.bind(this)());
    yield { phase: BulkDomOperation.GeneratorPhase.BEGIN_DOM_WRITE, extraOperation: extraOp, waitOperation: extraOp };
    log += "W1";

    yield BulkDomOperation.GeneratorPhase.BEGIN_FINISH;
    log += "F";

    return BulkDomOperation.GeneratorPhase.DONE;
  };

  const contextFunc = function(func) {
    log += "C";
    func();
  };

  BulkDomOperation.execute(BulkDomOperation.fromGenerator(generator.bind(this)()), contextFunc);

  test.equal(log, "RCW2R2CW1FF");
  test.done();
}

