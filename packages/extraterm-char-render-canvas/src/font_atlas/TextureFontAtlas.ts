/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { ArrayKeyTrie } from "extraterm-array-key-trie";
import { StyleCode } from "extraterm-char-cell-grid";
import { CachedGlyph, FontAtlasBase } from "./FontAtlasBase";

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

  private _proxyCodePointMapping = new ArrayKeyTrie<number>();
  private _nextFreeCodePoint = 0x11000000;

  protected _createCachedGlyphStruct(cg: CachedGlyph): TextureCachedGlyph {
    const canvasWidth = this._pageCanvas.width;
    const canvasHeight = this._pageCanvas.height;

    const textureXpx = cg.xPixels / canvasWidth;
    const textureX2px = (cg.xPixels + cg.widthPx) / canvasWidth;
    const textureYpx = cg.yPixels / canvasHeight;
    const textureY2px = (cg.yPixels + this._metrics.heightPx) / canvasHeight;

    return {...cg, textureXpx, textureX2px, textureYpx, textureY2px};
  }

  loadCodePoint(codePoint: number, style: StyleCode, fontIndex: number, fgRGBA: number,
      bgRGBA: number): TextureCachedGlyph {

    return this._getGlyph(codePoint, null, style, fontIndex, fgRGBA, bgRGBA);
  }

  loadCombiningCodePoints(codePoints: number[], style: StyleCode, fontIndex: number, fgRGBA: number,
    bgRGBA: number): TextureCachedGlyph {

    let proxyCodePoint = this._proxyCodePointMapping.get(codePoints);
    if (proxyCodePoint == null) {
      proxyCodePoint = this._nextFreeCodePoint;
      this._nextFreeCodePoint++;
      this._proxyCodePointMapping.set(codePoints, proxyCodePoint);
    }

    return this._getGlyph(proxyCodePoint, codePoints, style, fontIndex, fgRGBA, bgRGBA);
  }

  getTextureCellWidth(): number {
    const canvasWidth = this._pageCanvas.width;
    return this._metrics.widthPx / canvasWidth;
  }

  getTextureCellHeight(): number {
    const canvasHeight = this._pageCanvas.height;
    return this._metrics.heightPx / canvasHeight;
  }
}
