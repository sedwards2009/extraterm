/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode } from "extraterm-char-cell-grid";

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { FontAtlas } from "./FontAtlas";
import { Logger, getLogger, log } from "extraterm-logging";
import { ImageBitmapFontAtlasPage } from "./ImageBitmapFontAtlasPage";
import { CPURenderedFontAtlasPage } from "./CPURenderedFontAtlasPage";


export class FontAtlasImpl implements FontAtlas {
  private _log: Logger = null;
  private _imageBitmapPages: ImageBitmapFontAtlasPage[] = [];
  private _cpuRenderedPages: CPURenderedFontAtlasPage[] = [];

  constructor(private readonly _metrics: MonospaceFontMetrics) {
    this._log = getLogger("FontAtlasImpl", this);
  }

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode, fgRGBA: number, bgRGBA: number,
                xPixel: number, yPixel: number): void {

    for (const page of this._imageBitmapPages) {
      if (page.drawCodePoint(ctx, codePoint, style, fgRGBA, bgRGBA, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendImageBitmapPage();
    page.drawCodePoint(ctx, codePoint, style, fgRGBA, bgRGBA, xPixel, yPixel);
  }

  drawCodePointToImageData(destImageData: ImageData, codePoint: number, style: StyleCode, fgRGBA: number,
      bgRGBA: number, xPixel: number, yPixel: number): void {
    for (const page of this._cpuRenderedPages) {
      if (page.drawCodePointToImageData(destImageData, codePoint, style, fgRGBA, bgRGBA, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendCPURenderedPage();
    page.drawCodePointToImageData(destImageData, codePoint, style, fgRGBA, bgRGBA, xPixel, yPixel);
  }

  drawCodePoints(ctx: CanvasRenderingContext2D, codePoints: number[], style: StyleCode, fgRGBA: number, bgRGBA: number,
      xPixel: number, yPixel: number): void {

    for (const page of this._imageBitmapPages) {
      if (page.drawCodePoints(ctx, codePoints, style, fgRGBA, bgRGBA, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendImageBitmapPage();
    page.drawCodePoints(ctx, codePoints, style, fgRGBA, bgRGBA, xPixel, yPixel);
  }

  drawCodePointsToImageData(destImageData: ImageData, codePoints: number[], style: StyleCode, fgRGBA: number,
      bgRGBA: number, xPixel: number, yPixel: number): void {

    for (const page of this._cpuRenderedPages) {
      if (page.drawCodePointsToImageData(destImageData, codePoints, style, fgRGBA, bgRGBA, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendCPURenderedPage();
    page.drawCodePointsToImageData(destImageData, codePoints, style, fgRGBA, bgRGBA, xPixel, yPixel);
  }

  getCanvas(): HTMLCanvasElement {
    return this._cpuRenderedPages[0].getCanvas();
  }

  private _appendImageBitmapPage(): ImageBitmapFontAtlasPage {
    const page = new ImageBitmapFontAtlasPage(this._metrics);
    this._imageBitmapPages.push(page);
    return page;
  }

  private _appendCPURenderedPage(): CPURenderedFontAtlasPage {
    const page = new CPURenderedFontAtlasPage(this._metrics);
    this._cpuRenderedPages.push(page);
    return page;
  }
}
