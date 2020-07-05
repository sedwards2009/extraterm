/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { CachedGlyph, FontAtlasBase } from "./FontAtlasBase";
import { StyleCode } from "extraterm-char-cell-grid";

interface TextureCachedGlyph extends CachedGlyph {
  textureXpx: number;
  textureX2px: number;
  textureYpx: number;
  textureY2px: number;
}

/**
 */
export class TextureFontAtlas extends FontAtlasBase<TextureCachedGlyph> {

  protected _createCachedGlyphStruct(cg: CachedGlyph): TextureCachedGlyph {
    const canvasWidth = this._pageCanvas.width;
    const canvasHeight = this._pageCanvas.height;

    const textureXpx = cg.xPixels / canvasWidth;
    const textureX2px = (cg.xPixels + cg.widthPx) / canvasWidth;
    const textureYpx = cg.yPixels / canvasHeight;
    const textureY2px = (cg.yPixels + this._metrics.heightPx) / canvasHeight;

    return {...cg, textureXpx, textureX2px, textureYpx, textureY2px};
  }

  loadCodePoint(codePoint: number, style: StyleCode, fgRGBA: number, bgRGBA: number): TextureCachedGlyph {
    return this._getGlyph(codePoint, null, style, fgRGBA, bgRGBA);
  }
}
