/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import "jest";
import { ratioToFraction } from "./RatioToFraction";

const testCases: [number, number, number][] = [
  [1.5, 3, 2],
  [1.3, 13, 10],
  [2, 2, 1],
  [1.29888, 13, 10],
];

describe.each(testCases)("Evaluate", (ratio: number, numerator: number, denominator: number) => {
  test(`${ratio} => ${numerator} / ${denominator}`, done => {

    const result = ratioToFraction(ratio);
    expect(result[0]).toBe(numerator);
    expect(result[1]).toBe(denominator);

    done();
  });
});
