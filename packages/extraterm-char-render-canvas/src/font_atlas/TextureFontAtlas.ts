/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 */
import { ArrayKeyTrie } from "extraterm-data-structures";
import { StyleCode } from "extraterm-char-cell-line";
import { CachedGlyph, FontAtlasBase } from "./FontAtlasBase.js";

export interface TextureCachedGlyph extends CachedGlyph {
  textureXpx: number;
  textureX2px: number;
  textureYpx: number;
  textureY2px: number;
}

/**
 * Font Atlas aimed for use as a texture in WebGL.
 */
export class TextureFontAtlas extends FontAtlasBase<TextureCachedGlyph> {

  #proxyCodePointMapping = new ArrayKeyTrie<number>();
  #nextFreeCodePoint = 0x11000000;

  protected _createCachedGlyphStruct(cg: CachedGlyph): TextureCachedGlyph {
    const textureXpx = cg.xPixels / this._pageImageWidth;
    const textureX2px = (cg.xPixels + cg.widthPx) / this._pageImageWidth;
    const textureYpx = cg.yPixels / this._pageImageWidth;
    const textureY2px = (cg.yPixels + this._metrics.heightPx) / this._pageImageWidth;

    return {...cg, textureXpx, textureX2px, textureYpx, textureY2px};
  }

  loadCodePoint(codePoint: number, style: StyleCode, fontIndex: number, fgRGBA: number,
      bgRGBA: number): TextureCachedGlyph {

    return this._getGlyph(codePoint, null, style, fontIndex, fgRGBA, bgRGBA);
  }

  loadCombiningCodePoints(codePoints: number[], style: StyleCode, fontIndex: number, fgRGBA: number,
    bgRGBA: number): TextureCachedGlyph {

    let proxyCodePoint = this.#proxyCodePointMapping.get(codePoints);
    if (proxyCodePoint == null) {
      proxyCodePoint = this.#nextFreeCodePoint;
      this.#nextFreeCodePoint++;
      this.#proxyCodePointMapping.set(codePoints, proxyCodePoint);
    }

    return this._getGlyph(proxyCodePoint, codePoints, style, fontIndex, fgRGBA, bgRGBA);
  }

  getTextureCellWidth(): number {
    return this._metrics.widthPx / this._pageImageWidth;
  }

  getTextureCellHeight(): number {
    return this._metrics.heightPx / this._pageImageHeight;
  }
}
