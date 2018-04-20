/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as nodeunit from 'nodeunit';
import { freezeDeep } from '../main';

export function testFreezeDeep(test: nodeunit.Test): void {
  const testObject = {
    foo: "foo",
    aNumber: 123,
    barArray: ["barArrayItem"],
    zyzzObject: {
      zyzzObjectItem1: 1,
      zyzzObjectItem2: "zyzzObjectItem2",
      nested: {
        smeg: 21
      }
    }
  };

  freezeDeep(testObject);

  test.ok(Object.isFrozen(testObject));
  test.ok(Object.isFrozen(testObject.barArray));
  test.ok(Object.isFrozen(testObject.zyzzObject.nested));
  test.done();
}
