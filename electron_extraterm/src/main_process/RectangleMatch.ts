/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rectangleIntersection(rect1: Rectangle, rect2: Rectangle): Rectangle {
  const rect1x2 = rect1.x + rect1.width;
  const rect1y2 = rect1.y + rect1.height;
  const rect2x2 = rect2.x + rect2.width;
  const rect2y2 = rect2.y + rect2.height;

  const intersectionX1 = Math.max(rect1.x, rect2.x);
  const intersectionY1 = Math.max(rect1.y, rect2.y);

  const intersectionX2 = Math.min(rect1x2, rect2x2);
  const intersectionY2 = Math.min(rect1y2, rect2y2);

  const result: Rectangle = {
    x: intersectionX1,
    y: intersectionY1,
    width: Math.max(0, intersectionX2 - intersectionX1),
    height: Math.max(0, intersectionY2 - intersectionY1),
  };

  return result;
}

export function bestOverlap(primaryRect: Rectangle, candidateRects: Rectangle[]): number {
  let bestArea = -1;
  let bestRectIndex = -1;
  
  let i = 0;
  for (const rect of candidateRects) {
    const intersectionRect = rectangleIntersection(primaryRect, rect);
    const area = intersectionRect.width * intersectionRect.height;
    if (area !== 0 && area > bestArea) {
      bestRectIndex = i;
      bestArea = area;
    }
    i++;
  }
  return bestRectIndex;
}
