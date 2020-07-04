/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { CachedGlyph, FontAtlasBase } from "./FontAtlasBase";
import { StyleCode } from "extraterm-char-cell-grid";


interface ImageBitmapCachedGlyph extends CachedGlyph {
  imageBitmapPromise: Promise<ImageBitmap>;
  imageBitmap: ImageBitmap;
}

/**
 * Font atlas based glyph renderer which uses ImageBitmap and related
 * graphics APIs to copy glyphs into a target canvas.
 */
export class ImageBitmapFontAtlas extends FontAtlasBase<ImageBitmapCachedGlyph> {

  protected _createCachedGlyphStruct(cg: CachedGlyph): ImageBitmapCachedGlyph {
    return { ...cg, imageBitmapPromise: null, imageBitmap: null };
  }

  protected _insertCharAt(codePoint: number, alternateCodePoints: number[], style: StyleCode, fgRGBA: number,
      bgRGBA: number, xPixels: number, yPixels: number, widthPx: number, widthInCells: number): ImageBitmapCachedGlyph {
    const cg = super._insertCharAt(codePoint, alternateCodePoints, style, fgRGBA, bgRGBA, xPixels, yPixels, widthPx, widthInCells);

    // ImageBitmaps are meant to be much fast to paint with compared to normal canvas.
    const promise = window.createImageBitmap(this._pageCanvas, cg.xPixels, cg.yPixels, cg.widthPx,
                                              this._metrics.heightPx);
    cg.imageBitmapPromise = promise;
    promise.then((imageBitmap: ImageBitmap) => {
      cg.imageBitmap = imageBitmap;
      cg.imageBitmapPromise = null;
    });

    return cg;
  }

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode, fgRGBA: number, bgRGBA: number,
      xPixel: number, yPixel: number): void {

    const cachedGlyph = this._getGlyph(codePoint, null, style, fgRGBA, bgRGBA);
    this._drawCachedGlyph(ctx, cachedGlyph, xPixel, yPixel);
  }

  private _drawCachedGlyph(ctx: CanvasRenderingContext2D, cachedGlyph: ImageBitmapCachedGlyph, xPixel: number,
      yPixel: number): void {

    const widthPx = cachedGlyph.widthCells * this._metrics.widthPx;

    ctx.save();
    ctx.beginPath();
    ctx.rect(xPixel, yPixel, widthPx, this._metrics.heightPx);
    ctx.clip();

    if (cachedGlyph.imageBitmap != null) {
      // Fast version
      ctx.drawImage(cachedGlyph.imageBitmap,
        0, 0,                             // Source location
        widthPx, this._metrics.heightPx,  // Size
        xPixel, yPixel,                   // Dest location
        widthPx, this._metrics.heightPx); // Size

    } else {
      // Slow canvas version for when the ImageBitmap isn't ready yet.
      ctx.drawImage(this._pageCanvas,
                    cachedGlyph.xPixels, cachedGlyph.yPixels,   // Source location
                    widthPx, this._metrics.heightPx,  // Size
                    xPixel, yPixel,                                 // Dest location
                    widthPx, this._metrics.heightPx); // Size
    }
    ctx.restore();
  }
}
