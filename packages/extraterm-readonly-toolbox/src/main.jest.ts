/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { freezeDeep } from './main';

test("", () => {
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

  expect(Object.isFrozen(testObject)).toBe(true);
  expect(Object.isFrozen(testObject.barArray)).toBe(true);
  expect(Object.isFrozen(testObject.zyzzObject.nested)).toBe(true);
});

