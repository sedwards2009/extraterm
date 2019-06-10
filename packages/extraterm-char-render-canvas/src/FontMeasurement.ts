/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { MonospaceFontMetrics } from "./MonospaceFontMetrics";

const log = console.log.bind(console);

export function computeFontMetrics(fontFamily: string, fontSizePx: number, sampleChars: string[]=null): MonospaceFontMetrics {
  const fm = new FontMeasurement();
  return fm.computeFontMetrics(fontFamily, fontSizePx, sampleChars);
}

class FontMeasurement {

  private _canvasWidthPx = 250;
  private _canvasHeightPx = 250;

  computeFontMetrics(fontFamily: string, fontSizePx: number, sampleChars: string[]=null): MonospaceFontMetrics {
    if (sampleChars == null) {
      sampleChars = ["X"];
    }

    const canvas = <HTMLCanvasElement> document.createElement("canvas");

    this._canvasWidthPx = fontSizePx * 3;
    this._canvasHeightPx = fontSizePx * 3;
    canvas.width = this._canvasWidthPx;
    canvas.height = this._canvasHeightPx;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.font = "" + fontSizePx + "px " + fontFamily;
    ctx.textBaseline = "top";

    // Note: most of the properties on a TextMetrics object are behind Blink's experimental flag. 1/5/2019
    const metrics = ctx.measureText(sampleChars[0]);
    logFontMetrics(sampleChars[0], metrics);

    const {topY: xTopY, bottomY: xBottomY} = this._renderAndMeasureText(ctx, fontSizePx, sampleChars[0]);
    log(`X: topY: ${xTopY}, bottomY: ${xBottomY}`);

    const {topY: mTopY, bottomY: mBottomY} = this._renderAndMeasureText(ctx, fontSizePx, "m");
    log(`m: topY: ${mTopY}, bottomY: ${mBottomY}`);

    const charWidthPx = Math.ceil(metrics.width);
    const charHeightPx = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);

    let fillTextYOffset = Math.ceil(metrics.fontBoundingBoxAscent);
    if (xTopY < 0) {
      // Sometimes glyphs still manage to protrude above the top of the font box.
      // So we shrink and shift them a bit.
      fontSizePx = fontSizePx + xTopY;
      fillTextYOffset = fillTextYOffset - xTopY;
    }

    return {
      fontSizePx,
      fontFamily,

      widthPx: charWidthPx,
      heightPx: charHeightPx,

      fillTextYOffset,
      fillTextXOffset: 0,

      strikethroughY: Math.round((mTopY + mBottomY) /2) + fillTextYOffset,
      strikethroughHeight: 1,
      underlineY: Math.round(xBottomY + 2) + fillTextYOffset,
      underlineHeight: 1,
    };
  }

  private _renderAndMeasureText(ctx: CanvasRenderingContext2D, fontSizePx: number, text: string): { topY: number, bottomY: number } {
    ctx.save();

    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, this._canvasWidthPx, this._canvasHeightPx);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffffff";

    ctx.fillText(text, fontSizePx, fontSizePx);

    const imageData = ctx.getImageData(0, 0, fontSizePx * 3, fontSizePx * 3);
    const topRowY = this._findTopRowInImageData(imageData);
    const bottomRowY = this._findBottomRowInImageData(imageData);
    ctx.restore();
    return { topY: topRowY-fontSizePx, bottomY: bottomRowY-fontSizePx }
  }

  private _findTopRowInImageData(imageData: ImageData): number {
    const rawData = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let offset = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++, offset += 4) {
        if (rawData[offset] !== 0) {
          return y;
        }
      }
    }
    return -1;
  }

  private _findBottomRowInImageData(imageData: ImageData): number {
    const rawData = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let offset = 4 * width * height - 4;
    for (let y = height-1; y >= 0; y--) {
      for (let x = 0; x < width; x++, offset -= 4) {
        if (rawData[offset] !== 0) {
          return y;
        }
      }
    }
    return -1;
  }

}

export function debugFontMetrics(fontMetrics: MonospaceFontMetrics): void {
  log("MonospaceFontMetrics: " + JSON.stringify(fontMetrics, null, "  "));
}

export function dumpFontMetrics(ctx: CanvasRenderingContext2D): void {
  const textString = "ABCXYZabcxyz|-+=[].";

  for (let i=0; i<textString.length; i++) {
    const metrics = ctx.measureText("AAAAA" + textString.charAt(i));
    logFontMetrics(textString.charAt(i), metrics);
  }
}

export function logFontMetrics(c: string, metrics): void {
  log(`${c} is:
  width: ${metrics.width}
  actualBoundingBoxAscent: ${metrics.actualBoundingBoxAscent}
  actualBoundingBoxDescent: ${metrics.actualBoundingBoxDescent}
  actualBoundingBoxLeft: ${metrics.actualBoundingBoxLeft}
  actualBoundingBoxRight: ${metrics.actualBoundingBoxRight}
  alphabeticBaseline: ${metrics.alphabeticBaseline}
  emHeightAscent: ${metrics.emHeightAscent}
  emHeightDescent: ${metrics.emHeightDescent}
  fontBoundingBoxAscent: ${metrics.fontBoundingBoxAscent}
  fontBoundingBoxDescent: ${metrics.fontBoundingBoxDescent}
  hangingBaseline: ${metrics.hangingBaseline}`);
}
