/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { MonospaceFontMetrics } from "./MonospaceFontMetrics";
import { Logger, getLogger, log } from "extraterm-logging";

const computeFontMetricsCache = new Map<string, MonospaceFontMetrics>();
const computeDpiFontMetricsCache = new Map<string, { renderFontMetrics: MonospaceFontMetrics, cssFontMetrics: MonospaceFontMetrics }>();


export function computeFontMetrics(fontFamily: string, fontSizePx: number, sampleChars: string[]=null): MonospaceFontMetrics {
  const cacheKey = `${fontFamily};${fontSizePx};${sampleChars == null ? "" : sampleChars.join("")}`;

  let metrics = computeFontMetricsCache.get(cacheKey);
  if (metrics != null) {
    return metrics;
  }

  const fm = new FontMeasurement();
  metrics = fm.computeFontMetrics({ family: fontFamily, sizePx: fontSizePx, sampleChars });

  computeFontMetricsCache.set(cacheKey, metrics);
  return metrics;
}

export function computeDpiFontMetrics(fontFamily: string, fontSizePx: number, devicePixelRatio: number,
    sampleChars: string[]=null): { renderFontMetrics: MonospaceFontMetrics, cssFontMetrics: MonospaceFontMetrics } {

  const cacheKey = `${fontFamily};${fontSizePx};${devicePixelRatio};${sampleChars == null ? "" : sampleChars.join("")}`;
  let metrics = computeDpiFontMetricsCache.get(cacheKey);
  if (metrics != null) {
    return metrics;
  }

  const fm = new FontMeasurement();
  const renderFontSizePx = fontSizePx * devicePixelRatio;
  const renderFontMetrics = fm.computeFontMetrics({ family: fontFamily, sizePx: renderFontSizePx, sampleChars });

  const cssFontMetrics: MonospaceFontMetrics = {
    fontSizePx: renderFontMetrics.fontSizePx / devicePixelRatio,
    fontFamily,

    fillTextYOffset: renderFontMetrics.fillTextYOffset / devicePixelRatio,
    fillTextXOffset: renderFontMetrics.fillTextYOffset / devicePixelRatio,

    widthPx: renderFontMetrics.widthPx / devicePixelRatio,
    heightPx: renderFontMetrics.heightPx / devicePixelRatio,
    boldItalicWidthPx: renderFontMetrics.boldItalicWidthPx / devicePixelRatio,

    strikethroughY: renderFontMetrics.strikethroughY / devicePixelRatio,
    strikethroughHeight: renderFontMetrics.strikethroughHeight / devicePixelRatio,
    underlineY: renderFontMetrics.underlineY / devicePixelRatio,
    secondUnderlineY: renderFontMetrics.secondUnderlineY / devicePixelRatio,
    underlineHeight: renderFontMetrics.underlineHeight / devicePixelRatio,

    overlineY: renderFontMetrics.overlineY / devicePixelRatio,
    overlineHeight: renderFontMetrics.overlineHeight / devicePixelRatio,

    curlyHeight: renderFontMetrics.curlyHeight / devicePixelRatio,
    curlyThickness: renderFontMetrics.curlyThickness / devicePixelRatio,
    curlyY: renderFontMetrics.curlyY / devicePixelRatio,
  };

  metrics = {
    renderFontMetrics,
    cssFontMetrics,
  };

  computeDpiFontMetricsCache.set(cacheKey, metrics);
  return metrics;
}

interface TextMeasurements {
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
}

interface ComputeFontMetricsOptions {
  family: string;
  sizePx: number;
  sampleChars?: string[];
}

class FontMeasurement {
  private _log: Logger = null;
  private _canvasWidthPx = 250;
  private _canvasHeightPx = 250;

  constructor() {
    this._log = getLogger("FontMeasurement", this);
  }

  computeFontMetrics(options: ComputeFontMetricsOptions): MonospaceFontMetrics {
    const { family, sizePx } = options;
    let { sampleChars }  = options;

    if (sampleChars == null) {
      sampleChars = ["X", "W", "_", "g", "\u00C5", "\u00E7", "\u014A", "\u013B","\u0141", "\u0126"];
    }

    const canvas = <HTMLCanvasElement> document.createElement("canvas");

    this._canvasWidthPx = Math.ceil(sizePx * 3);
    this._canvasHeightPx = Math.ceil(sizePx * 3);
    canvas.width = this._canvasWidthPx;
    canvas.height = this._canvasHeightPx;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.font = "" + sizePx + "px " + family;
    ctx.textBaseline = "top";

    // Note: most of the properties on a TextMetrics object are behind Blink's experimental flag. 1/5/2019
    const metrics = ctx.measureText(sampleChars[0]);
    // logFontMetrics(sampleChars[0], metrics);
    const charWidthPx = Math.ceil(metrics.width);

    const metricsAscent = metrics.fontBoundingBoxAscent === undefined ? metrics.actualBoundingBoxAscent : metrics.fontBoundingBoxAscent;
    const metricsDescent = metrics.fontBoundingBoxDescent === undefined ? metrics.actualBoundingBoxDescent : metrics.fontBoundingBoxDescent;

    let ascent = Math.floor(-metricsAscent);
    let descent = Math.ceil(metricsDescent);
    for (const sampleChar of sampleChars) {
      const { topY, bottomY } = this._renderAndMeasureText(ctx, sizePx, sampleChar);
      ascent = Math.min(ascent, topY);
      descent = Math.max(descent, bottomY+1);
    }

    let boldItalicWidthPx = charWidthPx;
    ctx.font = "bold italic " + sizePx + "px " + family;
    for (const sampleChar of sampleChars) {
      const { leftX, rightX } = this._renderAndMeasureText(ctx, sizePx, sampleChar);
      boldItalicWidthPx = Math.max(boldItalicWidthPx, rightX - leftX);
    }
    this._log.debug(`reported with: ${charWidthPx}, boldItalicWidthPx: ${boldItalicWidthPx}`);

    const fillTextYOffset = -ascent;
    const charHeightPx = descent - ascent;

    // this._log.debug(`charWidthPx: ${charWidthPx }, charHeightPx: ${charHeightPx}, fillTextYOffset: ${fillTextYOffset}`);

    // Used for the strike through and underline Y positions.
    const {topY: mTopY, bottomY: mBottomY} = this._renderAndMeasureText(ctx, sizePx, "m");
    // this._log.debug(`m: topY: ${mTopY}, bottomY: ${mBottomY}`);

    const underlineHeight = 1;
    const underlineY = Math.round(mBottomY + 2) + fillTextYOffset;
    const secondUnderlineY = underlineY + 2 * underlineHeight;

    const curlyThickness = 1;
    const curlyHeight = 4;
    const curlyY = underlineY + curlyHeight/2;

    return {
      fontSizePx: sizePx,
      fontFamily: family,

      widthPx: charWidthPx,
      heightPx: charHeightPx,
      boldItalicWidthPx,
  
      fillTextYOffset,
      fillTextXOffset: 0,

      strikethroughY: Math.round((mTopY + mBottomY) /2) + fillTextYOffset,
      strikethroughHeight: 1,
      underlineY,
      secondUnderlineY,
      underlineHeight,

      overlineY: 0,
      overlineHeight: 1,

      curlyHeight,
      curlyThickness,
      curlyY,
    };
  }

  private _renderAndMeasureText(ctx: CanvasRenderingContext2D, fontSizePx: number, text: string): TextMeasurements {
    ctx.save();

    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, this._canvasWidthPx, this._canvasHeightPx);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffffff";

    const textXY = Math.ceil(fontSizePx);
    ctx.fillText(text, textXY, textXY);

    const imageData = ctx.getImageData(0, 0, fontSizePx * 3, fontSizePx * 3);
    const topRowY = this._findTopRowInImageData(imageData);
    const bottomRowY = this._findBottomRowInImageData(imageData);
    const leftX = this._findLeftColumnInImageData(imageData);
    const rightX = this._findRightColumnInImageData(imageData);
    ctx.restore();
    return { topY: topRowY-textXY, bottomY: bottomRowY-textXY, leftX, rightX };
  }

  private _findTopRowInImageData(imageData: ImageData): number {
    const height = imageData.height;
    for (let y = 0; y < height; y++) {
      if ( ! this._isRowBlack(imageData, y)) {
        return y;
      }
    }
    return -1;
  }

  private _findBottomRowInImageData(imageData: ImageData): number {
    const height = imageData.height;
    for (let y = height-1; y >= 0; y--) {
      if ( ! this._isRowBlack(imageData, y)) {
        return y;
      }
    }
    return -1;
  }

  private _isRowBlack(imageData: ImageData, row: number): boolean {
    const rawData = imageData.data;
    const width = imageData.width;
    let offset = 4 * width * row;
    for (let x = 0; x < width; x++, offset += 4) {
      if (rawData[offset] !== 0) {
        return false;
      }
    }
    return true;
  }

  private _findLeftColumnInImageData(imageData: ImageData): number {
    const width = imageData.width;
    for (let x = 0; x < width; x++) {
      if ( ! this._isColumnBlack(imageData, x)) {
        return x;
      }
    }
    return -1;
  }

  private _findRightColumnInImageData(imageData: ImageData): number {
    const width = imageData.width;
    for (let x = width-1; x >= 0; x--) {
      if ( ! this._isColumnBlack(imageData, x)) {
        return x;
      }
    }
    return -1;
  }

  private _isColumnBlack(imageData: ImageData, column: number): boolean {
    const rawData = imageData.data;
    const height = imageData.height;
    const width = imageData.width;
    for (let y = 0; y < height; y++) {
      const offset = 4 * (y * width + column);
      if (rawData[offset] !== 0) {
        return false;
      }
    }
    return true;
  }
}

export function debugFontMetrics(fontMetrics: MonospaceFontMetrics): void {
  getLogger("debugFontMetrics()").debug("MonospaceFontMetrics: " + JSON.stringify(fontMetrics, null, "  "));
}

export function dumpFontMetrics(ctx: CanvasRenderingContext2D): void {
  const textString = "ABCXYZabcxyz|-+=[].";

  for (let i=0; i<textString.length; i++) {
    const metrics = ctx.measureText("AAAAA" + textString.charAt(i));
    logFontMetrics(textString.charAt(i), metrics);
  }
}

export function logFontMetrics(c: string, metrics): void {
  getLogger("logFontMetrics()").debug(`${c} is:
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
