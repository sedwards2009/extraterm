/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 */

import { QFont, QFontMetrics, QFontWeight } from "@nodegui/nodegui";
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

    const metrics = new QFontMetrics(font);
    const charWidthPx = metrics.horizontalAdvance(sampleChars[0]);
    const charHeightPx = metrics.height();
    // logFontMetrics(sampleChars[0], metrics);

    const underlineHeight = 1;
    let underlineY = 0;
    let secondUnderlineY = 0;
    const mBottomY = metrics.ascent();
    const fillTextYOffset = metrics.ascent();

    const clearanceUnderChar = charHeightPx - Math.round(mBottomY);
    if (clearanceUnderChar < 4) {
      underlineY = Math.round(mBottomY) + 1;
      secondUnderlineY = Math.min(underlineY + 2 * underlineHeight, charHeightPx-1);
    } else {
      underlineY = Math.round(mBottomY) + 2;
      secondUnderlineY = Math.min(underlineY + 2 * underlineHeight, charHeightPx-1);
    }

    let boldItalicWidthPx = charWidthPx;
    const boldFont = new QFont(family);
    boldFont.setPixelSize(sizePx);
    boldFont.setWeight(QFontWeight.Bold);
    const boldMetrics = new QFontMetrics(boldFont);
    for (const sampleChar of sampleChars) {
      const boldCharWidthPx = boldMetrics.horizontalAdvance(sampleChar);
      boldItalicWidthPx = Math.max(boldItalicWidthPx, boldCharWidthPx);
    }

    const curlyThickness = 1;
    const curlyHeight = 4;
    const curlyY = underlineY + curlyHeight/2;
    const mTopY = metrics.ascent() - metrics.xHeight();

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
