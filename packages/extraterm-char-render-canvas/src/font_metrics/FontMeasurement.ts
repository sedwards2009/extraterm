/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 */

import { QFont, QFontMetricsF, QFontWeight } from "@nodegui/nodegui";
import { MonospaceFontMetrics } from "./MonospaceFontMetrics";
import { Logger, getLogger, log } from "extraterm-logging";

const computeFontMetricsCache = new Map<string, MonospaceFontMetrics>();


export function computeFontMetrics(fontFamily: string, fontStyle: string, fontSizePx: number, sampleChars: string[]=null): MonospaceFontMetrics {
  const cacheKey = `${fontFamily};${fontSizePx};${sampleChars == null ? "" : sampleChars.join("")}`;

  let metrics = computeFontMetricsCache.get(cacheKey);
  if (metrics != null) {
    return metrics;
  }

  const fm = new FontMeasurement();
  metrics = fm.computeFontMetrics({ family: fontFamily, style: fontStyle, sizePx: fontSizePx, sampleChars });
  computeFontMetricsCache.set(cacheKey, metrics);
  return metrics;
}

export function computeEmojiMetrics(metrics: MonospaceFontMetrics, fontFamily: string,
    fontSizePx: number): MonospaceFontMetrics {

  const customMetrics = {
    ...metrics,
    fontFamily: fontFamily,
    fontSizePx: fontSizePx,
  };
  const actualFontMetrics = computeFontMetrics(fontFamily, "", fontSizePx, ["\u{1f600}"]  /* Smile emoji */);
  customMetrics.fontSizePx = actualFontMetrics.fontSizePx;
  customMetrics.fillTextYOffset = actualFontMetrics.fillTextYOffset;

  return customMetrics;
}


interface ComputeFontMetricsOptions {
  family: string;
  style: string;
  sizePx: number;
  sampleChars?: string[];
}

class FontMeasurement {
  private _log: Logger = null;

  constructor() {
    this._log = getLogger("FontMeasurement", this);
  }

  computeFontMetrics(options: ComputeFontMetricsOptions): MonospaceFontMetrics {
    let { family, sizePx, style, sampleChars }  = options;

    if (sampleChars == null) {
      sampleChars = ["X", "W", "_", "g", "\u00C5", "\u00E7", "\u014A", "\u013B","\u0141", "\u0126"];
    }

    const font = new QFont(family);
    font.setStyleName(style);
    font.setPixelSize(sizePx);

    const metrics = new QFontMetricsF(font);
    const charWidthPx = this.#computeMaxCharWidthPx(metrics, sampleChars);
    const charHeightPx = Math.ceil(metrics.height());
    // logFontMetrics(sampleChars[0], metrics);

    const underlineHeight = 1;
    let underlineY = 0;
    let secondUnderlineY = 0;
    const mBottomY = Math.ceil(metrics.ascent());
    const fillTextYOffset = Math.ceil(metrics.ascent());

    const clearanceUnderChar = charHeightPx - Math.round(mBottomY);
    if (clearanceUnderChar < 4) {
      underlineY = Math.round(mBottomY) + 1;
      secondUnderlineY = Math.min(underlineY + 2 * underlineHeight, charHeightPx-1);
    } else {
      underlineY = Math.round(mBottomY) + 2;
      secondUnderlineY = Math.min(underlineY + 2 * underlineHeight, charHeightPx-1);
    }

    const boldFont = new QFont(family);
    boldFont.setPixelSize(sizePx);
    boldFont.setWeight(QFontWeight.Bold);
    const boldMetrics = new QFontMetricsF(boldFont);
    const boldItalicWidthPx = this.#computeMaxCharWidthPx(boldMetrics, sampleChars);

    const curlyThickness = 1;
    const curlyHeight = 4;
    const curlyY = underlineY + curlyHeight/2;
    const mTopY = Math.ceil(metrics.ascent() - metrics.xHeight());

    return {
      fontSizePx: sizePx,
      fontFamily: family,

      widthPx: charWidthPx,
      heightPx: charHeightPx,
      boldItalicWidthPx,

      fillTextYOffset,
      fillTextXOffset: 0,

      strikethroughY: Math.round((mTopY + mBottomY) /2),
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

  #computeMaxCharWidthPx(metrics: QFontMetricsF, sampleChars: string[]): number {
    let maxWidthPx = 0;
    for (const sampleChar of sampleChars) {
      const widthPx = Math.ceil(metrics.boundingRect(sampleChar).width());
      maxWidthPx = Math.max(maxWidthPx, widthPx);
    }
    return maxWidthPx;
  }
}

export function debugFontMetrics(fontMetrics: MonospaceFontMetrics): void {
  getLogger("debugFontMetrics()").debug("MonospaceFontMetrics: " + JSON.stringify(fontMetrics, null, "  "));
}

// export function logFontMetrics(c: string, metrics): void {
//   getLogger("logFontMetrics()").debug(`${c} is:
//   width: ${metrics.width}
//   actualBoundingBoxAscent: ${metrics.actualBoundingBoxAscent}
//   actualBoundingBoxDescent: ${metrics.actualBoundingBoxDescent}
//   actualBoundingBoxLeft: ${metrics.actualBoundingBoxLeft}
//   actualBoundingBoxRight: ${metrics.actualBoundingBoxRight}
//   alphabeticBaseline: ${metrics.alphabeticBaseline}
//   emHeightAscent: ${metrics.emHeightAscent}
//   emHeightDescent: ${metrics.emHeightDescent}
//   fontBoundingBoxAscent: ${metrics.fontBoundingBoxAscent}
//   fontBoundingBoxDescent: ${metrics.fontBoundingBoxDescent}
//   hangingBaseline: ${metrics.hangingBaseline}`);
// }
