/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_OVERLINE, UNDERLINE_STYLE_NORMAL, UNDERLINE_STYLE_DOUBLE,
  UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-grid";
import { isWide as isFullWidth } from "extraterm-unicode-utilities";
import { select } from "floyd-rivest";

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { Logger, getLogger, log } from "extraterm-logging";
import { isBoxCharacter, drawBoxCharacter } from "./BoxDrawingCharacters";
import { TripleKeyMap } from "extraterm-data-structures";
import { RGBAToCss } from "../RGBAToCss";


const TWO_TO_THE_24 = 2 ** 24;
const FRACTION_CELLS_TO_CLEAR_ON_FLUSH = 0.2;

export interface CachedGlyph {
  xPixels: number;
  yPixels: number;
  widthCells: number;
  widthPx: number;

  key1: number;
  key2: number;
  key3: number;
  atlasX: number;
  atlasY: number;
  lastUse: number;

  fontIndex: number;
}


export abstract class FontAtlasBase<CG extends CachedGlyph> {
  private _log: Logger = null;

  protected _pageCanvas: HTMLCanvasElement = null;
  protected _pageCtx: CanvasRenderingContext2D = null;

  private _atlasWidthInCells: number;
  private _atlasHeightInCells: number;
  private _atlasFlushCellCount: number;

  private _safetyPadding: number = 0;

  private _glyphCellMap: CachedGlyph[][] = null;

  private _monoTime = 1;
  private _nextEmptyCellX: number = 0;
  private _nextEmptyCellY: number = 0;
  private _lookupTable = new TripleKeyMap<number, number, number, CG>();

  constructor(protected readonly _metrics: MonospaceFontMetrics,
      protected readonly _extraFonts: MonospaceFontMetrics[],
      protected readonly _transparentBackground: boolean) {

    this._log = getLogger("FontAtlasPage", this);

    // this._log.debug(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
    this._initialize();
  }

  private _initialize(): void {
    this._atlasWidthInCells = 128;
    this._atlasHeightInCells = 32;
    this._atlasFlushCellCount = Math.floor(this._atlasWidthInCells * this._atlasHeightInCells *
                                  FRACTION_CELLS_TO_CLEAR_ON_FLUSH);

    this._safetyPadding = Math.ceil(Math.max(this._metrics.widthPx, this._metrics.heightPx) / 6);

    this._pageCanvas = document.createElement("canvas");
    this._pageCanvas.width = this._atlasWidthInCells * (this._metrics.widthPx + this._safetyPadding * 2);
    this._pageCanvas.height = this._atlasHeightInCells * (this._metrics.heightPx + this._safetyPadding * 2);

    this._initializeSlots();

    // document.body.appendChild(this._pageCanvas);

    this._pageCtx = this._pageCanvas.getContext("2d", {alpha: this._transparentBackground});
    this._pageCtx.textBaseline = "top";

    this._pageCtx.fillStyle = "#00000000";
    this._pageCtx.fillRect(0, 0, this._pageCanvas.width, this._pageCanvas.height);
    this._pageCtx.fillStyle = "#ffffffff";
  }

  private _initializeSlots(): void {
    const slotsMap: CachedGlyph[][] = [];
    const atlasWidthInCells = this._atlasWidthInCells;
    for (let j=0; j<this._atlasHeightInCells; j++) {
      const slotRow = new Array(atlasWidthInCells);
      for (let i=0; i<atlasWidthInCells; i++) {
        slotRow[i] = null;
      }
      slotsMap.push(slotRow);
    }

    this._glyphCellMap = slotsMap;
  }

  getCanvas(): HTMLCanvasElement {
    return this._pageCanvas;
  }

  getMetrics(): MonospaceFontMetrics {
    return this._metrics;
  }

  getChangeCounter(): number {
    return this._monoTime;
  }

  private _makeLookupKey(codePoint: number, style: StyleCode): number {
    return style * TWO_TO_THE_24 + codePoint;
  }

  protected _getGlyph(codePoint: number, alternateCodePoints: number[], style: StyleCode, fontIndex: number,
      fgRGBA: number, bgRGBA: number): CG {

    let cachedGlyph = this._lookupTable.get(fgRGBA, bgRGBA, this._makeLookupKey(codePoint, style));
    if (cachedGlyph == null) {
      cachedGlyph = this._insertChar(codePoint, alternateCodePoints, style, fontIndex, fgRGBA, bgRGBA);
    }
    cachedGlyph.lastUse = this._monoTime;
    this._monoTime++;
    return cachedGlyph;
  }

  private _insertChar(codePoint: number, alternateCodePoints: number[], style: StyleCode, fontIndex: number,
      fgRGBA: number, bgRGBA: number): CG {

    const widthPx = this._metrics.widthPx;
    let widthInCells = 1;
    if ( ! isBoxCharacter(codePoint)) {
      if (alternateCodePoints == null) {
        widthInCells = isFullWidth(codePoint) ? 2 : 1;
      } else {
        widthInCells = alternateCodePoints.length;
      }
    }

    this._computeNextEmptyCell(widthInCells);

    const xPx = this._nextEmptyCellX * (this._metrics.widthPx + this._safetyPadding*2) + this._safetyPadding;
    const yPx = this._nextEmptyCellY * (this._metrics.heightPx + this._safetyPadding*2) + this._safetyPadding;

    const cachedGlyph = this._insertCharAt(codePoint, alternateCodePoints, style, fontIndex, fgRGBA, bgRGBA, xPx, yPx,
      widthPx, widthInCells);
    cachedGlyph.atlasX = this._nextEmptyCellX;
    cachedGlyph.atlasY = this._nextEmptyCellY;

    const key3 = this._makeLookupKey(codePoint, style);
    cachedGlyph.key1 = fgRGBA;
    cachedGlyph.key2 = bgRGBA;
    cachedGlyph.key3 = key3;
    this._lookupTable.set(fgRGBA, bgRGBA, key3, cachedGlyph);
    for (let i=0; i<widthInCells; i++) {
      this._glyphCellMap[this._nextEmptyCellY][this._nextEmptyCellX + i] = cachedGlyph;
    }
    return cachedGlyph;
  }

  protected _insertCharAt(codePoint: number, alternateCodePoints: number[], style: StyleCode, fontIndex: number,
      fgRGBA: number, bgRGBA: number, xPx: number, yPx: number, widthPx: number, widthInCells: number): CG {

    const ctx = this._pageCtx;

    ctx.save();

    ctx.clearRect(xPx, yPx, widthInCells * this._metrics.widthPx, this._metrics.heightPx);
    ctx.fillStyle = RGBAToCss(bgRGBA);
    ctx.fillRect(xPx, yPx, widthInCells * this._metrics.widthPx, this._metrics.heightPx);

    ctx.globalCompositeOperation = "source-over";
    const fgCSS = RGBAToCss(fgRGBA);
    ctx.fillStyle = fgCSS;
    ctx.strokeStyle = fgCSS;

    if (isBoxCharacter(codePoint)) {
      drawBoxCharacter(ctx, codePoint, xPx, yPx, this._metrics.widthPx, this._metrics.heightPx);
    } else {
      this._drawPlainCharacter(ctx, codePoint, alternateCodePoints, style, fontIndex, xPx, yPx, widthInCells);
    }

    this._drawDecoration(ctx, style, xPx, yPx, widthPx);

    const cachedGlyph = this._createCachedGlyphStruct({
      xPixels: xPx,
      yPixels: yPx,
      widthCells: widthInCells,
      widthPx,

      key1: null,
      key2: null,
      key3: null,
      atlasX: -1,
      atlasY: -1,
      lastUse: 0,
      fontIndex
    });

    this._pageCtx.restore();

    return cachedGlyph;
  }

  private _drawPlainCharacter(ctx: CanvasRenderingContext2D, codePoint: number, alternateCodePoints: number[],
      style: StyleCode, fontIndex: number, xPx: number, yPx: number, widthInCells: number): void {

    let str: string;
    if (alternateCodePoints == null) {
      str = String.fromCodePoint(codePoint);
    } else {
      str = String.fromCodePoint(...alternateCodePoints);
    }

    let styleName = "";
    if (style & STYLE_MASK_BOLD) {
      styleName += "bold ";
    }
    if (style & STYLE_MASK_ITALIC) {
      styleName += "italic ";
    }

    let metrics = this._metrics;
    if (fontIndex !== 0) {
      metrics = this._extraFonts[fontIndex-1];
    }
    ctx.font = styleName + metrics.fontSizePx + "px " + metrics.fontFamily;

    const textXPx = xPx + this._metrics.fillTextXOffset;
    const textYPx = yPx + this._metrics.fillTextYOffset;

    let shrink = false;
    if (widthInCells === 1 && (fontIndex !== 0 || this._isSymbol(codePoint))) {
      // Probe and possibly scale glyphs which fall outside their 1 cell.
      // * Symbols have a habit of being too big even if the font is meant
      //   to be a monospace and the glyph is meant to be just one cell.
      // * Extra fonts often have different width compared to our base font.
      //   We chell all of them.
      const charMetrics = ctx.measureText(str);
      const measuredWidth = charMetrics.actualBoundingBoxRight - charMetrics.actualBoundingBoxLeft;
      if (measuredWidth > 1.25 * this._metrics.widthPx) {
        // We give a 25% leniency to avoid catching glyphs which render
        // slightly outside the cell.
        shrink = true;
      }
    }

    const isItalic = (style & STYLE_MASK_ITALIC) !== 0 && metrics.widthPx !== metrics.boldItalicWidthPx;
    if (isItalic && fontIndex === 0) {
      ctx.save();
      const m = new DOMMatrix();
      m.translateSelf(textXPx, textYPx);
      m.scaleSelf(metrics.widthPx / metrics.boldItalicWidthPx, 1);
      ctx.setTransform(m);
      ctx.fillText(str, 0, 0);
      ctx.restore();
    } else {
      if (! shrink) {
        ctx.fillText(str, textXPx, textYPx);
      } else {

        // Shrink big glyphs by 50%.
        ctx.save();
        const m = new DOMMatrix();
        m.translateSelf(textXPx, textYPx + Math.floor(this._metrics.heightPx/4));
        m.scaleSelf(0.5, 0.5);
        ctx.setTransform(m);
        ctx.fillText(str, 0, 0);
        ctx.restore();
      }
    }
  }

  private _isSymbol(codePoint: number): boolean {
    return  (codePoint >= 0x2000 && codePoint < 0x2c00) || (codePoint & 0x1f000) === 0x1f000;
  }

  private _drawDecoration(ctx: CanvasRenderingContext2D, style: StyleCode, xPx: number, yPx: number,
      widthPx: number): void {

    if (style & STYLE_MASK_STRIKETHROUGH) {
      ctx.fillRect(xPx, yPx + this._metrics.strikethroughY, widthPx, this._metrics.strikethroughHeight);
    }

    const underline = style & STYLE_MASK_UNDERLINE;
    if (underline === UNDERLINE_STYLE_NORMAL || underline === UNDERLINE_STYLE_DOUBLE) {
      ctx.fillRect(xPx, yPx + this._metrics.underlineY, widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_DOUBLE) {
      ctx.fillRect(xPx, yPx + this._metrics.secondUnderlineY, widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_CURLY) {
      ctx.save();
      ctx.lineWidth = this._metrics.curlyThickness;
      ctx.beginPath();
      ctx.moveTo(xPx, yPx+this._metrics.curlyY);
      ctx.quadraticCurveTo(xPx + widthPx/4, yPx+this._metrics.curlyY-this._metrics.curlyHeight/2,
                                      xPx + widthPx/2, yPx+this._metrics.curlyY);
      ctx.quadraticCurveTo(xPx + widthPx*3/4, yPx+this._metrics.curlyY+this._metrics.curlyHeight/2,
                                        xPx + widthPx, yPx+this._metrics.curlyY);
      ctx.stroke();
      ctx.restore();
    }

    if (style & STYLE_MASK_OVERLINE) {
      ctx.fillRect(xPx, yPx + this._metrics.overlineY, widthPx, this._metrics.overlineHeight);
    }
  }

  protected abstract _createCachedGlyphStruct(cg: CachedGlyph): CG;

  private _computeNextEmptyCell(widthInCells: number): void {
    const coord = this._findNextEmptyCell(this._glyphCellMap, this._nextEmptyCellX, this._nextEmptyCellY, widthInCells);
    if (coord != null) {
      this._nextEmptyCellX = coord.x;
      this._nextEmptyCellY = coord.y;
      return;
    }

    this._flushLRU();

    const coord2 = this._findNextEmptyCell(this._glyphCellMap, this._nextEmptyCellX, this._nextEmptyCellY, widthInCells);
    this._nextEmptyCellX = coord2.x;
    this._nextEmptyCellY = coord2.y;
  }

  private _findNextEmptyCell(glyphCellMap: CachedGlyph[][], x: number, y: number, widthInCells: number): {x: number, y: number} {
    for (let j=y; j<this._atlasHeightInCells; j++) {
      for (let i=x; i<this._atlasWidthInCells; i++) {
        if (this._isCellFreeAt(glyphCellMap, i, j, widthInCells)) {
          return {x: i, y: j};
        }
      }
      x = 0;
    }
    return null;
  }

  /**
   * Is there room at a `x`,`y` coord for a cell of `widthInCells` cells wide?
   */
  private _isCellFreeAt(glyphCellMap: CachedGlyph[][], x: number, y: number, widthInCells: number): boolean {
    if (x + widthInCells > this._atlasWidthInCells) {
      return false;
    }
    for (let i=0; i<widthInCells; i++) {
      const cachedGlyph = glyphCellMap[y][x + i];
      if (cachedGlyph != null) {
        return false;
      }
    }
    return true;
  }

  /**
   * Delete the $FLUSH_COUNT oldest glyphs from the atlas.
   */
  private _flushLRU(): void {
    const cachedGlyphsArray = Array.from(this._lookupTable.values());

    const cmp = function(a: CG, b: CG): -1 | 0 | 1 {
      if (a.lastUse === b.lastUse) {
        return 0;
      }
      return a.lastUse < b.lastUse ? -1 : 1;
    };

    const cutOff = select(cachedGlyphsArray, this._atlasFlushCellCount, cmp);
    const cutOffLastUse = cutOff.lastUse;

    for(const cachedGlyph of cachedGlyphsArray) {
      if (cachedGlyph.lastUse <= cutOffLastUse) {
        for (let i=0; i<cachedGlyph.widthCells; i++) {
          this._glyphCellMap[cachedGlyph.atlasY][cachedGlyph.atlasX + i] = null;
        }
        this._lookupTable.delete(cachedGlyph.key1, cachedGlyph.key2, cachedGlyph.key3);
      }
    }

    this._nextEmptyCellX = 0;
    this._nextEmptyCellY = 0;
  }
}

