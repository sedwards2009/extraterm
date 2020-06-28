/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode } from "extraterm-char-cell-grid";

export interface FontAtlas {
  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode, fgRGBA: number,
    bgRGBA: number, xPixel: number, yPixel: number): void;
  drawCodePointToImageData(destImageData: ImageData, codePoint: number, style: StyleCode, fgRGBA: number,
    bgRGBA: number, xPixel: number, yPixel: number): void;
  drawCodePoints(ctx: CanvasRenderingContext2D, codePoints: number[], style: StyleCode, fgRGBA: number,
    bgRGBA: number, xPixel: number, yPixel: number): void;
  drawCodePointsToImageData(destImageData: ImageData, codePoints: number[], style: StyleCode, fgRGBA: number,
    bgRGBA: number, xPixel: number, yPixel: number): void;
  getCanvas(): HTMLCanvasElement;
}
