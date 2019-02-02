/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import "jest";
import { BooleanExpressionEvaluator } from "../main";

describe.each([
  ["Atrue", true],
  ["Bfalse", false],
  ["Atrue && Btrue", true],
  ["Atrue && Bfalse", false],
  ["Atrue || Btrue", true],
  ["Atrue || Bfalse", true],
  ["Afalse || Bfalse", false],
  ["!Atrue", false],
  ["(Atrue)", true],
  ["!(Atrue)", false],
  ["Atrue || Bfalse && Ctrue", true],
  ["Afalse || Bfalse && Ctrue", false],
  ["(Atrue || Bfalse) && Ctrue", true],
  ["Atrue && ! Bfalse", true],
  ["! Bfalse || Ctrue", true],
])("Evaluate", (input: string, output: boolean) => {

  test(`${input} => ${output}`, () => {
    const bee = new BooleanExpressionEvaluator({
            Atrue: true, Afalse: false,
            Btrue: true, Bfalse: false,
            Ctrue: true, Cfalse: false
          });
    const result = bee.evaluate(input);
    expect(result).toBe(output);
  });
});
