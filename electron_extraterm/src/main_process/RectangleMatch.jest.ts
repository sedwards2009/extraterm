/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import 'jest';
import { Rectangle, rectangleIntersection, bestOverlap } from './RectangleMatch';

const rectA = { x: 0, y: 0, width: 20, height: 10 };
const rectB = { x: 5, y: 2, width: 10, height: 6 };
const rectC = { x: 10, y: 5, width: 30, height: 40 };
const rectD = { x: 10, y: 5, width: 10, height: 5 };
const rectE = { x: -10, y: -5, width: 20, height: 10 };
const rectF = { x: 0, y: 0, width: 10, height: 5 };
const rectG = { x: 5, y: 5, width: 25, height: 20 };
const rectH = { x: -5, y: 5, width: 10, height: 25 };

describe.each([
  [rectA, rectA, rectA],
  [rectA, rectB, rectB],
  [rectB, rectA, rectB],
  [rectA, rectC, rectD],
  [rectC, rectA, rectD],
  [rectC, rectD, rectD],
  [rectA, rectE, rectF],
])("Rectangle intersection", (rect1: Rectangle, rect2: Rectangle, resultRect: Rectangle) => {
  test("Rectangle intersection", () => {

    const result = rectangleIntersection(rect1, rect2);

    expect(result.x).toBe(resultRect.x);
    expect(result.y).toBe(resultRect.y);
    expect(result.width).toBe(resultRect.width);
    expect(result.height).toBe(resultRect.height);
  });
});

describe.each([
  [rectA, [rectG], 0],
  [rectA, [rectG, rectH], 0],
  [rectA, [rectH, rectG], 1],
  [rectH, [rectA, rectG], 0],
  [rectH, [rectG], -1],
])("bestOverlap", (primaryRect: Rectangle, candidates: Rectangle[], result: number) => {
  test("Overlap", () => {
    expect(bestOverlap(primaryRect, candidates)).toBe(result);
  });
});
