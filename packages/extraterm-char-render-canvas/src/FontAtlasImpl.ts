/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { ArrayKeyTrie } from "extraterm-array-key-trie";
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_FAINT, STYLE_MASK_OVERLINE, UNDERLINE_STYLE_NORMAL, UNDERLINE_STYLE_DOUBLE,
  UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-grid";
import { isWide as isFullWidth } from "extraterm-unicode-utilities";

import { MonospaceFontMetrics } from "./MonospaceFontMetrics";
import { FontAtlas } from "./FontAtlas";
import { Logger, getLogger, log } from "extraterm-logging";
import { isBoxCharacter, drawBoxCharacter } from "./BoxDrawingCharacters";


const TWO_TO_THE_24 = 2 ** 24;

export class FontAtlasImpl implements FontAtlas {
  private _log: Logger = null;
  private _imageBitmapPages: ImageBitmapFontAtlasPage[] = [];
  private _cpuRenderedPages: CPURenderedFontAtlasPage[] = [];

  constructor(private readonly _metrics: MonospaceFontMetrics) {
    this._log = getLogger("FontAtlasImpl", this);
  }

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode,
                xPixel: number, yPixel: number): void {

    for (let page of this._imageBitmapPages) {
      if (page.drawCodePoint(ctx, codePoint, style, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendImageBitmapPage();
    page.drawCodePoint(ctx, codePoint, style, xPixel, yPixel);
  }

  drawCodePointToImageData(destImageData: ImageData, codePoint: number, style: StyleCode, xPixel: number, yPixel: number): void {
    for (let page of this._cpuRenderedPages) {
      if (page.drawCodePointToImageData(destImageData, codePoint, style, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendCPURenderedPage();
    page.drawCodePointToImageData(destImageData, codePoint, style, xPixel, yPixel);
  }

  drawCodePoints(ctx: CanvasRenderingContext2D, codePoints: number[], style: StyleCode,
    xPixel: number, yPixel: number): void {

    for (let page of this._imageBitmapPages) {
      if (page.drawCodePoints(ctx, codePoints, style, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendImageBitmapPage();
    page.drawCodePoints(ctx, codePoints, style, xPixel, yPixel);
  }

  drawCodePointsToImageData(destImageData: ImageData, codePoints: number[], style: StyleCode, xPixel: number,
      yPixel: number): void {

    for (let page of this._cpuRenderedPages) {
      if (page.drawCodePointsToImageData(destImageData, codePoints, style, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendCPURenderedPage();
    page.drawCodePointsToImageData(destImageData, codePoints, style, xPixel, yPixel);
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

//-------------------------------------------------------------------------

const FONT_ATLAS_PAGE_WIDTH_CELLS = 8;
const FONT_ATLAS_PAGE_HEIGHT_CELLS = 32;


interface CachedGlyph {
  xPixels: number;
  yPixels: number;
  widthCells: number;
  widthPx: number;
}


abstract class FontAtlasPageBase<CG extends CachedGlyph> {
  private _log: Logger = null;

  protected _pageCanvas: HTMLCanvasElement = null;
  protected _pageCtx: CanvasRenderingContext2D = null;
  private _safetyPadding: number = 0;

  private _nextEmptyCellX: number = 0;
  private _nextEmptyCellY: number = 0;
  private _lookupTable: Map<number, CG> = new Map();
  private _isFull = false;

  constructor(protected readonly _metrics: MonospaceFontMetrics) {
    this._log = getLogger("FontAtlasPage", this);

    // this._log.debug(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
    this._initalize();
  }

  private _initalize(): void {
    this._safetyPadding = Math.ceil(Math.max(this._metrics.widthPx, this._metrics.heightPx) /4);

    this._pageCanvas = document.createElement("canvas");
    this._pageCanvas.width = FONT_ATLAS_PAGE_WIDTH_CELLS * (this._metrics.widthPx + this._safetyPadding * 2);
    this._pageCanvas.height = FONT_ATLAS_PAGE_HEIGHT_CELLS * (this._metrics.heightPx + this._safetyPadding * 2);
  
    // document.body.appendChild(this._pageCanvas);

    this._pageCtx = this._pageCanvas.getContext("2d");
    this._pageCtx.textBaseline = "top";

    this._pageCtx.fillStyle = "#00000000";
    this._pageCtx.fillRect(0, 0, this._pageCanvas.width, this._pageCanvas.height);
    this._pageCtx.fillStyle = "#ffffffff";
  }

  getCanvas(): HTMLCanvasElement {
    return this._pageCanvas;
  }

  private _makeLookupKey(codePoint: number, style: StyleCode): number {
    return style * TWO_TO_THE_24 + codePoint;
  }

  protected _getGlyph(codePoint: number, alternateCodePoints: number[], style: StyleCode): CG {
    let cachedGlyph = this._lookupTable.get(this._makeLookupKey(codePoint, style));
    if (cachedGlyph != null) {
      return cachedGlyph;
    }
    if (this._isFull) {
      return null;
    }
    return this._insertChar(codePoint, alternateCodePoints, style);
  }
  
  protected _insertChar(codePoint: number, alternateCodePoints: number[], style: StyleCode): CG {
    const xPixels = this._nextEmptyCellX * (this._metrics.widthPx + this._safetyPadding*2) + this._safetyPadding;
    const yPixels = this._nextEmptyCellY * (this._metrics.heightPx + this._safetyPadding*2) + this._safetyPadding;

    this._pageCtx.save();
    if (style & STYLE_MASK_FAINT) {
      this._pageCtx.fillStyle = "#ffffff80";
    }

    let widthPx = this._metrics.widthPx;
    let widthInCells = 1;
    if (isBoxCharacter(codePoint)) {
      drawBoxCharacter(this._pageCtx, codePoint, xPixels, yPixels, this._metrics.widthPx, this._metrics.heightPx);
    } else {
      let str: string;
      if (alternateCodePoints == null) {
        str = String.fromCodePoint(codePoint);
        widthInCells = isFullWidth(codePoint) ? 2 : 1;
      } else {
        str = String.fromCodePoint(...alternateCodePoints);
        widthInCells = alternateCodePoints.length;
      }

      widthPx = widthInCells * this._metrics.widthPx;

      let styleName = "";
      if (style & STYLE_MASK_BOLD) {
        styleName += "bold ";
      }
      if (style & STYLE_MASK_ITALIC) {
        styleName += "italic ";
      }

      this._pageCtx.font = styleName + this._metrics.fontSizePx + "px " + this._metrics.fontFamily;
      this._pageCtx.fillText(str, xPixels + this._metrics.fillTextXOffset, yPixels + this._metrics.fillTextYOffset);
    }

    if (style & STYLE_MASK_STRIKETHROUGH) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.strikethroughY,
                              widthPx, this._metrics.strikethroughHeight);
    }

    const underline = style & STYLE_MASK_UNDERLINE;
    if (underline === UNDERLINE_STYLE_NORMAL || underline === UNDERLINE_STYLE_DOUBLE) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.underlineY,
                              widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_DOUBLE) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.secondUnderlineY,
                              widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_CURLY) {
      this._pageCtx.save();
      this._pageCtx.lineWidth = this._metrics.curlyThickness;
      this._pageCtx.beginPath();
      this._pageCtx.moveTo(xPixels, yPixels+this._metrics.curlyY);
      this._pageCtx.quadraticCurveTo(xPixels + widthPx/4, yPixels+this._metrics.curlyY-this._metrics.curlyHeight/2,
                                      xPixels + widthPx/2, yPixels+this._metrics.curlyY);
      this._pageCtx.quadraticCurveTo(xPixels + widthPx*3/4, yPixels+this._metrics.curlyY+this._metrics.curlyHeight/2,
                                        xPixels + widthPx, yPixels+this._metrics.curlyY);
      this._pageCtx.stroke();
      this._pageCtx.restore();
    }

    if (style & STYLE_MASK_OVERLINE) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.overlineY,
                              widthPx, this._metrics.overlineHeight);
    }

    const cachedGlyph = this._createCachedGlyphStruct({
      xPixels,
      yPixels,
      widthCells: widthInCells,
      widthPx,
    });

    this._lookupTable.set(this._makeLookupKey(codePoint, style), cachedGlyph);

    for (let i=0; i<widthInCells; i++) {
      this._incrementNextEmptyCell();
    }
    
    this._pageCtx.restore();
    return cachedGlyph;
  }

  protected abstract _createCachedGlyphStruct(cg: CachedGlyph): CG;

  private _incrementNextEmptyCell(): void {
    this._nextEmptyCellX++;
    if (this._nextEmptyCellX >= (FONT_ATLAS_PAGE_WIDTH_CELLS -1)) {
      this._nextEmptyCellX = 0;
      this._nextEmptyCellY++;
      if (this._nextEmptyCellY >= FONT_ATLAS_PAGE_HEIGHT_CELLS) {
        this._isFull = true;
      }
    }
  }
}

//-------------------------------------------------------------------------
interface ImageBitmapCachedGlyph extends CachedGlyph {
  imageBitmapPromise: Promise<ImageBitmap>;
  imageBitmap: ImageBitmap;
}

/**
 * Font atlas based glyph renderer which uses ImageBitmap and related
 * graphics APIs to copy glyphs into a target canvas.
 */
class ImageBitmapFontAtlasPage extends FontAtlasPageBase<ImageBitmapCachedGlyph> {

  protected _createCachedGlyphStruct(cg: CachedGlyph): ImageBitmapCachedGlyph {
    return { ...cg, imageBitmapPromise: null, imageBitmap: null };
  }

  protected _insertChar(codePoint: number, alternateCodePoints: number[], style: StyleCode): ImageBitmapCachedGlyph {
    const cg = super._insertChar(codePoint, alternateCodePoints, style);

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

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode, xPixel: number,
      yPixel: number): boolean {

    const cachedGlyph = this._getGlyph(codePoint, null, style);
    if (cachedGlyph === null) {
      return false;
    }
    this._drawCachedGlyph(ctx, cachedGlyph, xPixel, yPixel);
    return true;
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

  drawCodePoints(ctx: CanvasRenderingContext2D, codePoints: number[], style: StyleCode, xPixel: number,
    yPixel: number): boolean {
return false;
    }
}

//-------------------------------------------------------------------------
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
class CPURenderedFontAtlasPage extends FontAtlasPageBase<CPURenderedCachedGlyph> {

  private _proxyCodePointMapping = new ArrayKeyTrie<number, number>();  
  private _nextFreeCodePoint = 0x11000000;

  protected _createCachedGlyphStruct(cg: CachedGlyph): CPURenderedCachedGlyph {
    return { ...cg, imageData: null };
  }

  protected _insertChar(codePoint: number, alternateCodePoints: number[], style: StyleCode): CPURenderedCachedGlyph {
    const cg = super._insertChar(codePoint, alternateCodePoints, style);
    cg.imageData = this._pageCtx.getImageData(cg.xPixels, cg.yPixels, cg.widthPx, this._metrics.heightPx)
    return cg;
  }

  drawCodePointToImageData(destImageData: ImageData, codePoint: number, style: StyleCode, xPixel: number,
      yPixel: number): boolean {

    const cachedGlyph = this._getGlyph(codePoint, null, style);
    if (cachedGlyph === null) {
      return false;
    }

    this._drawCachedGlyph(destImageData, cachedGlyph, xPixel, yPixel);
    return true;
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
        destOffset++
        glyphOffset++

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++
        glyphOffset++

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++
        glyphOffset++

        destData[destOffset] = glyphData[glyphOffset];
        destOffset++
        glyphOffset++
      }
      glyphOffset += glyphRowStride;
    }
  }

  drawCodePointsToImageData(destImageData: ImageData, codePoints: number[], style: StyleCode, xPixel: number,
        yPixel: number): boolean {

      let proxyCodePoint = this._proxyCodePointMapping.get(codePoints);
      if (proxyCodePoint == null) {
        proxyCodePoint = this._nextFreeCodePoint;
        this._nextFreeCodePoint++;
        this._proxyCodePointMapping.insert(codePoints, proxyCodePoint);
      }

      const cachedGlyph = this._getGlyph(proxyCodePoint, codePoints, style);
      if (cachedGlyph === null) {
        return false;
      }
  
      this._drawCachedGlyph(destImageData, cachedGlyph, xPixel, yPixel);
      return true;
  }
}
