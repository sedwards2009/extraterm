/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { CachedGlyph, FontAtlasBase } from "./FontAtlasBase";
import { ArrayKeyTrie } from "extraterm-array-key-trie";
import { StyleCode } from "extraterm-char-cell-grid";

interface CPURenderedCachedGlyph extends CachedGlyph {
  imageData: ImageData;
}

/**
 * Font atlas based glyph renderer which uses the CPU to copy glyphs into a
 * target ImageData object.
 *
 * This renderer is based around pushing bytes using the CPU only. It doesn't
 * incur the overhead of the graphics APIs and for large numbers of small
 * glyphs it can be significantly faster.
 */
export class CPURenderedFontAtlas extends FontAtlasBase<CPURenderedCachedGlyph> {

  private _proxyCodePointMapping = new ArrayKeyTrie<number>();
  private _nextFreeCodePoint = 0x11000000;

  protected _createCachedGlyphStruct(cg: CachedGlyph): CPURenderedCachedGlyph {
    return { ...cg, imageData: null };
  }

  protected _insertCharAt(codePoint: number, alternateCodePoints: number[], style: StyleCode, fgRGBA: number,
      bgRGBA: number, xPixels: number, yPixels: number, widthPx: number, widthInCells: number): CPURenderedCachedGlyph {

    const cg = super._insertCharAt(codePoint, alternateCodePoints, style, fgRGBA, bgRGBA, xPixels, yPixels, widthPx,
      widthInCells);
    cg.imageData = this._pageCtx.getImageData(cg.xPixels, cg.yPixels, cg.widthPx, this._metrics.heightPx);
    return cg;
  }

  drawCodePointToImageData(destImageData: ImageData, codePoint: number, style: StyleCode,  fgRGBA: number,
      bgRGBA: number, xPixel: number, yPixel: number): void {

    const cachedGlyph = this._getGlyph(codePoint, null, style, fgRGBA, bgRGBA);
    this._drawCachedGlyph(destImageData, cachedGlyph, xPixel, yPixel);
  }

  private _drawCachedGlyph(destImageData: ImageData, cachedGlyph: CPURenderedCachedGlyph, xPixel: number,
      yPixel: number): void {

    const glyphWidthPx = cachedGlyph.widthCells * this._metrics.widthPx;

    let glyphRowStride = 0;
    let widthPx = glyphWidthPx;

    // Clip the right edge of the glyph. This shouldn't be needed most of the time, but it is possible
    // that a multi-cell wide glyph is positioned at the far right side of the `destImageData`.
    if (glyphWidthPx + xPixel > destImageData.width) {
      widthPx = destImageData.width - xPixel;
      glyphRowStride = (glyphWidthPx - widthPx) * 4;
    }

    const heightPx = this._metrics.heightPx;

    const destData = destImageData.data;
    const glyphData = cachedGlyph.imageData.data;

    // Manually copy the image data across
    let glyphOffset = 0;

    for (let y=0; y<heightPx; y++) {

      let destOffset = ((yPixel+y) * destImageData.width + xPixel) * 4;
      for (let x=0; x<widthPx; x++) {
        destData[destOffset] = glyphData[glyphOffset];
        destOffset++;
        glyphOffset++;

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++;
        glyphOffset++;

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++;
        glyphOffset++;

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++;
        glyphOffset++;
      }
      glyphOffset += glyphRowStride;
    }
  }

  drawCodePointsToImageData(destImageData: ImageData, codePoints: number[], style: StyleCode,  fgRGBA: number,
        bgRGBA: number, xPixel: number, yPixel: number): void {

    let proxyCodePoint = this._proxyCodePointMapping.get(codePoints);
    if (proxyCodePoint == null) {
      proxyCodePoint = this._nextFreeCodePoint;
      this._nextFreeCodePoint++;
      this._proxyCodePointMapping.set(codePoints, proxyCodePoint);
    }

    const cachedGlyph = this._getGlyph(proxyCodePoint, codePoints, style, fgRGBA, bgRGBA);
    this._drawCachedGlyph(destImageData, cachedGlyph, xPixel, yPixel);
  }
}
