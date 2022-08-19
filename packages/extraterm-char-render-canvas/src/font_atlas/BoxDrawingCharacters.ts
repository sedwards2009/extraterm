/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 */
import { BrushStyle, PenStyle, QBrush, QColor, QPainter, QPainterPath, QPen, QPoint, RenderHint } from "@nodegui/nodegui";
import { Logger, getLogger, log } from "extraterm-logging";


const _log = getLogger("BoxDrawingCharacters");

enum GlyphRenderer {
  TWO_BY_THREE,
  FIVE_BY_FIVE,
  EIGHT_BY_EIGHT,
  FIVE_BY_EIGHT,
  EIGHT_BY_FIVE,
  ARC_DOWN_AND_RIGHT,
  ARC_DOWN_AND_LEFT,
  ARC_UP_AND_LEFT,
  ARC_UP_AND_RIGHT,
  POLYGON,
  LINES,
  UPPER_HALF_BLOCK_AND_LOWER_HALF_INVERSE_MEDIUM_SHADE,
  UPPER_HALF_INVERSE_MEDIUM_SHADE_AND_LOWER_HALF_BLOCK,
  LEFT_HALF_INVERSE_MEDIUM_SHADE_AND_RIGHT_HALF_BLOCK
}

interface Point {
  x: number;
  y: number;
}

interface GlyphData {
  glyphRenderer: GlyphRenderer;
  glyphString?: string;
  polygonPath?: Point[];
  lines?: {x1: number, y1: number, x2: number, y2: number }[];
  alpha?: number;
}

interface GlyphDataBlock {
  startCodePoint: number;
  glyphData: GlyphData[];
}

interface GlyphGridMetrics {
  gridWidth: number;
  gridHeight: number;
  horizontalThickness: number[];
  horizontalGridLines: number[];
  verticalThickness: number[];
  verticalGridLines: number[];
}

interface GridAxisMetrics {
  gridSizes: number[],
  gridLines: number[]
}

export function isBoxCharacter(codePoint: number): boolean {
  // Optimise the most common case
  if (codePoint < lowestBlockCodePoint) {
    return false;
  }

  for (let i=0; i<glyphBlocks.length; i++) {
    const startCodePoint = glyphBlocks[i].startCodePoint;
    if (codePoint < startCodePoint) {
      return false;
    }
    if (codePoint < (startCodePoint + glyphBlocks[i].glyphData.length)) {
      return true;
    }
  }
  return false;
}

function getGlyphData(codePoint: number): GlyphData {
  for (let i=0; i<glyphBlocks.length; i++) {
    const startCodePoint = glyphBlocks[i].startCodePoint;
    if (codePoint < (startCodePoint + glyphBlocks[i].glyphData.length)) {
      return glyphBlocks[i].glyphData[codePoint - startCodePoint];
    }
  }
  return null;  // This should not happen.
}

export function drawBoxCharacter(painter: QPainter, codePoint: number, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const thisGlyphData = getGlyphData(codePoint);
  switch (thisGlyphData.glyphRenderer) {
    case GlyphRenderer.TWO_BY_THREE:
      draw2x3BoxCharacter(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.FIVE_BY_FIVE:
      draw5x5BoxCharacter(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.EIGHT_BY_EIGHT:
      draw8x8BoxCharacter(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.FIVE_BY_EIGHT:
      draw5x8BoxCharacter(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.EIGHT_BY_FIVE:
      draw8x5BoxCharacter(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.ARC_DOWN_AND_RIGHT:
    case GlyphRenderer.ARC_DOWN_AND_LEFT:
    case GlyphRenderer.ARC_UP_AND_LEFT:
    case GlyphRenderer.ARC_UP_AND_RIGHT:
      drawRoundArc(painter, thisGlyphData.glyphRenderer, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.POLYGON:
      drawPolygon(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.LINES:
      drawLines(painter, thisGlyphData, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.UPPER_HALF_BLOCK_AND_LOWER_HALF_INVERSE_MEDIUM_SHADE:
      draw_UPPER_HALF_BLOCK_AND_LOWER_HALF_INVERSE_MEDIUM_SHADE(painter, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.UPPER_HALF_INVERSE_MEDIUM_SHADE_AND_LOWER_HALF_BLOCK:
      draw_UPPER_HALF_INVERSE_MEDIUM_SHADE_AND_LOWER_HALF_BLOCK(painter, dx, dy, width, height, fgColor);
      break;

    case GlyphRenderer.LEFT_HALF_INVERSE_MEDIUM_SHADE_AND_RIGHT_HALF_BLOCK:
      draw_LEFT_HALF_INVERSE_MEDIUM_SHADE_AND_RIGHT_HALF_BLOCK(painter, dx, dy, width, height, fgColor);
      break;
  }
}

function draw2x3BoxCharacter(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
  width: number, height: number, fgColor: QColor): void {

  const glyphString = thisGlyphData.glyphString;
  const metrics = compute2x3GlyphGrid(width, height);
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);
}

function compute2x3GlyphGrid(width: number, height: number): GlyphGridMetrics {
  const widthSizes = computeIntegerLineSegments(width, 2);
  const heightSizes = compute3LineSegmentsFromBaseLength(height);

  return {
    gridWidth: 2,
    gridHeight: 3,
    horizontalThickness: widthSizes.gridSizes,
    horizontalGridLines: widthSizes.gridLines,
    verticalThickness: heightSizes.gridSizes,
    verticalGridLines: heightSizes.gridLines,
  };
}

function compute3LineSegmentsFromBaseLength(totalLength: number): GridAxisMetrics {
  const shortLength = Math.floor(totalLength /3);
  const middleLength = totalLength - 2 * shortLength;
  const segmentLengths = [shortLength, middleLength, shortLength];

  const segmentPositions = new Array(3);
  for (let accu=0, i=0; i<3; i++) {
    segmentPositions[i] = accu;
    accu += segmentLengths[i];
  }
  return {
    gridLines: segmentPositions,
    gridSizes: segmentLengths
  };
}

function draw5x5BoxCharacter(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const glyphString = thisGlyphData.glyphString;
  const metrics = compute5x5GlyphGrid(width, height);
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);
}

function compute5x5GlyphGrid(width: number, height: number): GlyphGridMetrics {
  // Our box glyphs are on a 5x5 grid where the pixels which touch the edges may be rendered larger
  // than the pixels which make up the center. Also we want the glyph pixels to be rendered
  // with consistent integer dimensions, and any extra space is distributed to the edge pixels.
  //
  // i.e. our grid holding pixels can look like this:
  //
  // +--+-+-+-+--+
  // |  | | | |  |
  // |  | | | |  |
  // +--+-+-+-+--+
  // |  | | | |  |
  // +--+-+-+-+--+
  // |  | | | |  |
  // +--+-+-+-+--+
  // |  | | | |  |
  // +--+-+-+-+--+
  // |  | | | |  |
  // |  | | | |  |
  // +--+-+-+-+--+


  const baseLength = Math.floor(Math.min(width, height) / 5);
  const horizontalAxis = compute5LineSegmentsFromBaseLength(width, baseLength);
  const verticalAxis = compute5LineSegmentsFromBaseLength(height, baseLength);

  return {
    gridWidth: 5,
    gridHeight: 5,
    horizontalThickness: horizontalAxis.gridSizes,
    horizontalGridLines: horizontalAxis.gridLines,
    verticalThickness: verticalAxis.gridSizes,
    verticalGridLines: verticalAxis.gridLines,
  };
}

function compute5LineSegmentsFromBaseLength(totalLength: number, baseLength: number): GridAxisMetrics {
  const firstLength = Math.ceil((totalLength - 3 * baseLength) / 2);
  const lastLength = totalLength - 3 * baseLength - firstLength;

  const segmentLengths = new Array(5);
  segmentLengths[0] = firstLength;
  for (let i=1; i<5-1; i++) {
    segmentLengths[i] = baseLength;
  }
  segmentLengths[5-1] = lastLength;

  const segmentPositions = new Array(5);
  for (let accu=0, i=0; i<5; i++) {
    segmentPositions[i] = accu;
    accu += segmentLengths[i];
  }
  return {
    gridLines: segmentPositions,
    gridSizes: segmentLengths
  };
}

function drawNxMGlyph(painter: QPainter, glyphString: string, dx: number, dy: number,
  metrics: GlyphGridMetrics, fgColor: QColor): void {

  const { gridWidth, gridHeight, horizontalGridLines, verticalGridLines, horizontalThickness,
    verticalThickness } = metrics;

  let pixelOffset = 0;
  for (let y=0; y < gridHeight; y++) {
    for (let x=0; x < gridWidth; x++) {
      if (glyphString.charAt(pixelOffset) === "#") {
        painter.fillRect(dx + horizontalGridLines[x], dy+verticalGridLines[y], horizontalThickness[x],
          verticalThickness[y], fgColor);
      }
      pixelOffset++;
    }
  }
}

function draw8x8BoxCharacter(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
  width: number, height: number, fgColor: QColor): void {

  const glyphString = thisGlyphData.glyphString;
  const metrics = compute8x8GlyphGrid(width, height);
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);
}

function compute8x8GlyphGrid(width: number, height: number): GlyphGridMetrics {
  const widthSizes = computeIntegerLineSegments(width, 8);
  const heightSizes = computeIntegerLineSegments(height, 8);

  return {
    gridWidth: 8,
    gridHeight: 8,
    horizontalThickness: widthSizes.gridSizes,
    horizontalGridLines: widthSizes.gridLines,
    verticalThickness: heightSizes.gridSizes,
    verticalGridLines: heightSizes.gridLines,
  };
}

function computeIntegerLineSegments(totalLength: number, gridSize: number): GridAxisMetrics {
  const exactLength = totalLength / gridSize;
  let accuError = 0;
  const segmentLengths = new Array(gridSize);
  for (let i=0; i<gridSize; i++) {
    const idealLength = exactLength + accuError;
    const thisLength = Math.floor(idealLength);
    segmentLengths[i] = thisLength;
    accuError = idealLength - thisLength;
  }

  const segmentPositions = new Array(gridSize);
  for (let accu=0, i=0; i<gridSize; i++) {
    segmentPositions[i] = accu;
    accu += segmentLengths[i];
  }

  return {
    gridSizes: segmentLengths,
    gridLines: segmentPositions
  };
}

function draw5x8BoxCharacter(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {
  const glyphString = thisGlyphData.glyphString;
  const metrics = compute5x8GlyphGrid(width, height);
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);
}

function compute5x8GlyphGrid(width: number, height: number): GlyphGridMetrics {
  const baseLength = Math.floor(Math.min(width, height) / 5);
  const widthSizes = compute5LineSegmentsFromBaseLength(width, baseLength);
  const heightSizes = computeIntegerLineSegments(height, 8);

  return {
    gridWidth: 5,
    gridHeight: 8,
    horizontalThickness: widthSizes.gridSizes,
    horizontalGridLines: widthSizes.gridLines,
    verticalThickness: heightSizes.gridSizes,
    verticalGridLines: heightSizes.gridLines,
  };
}

function draw8x5BoxCharacter(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {
  const glyphString = thisGlyphData.glyphString;
  const metrics = compute8x5GlyphGrid(width, height);
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);
}

function compute8x5GlyphGrid(width: number, height: number): GlyphGridMetrics {
  const baseLength = Math.floor(Math.min(width, height) / 5);
  const widthSizes = computeIntegerLineSegments(width, 8);
  const heightSizes = compute5LineSegmentsFromBaseLength(height, baseLength);

  return {
    gridWidth: 8,
    gridHeight: 5,
    horizontalThickness: widthSizes.gridSizes,
    horizontalGridLines: widthSizes.gridLines,
    verticalThickness: heightSizes.gridSizes,
    verticalGridLines: heightSizes.gridLines,
  };
}

const arc5x5Glyphs = {
  [GlyphRenderer.ARC_DOWN_AND_RIGHT]:
    "....." +
    "....." +
    "....#" +
    "....." +
    "..#..",

  [GlyphRenderer.ARC_DOWN_AND_LEFT]:
    "....." +
    "....." +
    "#...." +
    "....." +
    "..#..",

  [GlyphRenderer.ARC_UP_AND_LEFT]:
    "..#.." +
    "....." +
    "#...." +
    "....." +
    ".....",

  [GlyphRenderer.ARC_UP_AND_RIGHT]:
    "..#.." +
    "....." +
    "....#" +
    "....." +
    ".....",
};

interface ArcStartEndPoint {
  startPointX: number;
  startPointY: number;
  endPointX: number;
  endPointY: number;
}

const arcStartEndPoints: { [index: number]: ArcStartEndPoint } = {
  [GlyphRenderer.ARC_DOWN_AND_RIGHT]: {
    startPointX: 0.5,
    startPointY: 1,
    endPointX: 1,
    endPointY: 0.5,
  },
  [GlyphRenderer.ARC_DOWN_AND_LEFT]: {
    startPointX: 0.5,
    startPointY: 1,
    endPointX: 0,
    endPointY: 0.5,
  },
  [GlyphRenderer.ARC_UP_AND_LEFT]: {
    startPointX: 0.5,
    startPointY: 0,
    endPointX: 0,
    endPointY: 0.5,
  },
  [GlyphRenderer.ARC_UP_AND_RIGHT]: {
    startPointX: 0.5,
    startPointY: 0,
    endPointX: 1,
    endPointY: 0.5,
  },
};

function drawRoundArc(painter: QPainter, renderer: GlyphRenderer, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const metrics = compute5x5GlyphGrid(width, height);
  const glyphString = arc5x5Glyphs[renderer];
  drawNxMGlyph(painter, glyphString, dx, dy, metrics, fgColor);

  painter.save();

  // We scale and translate the middle 3x3 part of the 5x5 grid to be a unit square, and
  // then draw into that distorted square. This simplifies the drawing code and also ensures
  // that the line widths are correct at the start and end of the arc.
  painter.translate(dx + metrics.horizontalGridLines[1], dy + metrics.verticalGridLines[1]);
  painter.scale(metrics.horizontalGridLines[4]-metrics.horizontalGridLines[1],
    metrics.verticalGridLines[4]-metrics.verticalGridLines[1]);

  const arcStartEndPoint = arcStartEndPoints[renderer];
  const path = new QPainterPath();

  path.moveTo(arcStartEndPoint.startPointX, arcStartEndPoint.startPointY);
  path.quadTo(0.5, 0.5, arcStartEndPoint.endPointX, arcStartEndPoint.endPointY);

  const pen = new QPen();
  pen.setWidth(1/3);
  pen.setColor(fgColor);
  painter.setPen(pen);
  painter.setRenderHint(RenderHint.Antialiasing, true);
  painter.drawPath(path);

  painter.restore();
}

function drawPolygon(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  painter.save();

  const points = thisGlyphData.polygonPath.map(p => new QPoint(p.x * width + dx, p.y * height + dy));

  const brush = new QBrush();
  brush.setStyle(BrushStyle.SolidPattern);
  brush.setColor(fgColor);
  painter.setBrush(brush);

  const pen = new QPen();
  pen.setStyle(PenStyle.NoPen);
  painter.setPen(pen);

  if (thisGlyphData.alpha !== undefined) {
    painter.setOpacity(thisGlyphData.alpha);
  }

  painter.setRenderHint(RenderHint.Antialiasing, true);
  painter.drawConvexPolygon(points);

  painter.restore();
}

function drawLines(painter: QPainter, thisGlyphData: GlyphData, dx: number, dy: number,
  width: number, height: number, fgColor: QColor): void {

  painter.save();

  const pen = new QPen();
  pen.setColor(fgColor);
  pen.setWidth(Math.ceil(width/7));
  painter.setPen(pen);

  painter.setRenderHint(RenderHint.Antialiasing, true);

  for (const line of thisGlyphData.lines) {
    const x1 = line.x1 * width + dx;
    const y1 = line.y1 * height + dy;
    const x2 = line.x2 * width + dx;
    const y2 = line.y2 * height + dy;
    painter.drawLine(x1, y1, x2, y2);
  }

  painter.restore();
}

function draw_UPPER_HALF_BLOCK_AND_LOWER_HALF_INVERSE_MEDIUM_SHADE(painter: QPainter, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const solidUpperHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0, y: 0.5 }
    ],
  };
  const shadeLowerHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    alpha: 0.5
  };
  drawPolygon(painter, solidUpperHalf, dx, dy, width, height, fgColor);
  drawPolygon(painter, shadeLowerHalf, dx, dy, width, height, fgColor);
}

function draw_UPPER_HALF_INVERSE_MEDIUM_SHADE_AND_LOWER_HALF_BLOCK(painter: QPainter, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const shadeUpperHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0, y: 0.5 }
    ],
    alpha: 0.5
  };
  const solidLowerHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
  };
  drawPolygon(painter, shadeUpperHalf, dx, dy, width, height, fgColor);
  drawPolygon(painter, solidLowerHalf, dx, dy, width, height, fgColor);
}

function draw_LEFT_HALF_INVERSE_MEDIUM_SHADE_AND_RIGHT_HALF_BLOCK(painter: QPainter, dx: number, dy: number,
    width: number, height: number, fgColor: QColor): void {

  const shadeLeftHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 1 },
      { x: 0, y: 1 }
    ],
    alpha: 0.5
  };
  const solidRightHalf = {
    glyphRenderer: GlyphRenderer.POLYGON,
    polygonPath: [
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 1 }
    ],
  };
  drawPolygon(painter, shadeLeftHalf, dx, dy, width, height, fgColor);
  drawPolygon(painter, solidRightHalf, dx, dy, width, height, fgColor);
}

// Related Unicode charts:
// * http://www.unicode.org/charts/PDF/U2500.pdf "Box Drawing"
// * http://www.unicode.org/charts/PDF/U2580.pdf "Block Elements"
// * http://www.unicode.org/charts/PDF/U25A0.pdf "Geometric Shapes"
// * http://www.unicode.org/charts/PDF/U1FB00.pdf "Symbols for Legacy Computing"

const glyphBlocks: GlyphDataBlock[] = [
  {
    startCodePoint: 0x2500,
    glyphData: [
      {
        // 0x2500 BOX DRAWINGS LIGHT HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "#####" +
          "....." +
          ".....",
      },
      {
        // 0x2501 BOX DRAWINGS HEAVY HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "#####" +
          "#####" +
          ".....",
      },
      {
        // 0x2502 BOX DRAWINGS LIGHT VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "..#.." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2503 BOX DRAWINGS HEAVY VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".###." +
          ".###." +
          ".###.",
      },
      {
        // 0x2504 BOX DRAWINGS LIGHT TRIPLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          "........" +
          ".#..#.#." +
          "........" +
          "........",
      },
      {
        // 0x2505 BOX DRAWINGS HEAVY TRIPLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          ".#..#.#." +
          ".#..#.#." +
          ".#..#.#." +
          "........",
      },
      {
        // 0x2506 BOX DRAWINGS LIGHT TRIPLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          "....." +
          "..#.." +
          "....." +
          "....." +
          "..#.." +
          "....." +
          "..#.." +
          ".....",
      },
      {
        // 0x2507 BOX DRAWINGS HEAVY TRIPLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          "....." +
          ".###." +
          "....." +
          "....." +
          ".###." +
          "....." +
          ".###." +
          ".....",
      },
      {
        // 0x2508 BOX DRAWINGS LIGHT QUADRUPLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          "........" +
          ".#.#.#.#" +
          "........" +
          "........",
      },
      {
        // 0x2509 BOX DRAWINGS HEAVY QUADRUPLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          ".#.#.#.#" +
          ".#.#.#.#" +
          ".#.#.#.#" +
          "........",
      },
      {
        // 0x250A BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          "..#.." +
          "....." +
          "..#.." +
          "....." +
          "..#.." +
          "....." +
          "..#.." +
          ".....",
      },
      {
        // 0x250B BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          ".###." +
          "....." +
          ".###." +
          "....." +
          ".###." +
          "....." +
          ".###." +
          ".....",
      },
      {
        // 0x250C BOX DRAWINGS LIGHT DOWN AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "..###" +
          "..#.." +
          "..#..",
      },
      {
        // 0x250D BOX DRAWINGS DOWN LIGHT AND RIGHT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..###" +
          "..###" +
          "..###" +
          "..#..",
      },
      {
        // 0x250E BOX DRAWINGS DOWN HEAVY AND RIGHT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          ".####" +
          ".###." +
          ".###.",
      },
      {
        // 0x250F BOX DRAWINGS HEAVY DOWN AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          ".####" +
          ".####" +
          ".####" +
          ".###.",
      },
      {
        // 0x2510 BOX DRAWINGS LIGHT DOWN AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "###.." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2511 BOX DRAWINGS DOWN LIGHT AND LEFT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "###.." +
          "###.." +
          "###.." +
          "..#..",
      },
      {
        // 0x2512 BOX DRAWINGS DOWN HEAVY AND LEFT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "####." +
          ".###." +
          ".###.",
      },
      {
        // 0x2513 BOX DRAWINGS HEAVY DOWN AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "####." +
          "####." +
          "####." +
          ".###.",
      },
      {
        // 0x2514 BOX DRAWINGS LIGHT UP AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "..###" +
          "....." +
          ".....",
      },
      {
        // 0x2515 BOX DRAWINGS UP LIGHT AND RIGHT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "..###" +
          "..###" +
          ".....",
      },
      {
        // 0x2516 BOX DRAWINGS UP HEAVY AND RIGHT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".####" +
          "....." +
          ".....",
      },
      {
        // 0x2517 BOX DRAWINGS HEAVY UP AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          ".####" +
          ".####" +
          ".....",
      },
      {
        // 0x2518 BOX DRAWINGS LIGHT UP AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "###.." +
          "....." +
          ".....",
      },
      {
        // 0x2519 BOX DRAWINGS UP LIGHT AND LEFT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "###.." +
          "###.." +
          ".....",
      },
      {
        // 0x251A BOX DRAWINGS UP HEAVY AND LEFT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "####." +
          "....." +
          ".....",
      },
      {
        // 0x251B BOX DRAWINGS HEAVY UP AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "####." +
          "####." +
          ".....",
      },
      {
        // 0x251C BOX DRAWINGS LIGHT VERTICAL AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "..###" +
          "..#.." +
          "..#..",
      },
      {
        // 0x251D BOX DRAWINGS VERTICAL LIGHT AND RIGHT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "..###" +
          "..###" +
          "..#..",
      },
      {
        // 0x251E BOX DRAWINGS UP HEAVY AND RIGHT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".####" +
          "..#.." +
          "..#..",
      },
      {
        // 0x251F BOX DRAWINGS DOWN HEAVY AND RIGHT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          ".####" +
          ".###." +
          ".###.",
      },
      {
        // 0x2520 BOX DRAWINGS VERTICAL HEAVY AND RIGHT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".####" +
          ".###." +
          ".###.",
      },
      {
        // 0x2521 BOX DRAWINGS DOWN LIGHT AND RIGHT UP HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          ".####" +
          ".####" +
          "..#..",
      },
      {
        // 0x2522 BOX DRAWINGS UP LIGHT AND RIGHT DOWN HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          ".####" +
          ".####" +
          ".####" +
          ".###.",
      },
      {
        // 0x2523 BOX DRAWINGS HEAVY VERTICAL AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          ".####" +
          ".####" +
          ".###.",
      },
      {
        // 0x2524 BOX DRAWINGS LIGHT VERTICAL AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "###.." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2525 BOX DRAWINGS VERTICAL LIGHT AND LEFT HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "###.." +
          "###.." +
          "..#..",
      },
      {
        // 0x2526 BOX DRAWINGS UP HEAVY AND LEFT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "####." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2527 BOX DRAWINGS DOWN HEAVY AND LEFT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "####." +
          ".###." +
          ".###.",
      },
      {
        // 0x2528 BOX DRAWINGS VERTICAL HEAVY AND LEFT LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "####." +
          ".###." +
          ".###.",
      },
      {
        // 0x2529 BOX DRAWINGS DOWN LIGHT AND LEFT UP HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "####." +
          "####." +
          "..#..",
      },
      {
        // 0x252A BOX DRAWINGS UP LIGHT AND LEFT DOWN HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "####." +
          "####." +
          "####." +
          ".###.",
      },
      {
        // 0x252B BOX DRAWINGS HEAVY VERTICAL AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "####." +
          "####." +
          ".###.",
      },
      {
        // 0x252C BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "#####" +
          "..#.." +
          "..#..",
      },
      {
        // 0x252D BOX DRAWINGS LEFT HEAVY AND RIGHT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "###.." +
          "#####" +
          "###.." +
          "..#..",
      },
      {
        // 0x252E BOX DRAWINGS RIGHT HEAVY AND LEFT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..###" +
          "#####" +
          "..###" +
          "..#..",
      },
      {
        // 0x252F BOX DRAWINGS DOWN LIGHT AND HORIZONTAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "#####" +
          "#####" +
          "..#..",
      },
      {
        // 0x2530 BOX DRAWINGS DOWN HEAVY AND HORIZONTAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "#####" +
          ".###." +
          ".###.",
      },
      {
        // 0x2531 BOX DRAWINGS RIGHT LIGHT AND LEFT DOWN HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "####." +
          "#####" +
          "####." +
          ".###.",
      },
      {
        // 0x2532 BOX DRAWINGS LEFT LIGHT AND RIGHT DOWN HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          ".####" +
          "#####" +
          ".####" +
          ".###.",
      },
      {
        // 0x2533 BOX DRAWINGS HEAVY DOWN AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "#####" +
          "#####" +
          ".###.",
      },
      {
        // 0x2534 BOX DRAWINGS LIGHT UP AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "#####" +
          "....." +
          ".....",
      },
      {
        // 0x2535 BOX DRAWINGS LEFT HEAVY AND RIGHT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "#####" +
          "###.." +
          ".....",
      },
      {
        // 0x2536 BOX DRAWINGS RIGHT HEAVY AND LEFT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "#####" +
          "..###" +
          ".....",
      },
      {
        // 0x2537 BOX DRAWINGS UP LIGHT AND HORIZONTAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "#####" +
          "#####" +
          "#####" +
          ".....",
      },
      {
        // 0x2538 BOX DRAWINGS UP HEAVY AND HORIZONTAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "#####" +
          "....." +
          ".....",
      },
      {
        // 0x2539 BOX DRAWINGS RIGHT LIGHT AND LEFT UP HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "#####" +
          "####." +
          ".....",
      },
      {
        // 0x253A BOX DRAWINGS LEFT LIGHT AND RIGHT UP HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          "#####" +
          ".####" +
          ".....",
      },
      {
        // 0x253B BOX DRAWINGS HEAVY UP AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "#####" +
          "#####" +
          "#####" +
          ".....",
      },
      {
        // 0x253C BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "#####" +
          "..#.." +
          "..#..",
      },
      {
        // 0x253D BOX DRAWINGS LEFT HEAVY AND RIGHT VERTICAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "#####" +
          "###.." +
          "..#..",
      },
      {
        // 0x253E BOX DRAWINGS RIGHT HEAVY AND LEFT VERTICAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "#####" +
          "..###" +
          "..#..",
      },
      {
        // 0x253F BOX DRAWINGS VERTICAL LIGHT AND HORIZONTAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "#####" +
          "#####" +
          "#####" +
          "..#..",
      },
      {
        // 0x2540 BOX DRAWINGS UP HEAVY AND DOWN HORIZONTAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "#####" +
          "..#.." +
          "..#..",
      },
      {
        // 0x2541  BOX DRAWINGS DOWN HEAVY AND UP HORIZONTAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "#####" +
          ".###." +
          ".###.",
      },
      {
        // 0x2542  BOX DRAWINGS VERTICAL HEAVY AND HORIZONTAL LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          "#####" +
          ".###." +
          ".###.",
      },

      {
        // 0x2543  BOX DRAWINGS LEFT UP HEAVY AND RIGHT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "#####" +
          "####." +
          "..#..",
      },
      {
        // 0x2544  BOX DRAWINGS RIGHT UP HEAVY AND LEFT DOWN LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          "#####" +
          ".####" +
          "..#..",
      },
      {
        // 0x2545  BOX DRAWINGS LEFT DOWN HEAVY AND RIGHT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "####." +
          "#####" +
          "####." +
          ".###.",
      },
      {
        // 0x2546  BOX DRAWINGS RIGHT DOWN HEAVY AND LEFT UP LIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          ".####" +
          "#####" +
          ".####" +
          ".###.",
      },
      {
        // 0x2547  BOX DRAWINGS DOWN LIGHT AND UP HORIZONTAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "#####" +
          "#####" +
          "#####" +
          "..#..",
      },
      {
        // 0x2548  BOX DRAWINGS UP LIGHT AND DOWN HORIZONTAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "#####" +
          "#####" +
          "#####" +
          ".###.",
      },
      {
        // 0x2549  BOX DRAWINGS RIGHT LIGHT AND LEFT VERTICAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "####." +
          "#####" +
          "####." +
          ".###.",
      },
      {
        // 0x254A  BOX DRAWINGS LEFT LIGHT AND RIGHT VERTICAL HEAVY
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".####" +
          "#####" +
          ".####" +
          ".###.",
      },
      {
        // 0x254B  BOX DRAWINGS HEAVY VERTICAL AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          "#####" +
          "#####" +
          "#####" +
          ".###.",
      },
      {
        // 0x254C BOX DRAWINGS LIGHT DOUBLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          "........" +
          "##..##.." +
          "........" +
          "........",
      },
      {
        // 0x254D BOX DRAWINGS HEAVY DOUBLE DASH HORIZONTAL
        glyphRenderer: GlyphRenderer.EIGHT_BY_FIVE,
        glyphString:
          "........" +
          "##..##.." +
          "##..##.." +
          "##..##.." +
          "........",
      },
      {
        // 0x254E BOX DRAWINGS LIGHT DOUBLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          "..#.." +
          "..#.." +
          "....." +
          "....." +
          "..#.." +
          "..#.." +
          "....." +
          ".....",
      },
      {
        // 0x254F BOX DRAWINGS HEAVY DOUBLE DASH VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_EIGHT,
        glyphString:
          ".###." +
          ".###." +
          "....." +
          "....." +
          ".###." +
          ".###." +
          "....." +
          ".....",
      },
      {
        // 0x2550 BOX DRAWINGS DOUBLE HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "....." +
          "#####" +
          ".....",
      },
      {
        // 0x2551 BOX DRAWINGS DOUBLE VERTICAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          ".#.#." +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2552 BOX DRAWINGS DOWN SINGLE AND RIGHT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..###" +
          "..#.." +
          "..###" +
          "..#..",
      },
      {
        // 0x2553 BOX DRAWINGS DOWN DOUBLE AND RIGHT SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          ".####" +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2554 BOX DRAWINGS DOUBLE DOWN AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          ".####" +
          ".#..." +
          ".#.##" +
          ".#.#.",
      },
      {
        // 0x2555 BOX DRAWINGS DOWN SINGLE AND LEFT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "###.." +
          "..#.." +
          "###.." +
          "..#..",
      },
      {
        // 0x2556 BOX DRAWINGS DOWN DOUBLE AND LEFTSINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "####." +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2557 BOX DRAWINGS DOUBLE DOWN AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "####." +
          "...#." +
          "##.#." +
          ".#.#.",
      },
      {
        // 0x2558 BOX DRAWINGS UP SINGLE AND RIGHT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "..#.." +
          "..###" +
          ".....",
      },
      {
        // 0x2559 BOX DRAWINGS UP DOUBLE AND RIGHT SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          ".####" +
          "....." +
          ".....",
      },
      {
        // 0x255A BOX DRAWINGS DOUBLE UP AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.##" +
          ".#..." +
          ".####" +
          ".....",
      },
      {
        // 0x255B BOX DRAWINGS UP SINGLE AND LEFT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "..#.." +
          "###.." +
          ".....",
      },
      {
        // 0x255C BOX DRAWINGS UP DOUBLE AND LEFT SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          "####." +
          "....." +
          ".....",
      },
      {
        // 0x255D BOX DRAWINGS DOUBLE UP AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          "##.#." +
          "...#." +
          "####." +
          ".....",
      },
      {
        // 0x255E BOX DRAWINGS VERTICAL SINGLE AND RIGHT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..###" +
          "..#.." +
          "..###" +
          "..#..",
      },
      {
        // 0x255F BOX DRAWINGS VERTICAL DOUBLE AND RIGHT SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          ".#.##" +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2560 BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.##" +
          ".#..." +
          ".#.##" +
          ".#.#.",
      },
      {
        // 0x2561 BOX DRAWINGS VERTICAL SINGLE AND LEFT DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "###.." +
          "..#.." +
          "###.." +
          "..#..",
      },
      {
        // 0x2562 BOX DRAWINGS VERTICAL DOUBLE AND LEFT SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          "##.#." +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2563 BOX DRAWINGS DOUBLE VERTICAL AND LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          "##.#." +
          "...#." +
          "##.#." +
          ".#.#.",
      },
      {
        // 0x2564 BOX DRAWINGS DOWN SINGLE AND HORIZONTAL DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "....." +
          "#####" +
          "..#..",
      },
      {
        // 0x2565 BOX DRAWINGS DOWN DOUBLE AND HORIZONTAL SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "#####" +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x2566 BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "#####" +
          "....." +
          "##.##" +
          ".#.#.",
      },
      {
        // 0x2567 BOX DRAWINGS UP SINGLE AND HORIZONTAL DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "#####" +
          "....." +
          "#####" +
          ".....",
      },
      {
        // 0x2568 BOX DRAWINGS UP DOUBLE AND HORIZONTAL SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          "#####" +
          "....." +
          ".....",
      },
      {
        // 0x2569 BOX DRAWINGS DOUBLE UP AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          "##.##" +
          "....." +
          "#####" +
          ".....",
      },
      {
        // 0x256A BOX DRAWINGS VERTICAL SINGLE AND HORIZONTAL DOUBLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "#####" +
          "..#.." +
          "#####" +
          "..#..",
      },
      {
        // 0x256B BOX DRAWINGS VERTICAL DOUBLE AND HORIZONTAL SINGLE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          ".#.#." +
          "#####" +
          ".#.#." +
          ".#.#.",
      },
      {
        // 0x256C BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".#.#." +
          "##.##" +
          "....." +
          "##.##" +
          ".#.#.",
      },
      {
        // 0x256D BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
        glyphRenderer: GlyphRenderer.ARC_DOWN_AND_RIGHT,
        glyphString: null
      },
      {
        // 0x256E BOX DRAWINGS LIGHT ARC DOWN AND LEFT
        glyphRenderer: GlyphRenderer.ARC_DOWN_AND_LEFT,
        glyphString: null
      },
      {
        // 0x256F BOX DRAWINGS LIGHT ARC UP AND LEFT
        glyphRenderer: GlyphRenderer.ARC_UP_AND_LEFT,
        glyphString: null
      },
      {
        // 0x2570 BOX DRAWINGS LIGHT ARC UP AND RIGHT
        glyphRenderer: GlyphRenderer.ARC_UP_AND_RIGHT,
        glyphString: null
      },
      {
        // 0x2571 BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 1, y1: 0, x2: 0, y2: 1 }
        ]
      },
      {
        // 0x2572 BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0, x2: 1, y2: 1 }
        ]
      },
      {
        // 0x2573 BOX DRAWINGS LIGHT DIAGONAL CROSS
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 1, y1: 0, x2: 0, y2: 1 },
          { x1: 0, y1: 0, x2: 1, y2: 1 }
        ]
      },
      {
        // 0x2574 BOX DRAWINGS LIGHT LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "###.." +
          "....." +
          ".....",
      },
      {
        // 0x2575 BOX DRAWINGS LIGHT UP
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          "..#.." +
          "....." +
          ".....",
      },
      {
        // 0x2576 BOX DRAWINGS LIGHT RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "..###" +
          "....." +
          ".....",
      },
      {
        // 0x2577 BOX DRAWINGS LIGHT DOWN
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          "..#.." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2578 BOX DRAWINGS HEAVY LEFT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "###.." +
          "###.." +
          "###.." +
          ".....",
      },
      {
        // 0x2579 BOX DRAWINGS HEAVY UP
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".###." +
          "....." +
          ".....",
      },
      {
        // 0x257A BOX DRAWINGS HEAVY RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..###" +
          "..###" +
          "..###" +
          ".....",
      },
      {
        // 0x257B BOX DRAWINGS HEAVY DOWN
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "....." +
          ".###." +
          ".###." +
          ".###.",
      },
      {
        // 0x257C  BOX DRAWINGS LIGHT LEFT AND HEAVY RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..###" +
          "#####" +
          "..###" +
          ".....",
      },
      {
        // 0x257D  BOX DRAWINGS LIGHT UP AND HEAVY DOWN
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "..#.." +
          "..#.." +
          ".###." +
          ".###." +
          ".###.",
      },
      {
        // 0x257E  BOX DRAWINGS HEAVY LEFT AND LIGHT RIGHT
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "###.." +
          "#####" +
          "###.." +
          ".....",
      },
      {
        // 0x257F  BOX DRAWINGS HEAVY UP AND LIGHT DOWN
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          ".###." +
          ".###." +
          ".###." +
          "..#.." +
          "..#..",
      },
      {
        // 0x2580 UPPER HALF BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x2581 LOWER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########"
      },
      {
        // 0x2582 LOWER ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "########"
      },
      {
        // 0x2583 LOWER THREE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2584 LOWER HALF BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2585 LOWER FIVE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2586 LOWER THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2587 LOWER SEVEN EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2588 FULL BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x2589 LEFT SEVEN EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "#######." +
          "#######." +
          "#######." +
          "#######." +
          "#######." +
          "#######." +
          "#######." +
          "#######."
      },
      {
        // 0x258A LEFT THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "######.." +
          "######.." +
          "######.." +
          "######.." +
          "######.." +
          "######.." +
          "######.." +
          "######.."
      },
      {
        // 0x258B LEFT FIVE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "#####..." +
          "#####..." +
          "#####..." +
          "#####..." +
          "#####..." +
          "#####..." +
          "#####..." +
          "#####..."
      },
      {
        // 0x258C LEFT HALF BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "####...."
      },
      {
        // 0x258D LEFT THREE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "###....." +
          "###....." +
          "###....." +
          "###....." +
          "###....." +
          "###....." +
          "###....." +
          "###....."
      },
      {
        // 0x258E LEFT ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "##......" +
          "##......" +
          "##......" +
          "##......" +
          "##......" +
          "##......" +
          "##......" +
          "##......"
      },
      {
        // 0x258F LEFT ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......."
      },
      {
        // 0x2590 RIGHT HALF BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "....####"
      },
      {
        // 0x2591 LIGHT SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.25
      },
      {
        // 0x2592 MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.5
      },
      {
        // 0x2593 DARK SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.75
      },
      {
        // 0x2594 UPPER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x2595 RIGHT ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#"
      },
      {

        // 0x2596  QUADRANT LOWER LEFT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "####...." +
          "####...." +
          "####...." +
          "####...."
      },
      {
        // 0x2597  QUADRANT LOWER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "....####" +
          "....####" +
          "....####" +
          "....####"
      },
      {
        // 0x2598  QUADRANT UPPER LEFT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x2599  QUADRANT UPPER LEFT AND LOWER LEFT AND LOWER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "########" +
          "########" +
          "########" +
          "########"
      },
      {
        // 0x259A  QUADRANT UPPER LEFT AND LOWER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "####...." +
          "####...." +
          "####...." +
          "####...." +
          "....####" +
          "....####" +
          "....####" +
          "....####"
      },
      {
        // 0x259B  QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER LEFT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "####...." +
          "####...." +
          "####...." +
          "####...."
      },
      {
        // 0x259C  QUADRANT UPPER LEFT AND UPPER RIGHT AND LOWER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "....####" +
          "....####" +
          "....####" +
          "....####"
      },
      {
        // 0x259D  QUADRANT UPPER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x259E  QUADRANT UPPER RIGHT AND LOWER LEFT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "####...." +
          "####...." +
          "####...." +
          "####...."
      },
      {
        // 0x259F  QUADRANT UPPER RIGHT AND LOWER LEFT AND LOWER RIGHT
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "....####" +
          "....####" +
          "....####" +
          "....####" +
          "########" +
          "########" +
          "########" +
          "########"
      },
    ]
  },

  {
    startCodePoint: 0x25E2,
    glyphData: [
      {
        // 0x25E2 BLACK LOWER RIGHT TRIANGLE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath:[
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x25E3 BLACK LOWER LEFT TRIANGLE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath:[
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x25E4 BLACK UPPER LEFT TRIANGLE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath:[
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x25E5 BLACK UPPER RIGHT TRIANGLE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath:[
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ]
      }
    ]
  },

  {
    startCodePoint: 0x1FB00,
    glyphData:[
      {
        // 0x1FB00 BLOCK SEXTANT-1
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".." +
          ".."
      },
      {
        // 0x1FB01 BLOCK SEXTANT-2
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".." +
          ".."
      },
      {
        // 0x1FB02 BLOCK SEXTANT-12
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".." +
          ".."
      },

      {
        // 0x1FB03 BLOCK SEXTANT-3
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "#." +
          ".."
      },
      {
        // 0x1FB04 BLOCK SEXTANT-13
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "#." +
          ".."
      },
      {
        // 0x1FB05 BLOCK SEXTANT-23
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "#." +
          ".."
      },
      {
        // 0x1FB06 BLOCK SEXTANT-123
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "#." +
          ".."
      },
      {
        // 0x1FB07 BLOCK SEXTANT-4
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".#" +
          ".."
      },
      {
        // 0x1FB08 BLOCK SEXTANT-14
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".#" +
          ".."
      },
      {
        // 0x1FB09 BLOCK SEXTANT-24
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".#" +
          ".."
      },
      {
        // 0x1FB0A BLOCK SEXTANT-124
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".#" +
          ".."
      },
      {
        // 0x1FB0B BLOCK SEXTANT-34
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "##" +
          ".."
      },
      {
        // 0x1FB0C BLOCK SEXTANT-134
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "##" +
          ".."
      },
      {
        // 0x1FB0D BLOCK SEXTANT-234
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "##" +
          ".."
      },
      {
        // 0x1FB0E BLOCK SEXTANT-1234
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "##" +
          ".."
      },
      {
        // 0x1FB0F BLOCK SEXTANT-5
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".." +
          "#."
      },
      {
        // 0x1FB10 BLOCK SEXTANT-15
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".." +
          "#."
      },
      {
        // 0x1FB11 BLOCK SEXTANT-25
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".." +
          "#."
      },
      {
        // 0x1FB12 BLOCK SEXTANT-125
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".." +
          "#."
      },
      {
        // 0x1FB13 BLOCK SEXTANT-35
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "#." +
          "#."
      },
      {
        // 0x1FB14 BLOCK SEXTANT-235
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "#." +
          "#."
      },
      {
        // 0x1FB15 BLOCK SEXTANT-1235
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "#." +
          "#."
      },
      {
        // 0x1FB16 BLOCK SEXTANT-45
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".#" +
          "#."
      },
      {
        // 0x1FB17 BLOCK SEXTANT-145
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".#" +
          "#."
      },
      {
        // 0x1FB18 BLOCK SEXTANT-245
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".#" +
          "#."
      },
      {
        // 0x1FB19 BLOCK SEXTANT-1245
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".#" +
          "#."
      },
      {
        // 0x1FB1A BLOCK SEXTANT-345
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "##" +
          "#."
      },
      {
        // 0x1FB1B BLOCK SEXTANT-1345
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "##" +
          "#."
      },
      {
        // 0x1FB1C BLOCK SEXTANT-2345
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "##" +
          "#."
      },
      {
        // 0x1FB1D BLOCK SEXTANT-12345
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "##" +
          "#."
      },
      {
        // 0x1FB1E BLOCK SEXTANT-6
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".." +
          ".#"
      },
      {
        // 0x1FB1F BLOCK SEXTANT-16
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".." +
          ".#"
      },
      {
        // 0x1FB20 BLOCK SEXTANT-26
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".." +
          ".#"
      },
      {
        // 0x1FB21 BLOCK SEXTANT-126
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".." +
          ".#"
      },
      {
        // 0x1FB22 BLOCK SEXTANT-36
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "#." +
          ".#"
      },
      {
        // 0x1FB23 BLOCK SEXTANT-136
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "#." +
          ".#"
      },
      {
        // 0x1FB24 BLOCK SEXTANT-236
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "#." +
          ".#"
      },
      {
        // 0x1FB25 BLOCK SEXTANT-1236
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "#." +
          ".#"
      },
      {
        // 0x1FB26 BLOCK SEXTANT-46
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".#" +
          ".#"
      },
      {
        // 0x1FB27 BLOCK SEXTANT-146
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".#" +
          ".#"
      },
      {
        // 0x1FB28 BLOCK SEXTANT-1246
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".#" +
          ".#"
      },
      {
        // 0x1FB29 BLOCK SEXTANT-346
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "##" +
          ".#"
      },
      {
        // 0x1FB2A BLOCK SEXTANT-1346
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "##" +
          ".#"
      },
      {
        // 0x1FB2B BLOCK SEXTANT-2346
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "##" +
          ".#"
      },
      {
        // 0x1FB2C BLOCK SEXTANT-12346
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "##" +
          ".#"
      },
      {
        // 0x1FB2D BLOCK SEXTANT-56
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".." +
          "##"
      },
      {
        // 0x1FB2E BLOCK SEXTANT-156
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".." +
          "##"
      },
      {
        // 0x1FB2F BLOCK SEXTANT-256
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".." +
          "##"
      },
      {
        // 0x1FB30 BLOCK SEXTANT-1256
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".." +
          "##"
      },
      {
        // 0x1FB31 BLOCK SEXTANT-356
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "#." +
          "##"
      },
      {
        // 0x1FB32 BLOCK SEXTANT-1356
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "#." +
          "##"
      },
      {
        // 0x1FB33 BLOCK SEXTANT-2356
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "#." +
          "##"
      },
      {
        // 0x1FB34 BLOCK SEXTANT-12356
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          "#." +
          "##"
      },

      {
        // 0x1FB35 BLOCK SEXTANT-456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          ".#" +
          "##"
      },
      {
        // 0x1FB36 BLOCK SEXTANT-1456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          ".#" +
          "##"
      },
      {
        // 0x1FB37 BLOCK SEXTANT-2456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          ".#" +
          "##"
      },
      {
        // 0x1FB38 BLOCK SEXTANT-12456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "##" +
          ".#" +
          "##"
      },
      {
        // 0x1FB39 BLOCK SEXTANT-3456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".." +
          "##" +
          "##"
      },
      {
        // 0x1FB3A BLOCK SEXTANT-13456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          "#." +
          "##" +
          "##"
      },
      {
        // 0x1FB3B BLOCK SEXTANT-23456
        glyphRenderer: GlyphRenderer.TWO_BY_THREE,
        glyphString:
          ".#" +
          "##" +
          "##"
      },
      {
        // 0x1FB3C LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath:[
          { x: 0, y: 2/3 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB3D LOWER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 2/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB3E LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1/3 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB3F LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB40 LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB41 LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1/3 },
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB42 LOWER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1/3 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB43 LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 2/3 },
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB44 LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 2/3 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB45 LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1 },
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB46 LOWER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 2/3 },
          { x: 1, y: 1/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB47 LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 1 },
          { x: 1, y: 2/3 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB48 LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1 },
          { x: 1, y: 2/3 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB49 LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 1 },
          { x: 1, y: 1/3 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB4A LOWER RIGHT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1 },
          { x: 1, y: 1/3 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB4B LOWER RIGHT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 1 },
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB4C LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 1, y: 1/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB4D LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 1/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB4E LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 1, y: 2/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB4F LOWER LEFT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 2/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB50 LOWER LEFT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB51 LOWER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1/3 },
          { x: 1, y: 2/3 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB52 UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 },
          { x: 0, y: 2/3 }
        ]
      },
      {
        // 0x1FB53 UPPER RIGHT BLOCK DIAGONAL LOWER MIDDLE LEFT TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 2/3 }
        ]
      },
      {
        // 0x1FB54 UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1/3 }
        ]
      },
      {
        // 0x1FB55 UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1/3 }
        ]
      },
      {
        // 0x1FB56 UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 }
        ]
      },
      {
        // 0x1FB57 UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0, y: 1/3 }
        ]
      },
      {
        // 0x1FB58 UPPER LEFT BLOCK DIAGONAL UPPER MIDDLE LEFT TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1/3 }
        ]
      },
      {
        // 0x1FB59 UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0, y: 2/3 }
        ]
      },
      {
        // 0x1FB5A UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 2/3 }
        ]
      },
      {
        // 0x1FB5B UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER CENTRE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB5C UPPER LEFT BLOCK DIAGONAL LOWER MIDDLE LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1/3 },
          { x: 0, y: 2/3 }
        ]
      },
      {
        // 0x1FB5D UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2/3 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB5E UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2/3 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB5F UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1/3 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB60 UPPER LEFT BLOCK DIAGONAL LOWER LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1/3 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB61 UPPER LEFT BLOCK DIAGONAL LOWER CENTRE TO UPPER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB62 UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1/3 }
        ]
      },
      {
        // 0x1FB63 UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO UPPER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1/3 }
        ]
      },
      {
        // 0x1FB64 UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2/3 }
        ]
      },
      {
        // 0x1FB65 UPPER RIGHT BLOCK DIAGONAL UPPER LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2/3 }
        ]
      },
      {
        // 0x1FB66 UPPER RIGHT BLOCK DIAGONAL UPPER CENTRE TO LOWER RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB67 UPPER RIGHT BLOCK DIAGONAL UPPER MIDDLE LEFT TO LOWER MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 2/3 },
          { x: 0, y: 1/3 }
        ]
      },
      {
        // 0x1FB68 UPPER AND RIGHT AND LOWER TRIANGULAR THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
          { x: 0.5, y: 0.5 }
        ]
      },
      {
        // 0x1FB69 LEFT AND LOWER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB6A UPPER AND LEFT AND LOWER TRIANGULAR THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB6B LEFT AND UPPER AND RIGHT TRIANGULAR THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 0.5 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB6C LEFT TRIANGULAR ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 0, y: 1 }
        ]
      },
      {
        // 0x1FB6D UPPER TRIANGULAR ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 0.5 }
        ]
      },
      {
        // 0x1FB6E RIGHT TRIANGULAR ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 1, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB6F LOWER TRIANGULAR ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 1 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 }
        ]
      },
      {
        // 0x1FB70 VERTICAL ONE EIGHTH BLOCK-2
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".#......" +
          ".#......" +
          ".#......" +
          ".#......" +
          ".#......" +
          ".#......" +
          ".#......" +
          ".#......"
      },
      {
        // 0x1FB71 VERTICAL ONE EIGHTH BLOCK-3
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "..#....." +
          "..#....." +
          "..#....." +
          "..#....." +
          "..#....." +
          "..#....." +
          "..#....." +
          "..#....."
      },
      {
        // 0x1FB71 VERTICAL ONE EIGHTH BLOCK-4
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "...#...." +
          "...#...." +
          "...#...." +
          "...#...." +
          "...#...." +
          "...#...." +
          "...#...." +
          "...#...."
      },
      {
        // 0x1FB72 VERTICAL ONE EIGHTH BLOCK-5
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "....#..." +
          "....#..." +
          "....#..." +
          "....#..." +
          "....#..." +
          "....#..." +
          "....#..." +
          "....#..."
      },
      {
        // 0x1FB73 VERTICAL ONE EIGHTH BLOCK-6
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".....#.." +
          ".....#.." +
          ".....#.." +
          ".....#.." +
          ".....#.." +
          ".....#.." +
          ".....#.." +
          ".....#.."
      },
      {
        // 0x1FB74 VERTICAL ONE EIGHTH BLOCK-7
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "......#." +
          "......#." +
          "......#." +
          "......#." +
          "......#." +
          "......#." +
          "......#." +
          "......#."
      },

      {
        // 0x1FB76 HORIZONTAL ONE EIGHTH BLOCK-2
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB77 HORIZONTAL ONE EIGHTH BLOCK-3
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB78 HORIZONTAL ONE EIGHTH BLOCK-4
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB79 HORIZONTAL ONE EIGHTH BLOCK-5
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB7A HORIZONTAL ONE EIGHTH BLOCK-6
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "........" +
          "........"
      },
      {
        // 0x1FB7B HORIZONTAL ONE EIGHTH BLOCK-7
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########" +
          "........"
      },
      {
        // 0x1FB7C LEFT AND LOWER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "########"
      },
      {
        // 0x1FB7D LEFT AND UPPER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......." +
          "#......."
      },
      {
        // 0x1FB7E RIGHT AND UPPER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#"
      },
      {
        // 0x1FB7F RIGHT AND LOWER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          ".......#" +
          "########"
      },
      {
        // 0x1FB80 UPPER AND LOWER ONE EIGHTH BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "########"
      },
      {
        // 0x1FB81 HORIZONTAL ONE EIGHTH BLOCK-1358
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "........" +
          "########" +
          "........" +
          "########" +
          "........" +
          "........" +
          "########"
      },
      {
        // 0x1FB82 UPPER ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB83 UPPER THREE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "........" +
          "........" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB84 UPPER FIVE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "........" +
          "........" +
          "........"
      },
      {
        // 0x1FB85 UPPER THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "........" +
          "........"
      },
      {
        // 0x1FB86 UPPER SEVEN EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "########" +
          "........"
      },
      {
        // 0x1FB87 RIGHT ONE QUARTER BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "......##" +
          "......##" +
          "......##" +
          "......##" +
          "......##" +
          "......##" +
          "......##" +
          "......##"
      },
      {
        // 0x1FB88 RIGHT THREE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".....###" +
          ".....###" +
          ".....###" +
          ".....###" +
          ".....###" +
          ".....###" +
          ".....###" +
          ".....###"
      },
      {
        // 0x1FB89 RIGHT FIVE EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "...#####" +
          "...#####" +
          "...#####" +
          "...#####" +
          "...#####" +
          "...#####" +
          "...#####" +
          "...#####"
      },
      {
        // 0x1FB8A RIGHT THREE QUARTERS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "..######" +
          "..######" +
          "..######" +
          "..######" +
          "..######" +
          "..######" +
          "..######" +
          "..######"
      },
      {
        // 0x1FB8B RIGHT SEVEN EIGHTHS BLOCK
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          ".#######" +
          ".#######" +
          ".#######" +
          ".#######" +
          ".#######" +
          ".#######" +
          ".#######" +
          ".#######"
      },
      {
        // 0x1FB8C LEFT HALF MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.5
      },
      {
        // 0x1FB8D RIGHT HALF MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0.5, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 1 }
        ],
        alpha: 0.5
      },
      {
        // 0x1FB8E UPPER HALF MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0, y: 0.5 }
        ],
        alpha: 0.5
      },
      {
        // 0x1FB8F LOWER HALF MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.5
      },
      {
        // 0x1FB90 INVERSE MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        alpha: 0.5
      },
      {
        // 0x1FB91 UPPER HALF BLOCK AND LOWER HALF INVERSE MEDIUM SHADE
        glyphRenderer: GlyphRenderer.UPPER_HALF_BLOCK_AND_LOWER_HALF_INVERSE_MEDIUM_SHADE
      },
      {
        // 0x1FB92 UPPER HALF INVERSE MEDIUM SHADE AND LOWER HALF BLOCK
        glyphRenderer: GlyphRenderer.UPPER_HALF_INVERSE_MEDIUM_SHADE_AND_LOWER_HALF_BLOCK
      },
    ]
  },

  {
    startCodePoint: 0x1FB94,
    glyphData: [
      {
        // 0x1FB94 LEFT HALF INVERSE MEDIUM SHADE AND RIGHT HALF BLOCK
        glyphRenderer: GlyphRenderer.LEFT_HALF_INVERSE_MEDIUM_SHADE_AND_RIGHT_HALF_BLOCK
      },
      {
        // 0x1FB95  CHECKER BOARD FILL
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "##..##.." +
          "##..##.." +
          "..##..##" +
          "..##..##" +
          "##..##.." +
          "##..##.." +
          "..##..##" +
          "..##..##"
      },
      {
        // 0x1FB96  INVERSE CHECKER BOARD FILL
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "..##..##" +
          "..##..##" +
          "##..##.." +
          "##..##.." +
          "..##..##" +
          "..##..##" +
          "##..##.." +
          "##..##.."
      },
      {
        // 0x1FB97  HEAVY HORIZONTAL FILL
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "........" +
          "........" +
          "########" +
          "########" +
          "........" +
          "........" +
          "########" +
          "########"
      },
      {
        // 0x1FB98  UPPER LEFT TO LOWER RIGHT FILL
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "#...#..." +
          ".#...#.." +
          "..#...#." +
          "...#...#" +
          "#...#..." +
          ".#...#.." +
          "..#...#." +
          "...#...#"
      },
      {
        // 0x1FB99  UPPER RIGHT TO LOWER LEFT FILL
        glyphRenderer: GlyphRenderer.EIGHT_BY_EIGHT,
        glyphString:
          "...#...#" +
          "..#...#." +
          ".#...#.." +
          "#...#..." +
          "...#...#" +
          "..#...#." +
          ".#...#.." +
          "#...#..."
      },
      {
        // 0x1FB9A UPPER AND LOWER TRIANGULAR HALF BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
          { x: 0.5, y: 0.5 }
        ]
      },
      {
        // 0x1FB9B LEFT AND RIGHT TRIANGULAR HALF BLOCK
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.5 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 0.5 },
          { x: 0, y: 1 }
        ]
      },

      {
        // 0x1FB9C UPPER LEFT TRIANGULAR MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        alpha: 0.5
      },
      {
        // 0x1FB9D UPPER RIGHT TRIANGULAR MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        alpha: 0.5
      },
      {
        // 0x1FB9E LOWER RIGHT TRIANGULAR MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        alpha: 0.5
      },
      {
        // 0x1FB9F LOWER LEFT TRIANGULAR MEDIUM SHADE
        glyphRenderer: GlyphRenderer.POLYGON,
        polygonPath: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        alpha: 0.5
      },
      {
        // 0x1FBA0 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 }
        ]
      },
      {
        // 0x1FBA1 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBA2 BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBA3 BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBA4 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 0, x2: 0, y2: 0.5 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBA5 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 1, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBA6 BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO LOWER CENTRE TO MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 },
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBA7 BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO UPPER CENTRE TO MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBA8 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT AND MIDDLE RIGHT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBA9 BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT AND MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBAA BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE TO MIDDLE LEFT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 },
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBAB BOX DRAWINGS LIGHT DIAGONAL UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE TO MIDDLE RIGHT
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 },
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBAC BOX DRAWINGS LIGHT DIAGONAL MIDDLE LEFT TO UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 1, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBAD BOX DRAWINGS LIGHT DIAGONAL MIDDLE RIGHT TO UPPER CENTRE TO MIDDLE LEFT TO LOWER CENTRE
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 }
        ]
      },
      {
        // 0x1FBAE BOX DRAWINGS LIGHT DIAGONAL DIAMOND
        glyphRenderer: GlyphRenderer.LINES,
        lines: [
          { x1: 0, y1: 0.5, x2: 0.5, y2: 0 },
          { x1: 0.5, y1: 0, x2: 1, y2: 0.5 },
          { x1: 0, y1: 0.5, x2: 0.5, y2: 1 },
          { x1: 0.5, y1: 1, x2: 1, y2: 0.5 }
        ]
      },
      {
        // 0x1FBAF BOX DRAWINGS LIGHT HORIZONTAL WITH VERTICAL STROKE
        glyphRenderer: GlyphRenderer.FIVE_BY_FIVE,
        glyphString:
          "....." +
          "..#.." +
          "#####" +
          "..#.." +
          ".....",
      },
    ]
  },
];

const lowestBlockCodePoint = glyphBlocks[0].startCodePoint;
