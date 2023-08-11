/*
 * Copyright 2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QPoint } from "@nodegui/nodegui";
import { CDockAreaWidget, CDockContainerWidget } from "nodegui-plugin-qads";

interface PanePosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
  dockArea: CDockAreaWidget;
  distanceSquared: number;
}

type Point2D = [number, number];
type Matrix2D = [number, number, number, number];

export enum Direction {
  LEFT,
  RIGHT,
  ABOVE,
  BELOW,
}

const DIRECTION_MATRICES: { [key: number]: Matrix2D } = {
  [Direction.LEFT]: [-1, 0, 0, 1],
  [Direction.RIGHT]: [1, 0, 0, 1],
  [Direction.ABOVE]: [0, 1, -1, 0],
  [Direction.BELOW]: [0, -1, 1, 0],
};

/**
 * Get the next neighbouring DockArea in a direction from the given dockArea.
 */
export function nextDockAreaInDirection(startDockArea: CDockAreaWidget, dockContainer: CDockContainerWidget,
    direction: Direction): CDockAreaWidget {

  const rawPositions = getPanePositions(dockContainer);

  // The code below only implements finding the next DockArea to the right of the startDockArea.
  // Every other direction is done by first transforming all of the positions and coordinates.
  const transformMatrix = DIRECTION_MATRICES[direction];
  const transformedPositions = rawPositions.map(pos => transformPosition(pos, transformMatrix));

  const startPosition = transformedPositions.filter(pos => pos.dockArea === startDockArea)[0];
  const otherPositions = transformedPositions.filter(pos => pos.dockArea !== startDockArea);

  const startCenterX = (startPosition.left + startPosition.right) / 2;
  const startCenterY = (startPosition.top + startPosition.bottom) / 2;

  const isRightOfStart = (pos: PanePosition): boolean => pos.left > startCenterX;
  const candidatePositions = otherPositions.filter(isRightOfStart);

  if (candidatePositions.length === 0) {
    return null;
  }

  computeSquaredDistance(startCenterX, startCenterY, candidatePositions);
  sortCandidatePositions(candidatePositions);

  return candidatePositions[0].dockArea;
}

function getPanePositions(container: CDockContainerWidget): PanePosition[] {
  const len = container.dockAreaCount();
  const result: PanePosition[] = [];
  for (let i=0; i<len; i++) {
    const dockArea = container.dockArea(i);
    const geo = dockArea.contentAreaGeometry();
    const topLeft = dockArea.mapTo(container, new QPoint(geo.left(), geo.top()));
    const bottomRight = dockArea.mapTo(container, new QPoint(geo.left() + geo.width(), geo.top() + geo.height()));
    result.push(
      {
        top: topLeft.y(),
        bottom: bottomRight.y(),
        left: topLeft.x(),
        right: bottomRight.x(),
        distanceSquared: 0,
        dockArea,
      }
    );
  }
  return result;
}

function transformPosition(position: PanePosition, matrix: Matrix2D): PanePosition {
  const topLeft = transform2dPoint([position.left, position.top], matrix);
  const bottomRight = transform2dPoint([position.right, position.bottom], matrix);
  const left = Math.min(topLeft[0], bottomRight[0]);
  const top = Math.min(topLeft[1], bottomRight[1]);
  const bottom = Math.max(topLeft[1], bottomRight[1]);
  const right = Math.max(topLeft[0], bottomRight[0]);

  return {
    left,
    top,
    bottom,
    right,
    dockArea: position.dockArea,
    distanceSquared: position.distanceSquared,
  };
}

function transform2dPoint(point: Point2D, matrix: Matrix2D): Point2D {
  const x = point[0] * matrix[0] + point[1] * matrix[2];
  const y = point[0] * matrix[1] + point[1] * matrix[3];
  return [x ,y];
}

/**
 * Compute in place the squared distance from startCenter* to the left edge of each `candidatePositions` box.
 */
function computeSquaredDistance(startCenterX: number, startCenterY: number, candidatePositions: PanePosition[]): void {
  for (const pos of candidatePositions) {
    // Note: There are only 3 different cases for computing the shortest line from a point to a vertical line
    //       segment (edge) placed some distance from the point.
    const dx = pos.left - startCenterX;
    let dy = 0;
    if (pos.bottom < startCenterY) {
      dy = pos.bottom - startCenterY;
    } else if (pos.top > startCenterY) {
      dy = pos.top - startCenterY;
    }
    pos.distanceSquared = dx*dx + dy*dy;
  }
}

function sortCandidatePositions(candidatePositions: PanePosition[]): void {
  candidatePositions.sort( (a, b) => {
    if (a.distanceSquared < b.distanceSquared) {
      return -1;
    }
    return a.distanceSquared === b.distanceSquared ? 0 : 1;
  });
}
