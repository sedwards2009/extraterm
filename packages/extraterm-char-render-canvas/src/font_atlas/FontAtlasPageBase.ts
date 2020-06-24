/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_FAINT, STYLE_MASK_OVERLINE, UNDERLINE_STYLE_NORMAL, UNDERLINE_STYLE_DOUBLE,
  UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-grid";
import { isWide as isFullWidth } from "extraterm-unicode-utilities";
import { select } from "floyd-rivest";

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { Logger, getLogger, log } from "extraterm-logging";
import { isBoxCharacter, drawBoxCharacter } from "./BoxDrawingCharacters";


const TWO_TO_THE_24 = 2 ** 24;

export interface CachedGlyph {
  xPixels: number;
  yPixels: number;
  widthCells: number;
  widthPx: number;

  key: number;
  atlasX: number;
  atlasY: number;
  lastUse: number;
}


export abstract class FontAtlasPageBase<CG extends CachedGlyph> {
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
  private _lookupTable: Map<number, CG> = new Map();

  constructor(protected readonly _metrics: MonospaceFontMetrics) {
    this._log = getLogger("FontAtlasPage", this);

    // this._log.debug(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
    this._initialize();
  }

  private _initialize(): void {
    this._atlasWidthInCells = 32;
    this._atlasHeightInCells = 32;
    this._atlasFlushCellCount = Math.floor(this._atlasWidthInCells * this._atlasHeightInCells * 0.2);

    this._safetyPadding = Math.ceil(Math.max(this._metrics.widthPx, this._metrics.heightPx) / 6);

    this._pageCanvas = document.createElement("canvas");
    this._pageCanvas.width = this._atlasWidthInCells * (this._metrics.widthPx + this._safetyPadding * 2);
    this._pageCanvas.height = this._atlasHeightInCells * (this._metrics.heightPx + this._safetyPadding * 2);

    this._initializeSlots();

    // document.body.appendChild(this._pageCanvas);

    this._pageCtx = this._pageCanvas.getContext("2d");
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

  private _makeLookupKey(codePoint: number, style: StyleCode): number {
    return style * TWO_TO_THE_24 + codePoint;
  }

  protected _getGlyph(codePoint: number, alternateCodePoints: number[], style: StyleCode): CG {
    let cachedGlyph = this._lookupTable.get(this._makeLookupKey(codePoint, style));
    if (cachedGlyph == null) {
      cachedGlyph = this._insertChar(codePoint, alternateCodePoints, style);
    }
    cachedGlyph.lastUse = this._monoTime;
    this._monoTime++;
    return cachedGlyph;
  }

  private _insertChar(codePoint: number, alternateCodePoints: number[], style: StyleCode): CG {
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

    const cachedGlyph = this._insertCharAt(codePoint, alternateCodePoints, style, xPx, yPx, widthPx, widthInCells);
    cachedGlyph.atlasX = this._nextEmptyCellX;
    cachedGlyph.atlasY = this._nextEmptyCellY;

    const key = this._makeLookupKey(codePoint, style);
    cachedGlyph.key = key;
    this._lookupTable.set(key, cachedGlyph);
    for (let i=0; i<widthInCells; i++) {
      this._glyphCellMap[this._nextEmptyCellY][this._nextEmptyCellX + i] = cachedGlyph;
    }
    return cachedGlyph;
  }

  protected _insertCharAt(codePoint: number, alternateCodePoints: number[], style: StyleCode, xPx: number,
      yPx: number, widthPx: number, widthInCells: number): CG {

    this._pageCtx.save();

    this._pageCtx.clearRect(xPx, yPx, widthInCells * this._metrics.widthPx, this._metrics.heightPx);

    if (style & STYLE_MASK_FAINT) {
      this._pageCtx.fillStyle = "#ffffff80";
    }

    if (isBoxCharacter(codePoint)) {
      drawBoxCharacter(this._pageCtx, codePoint, xPx, yPx, this._metrics.widthPx, this._metrics.heightPx);
    } else {
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

      this._pageCtx.font = styleName + this._metrics.fontSizePx + "px " + this._metrics.fontFamily;
      this._pageCtx.fillText(str, xPx + this._metrics.fillTextXOffset, yPx + this._metrics.fillTextYOffset);
    }

    if (style & STYLE_MASK_STRIKETHROUGH) {
      this._pageCtx.fillRect(xPx,
                              yPx + this._metrics.strikethroughY,
                              widthPx, this._metrics.strikethroughHeight);
    }

    const underline = style & STYLE_MASK_UNDERLINE;
    if (underline === UNDERLINE_STYLE_NORMAL || underline === UNDERLINE_STYLE_DOUBLE) {
      this._pageCtx.fillRect(xPx,
                              yPx + this._metrics.underlineY,
                              widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_DOUBLE) {
      this._pageCtx.fillRect(xPx,
                              yPx + this._metrics.secondUnderlineY,
                              widthPx, this._metrics.underlineHeight);
    }
    if (underline === UNDERLINE_STYLE_CURLY) {
      this._pageCtx.save();
      this._pageCtx.lineWidth = this._metrics.curlyThickness;
      this._pageCtx.beginPath();
      this._pageCtx.moveTo(xPx, yPx+this._metrics.curlyY);
      this._pageCtx.quadraticCurveTo(xPx + widthPx/4, yPx+this._metrics.curlyY-this._metrics.curlyHeight/2,
                                      xPx + widthPx/2, yPx+this._metrics.curlyY);
      this._pageCtx.quadraticCurveTo(xPx + widthPx*3/4, yPx+this._metrics.curlyY+this._metrics.curlyHeight/2,
                                        xPx + widthPx, yPx+this._metrics.curlyY);
      this._pageCtx.stroke();
      this._pageCtx.restore();
    }

    if (style & STYLE_MASK_OVERLINE) {
      this._pageCtx.fillRect(xPx,
                              yPx + this._metrics.overlineY,
                              widthPx, this._metrics.overlineHeight);
    }

    const cachedGlyph = this._createCachedGlyphStruct({
      xPixels: xPx,
      yPixels: yPx,
      widthCells: widthInCells,
      widthPx,

      key: -1,
      atlasX: -1,
      atlasY: -1,
      lastUse: 0
    });

    this._pageCtx.restore();

    return cachedGlyph;
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
        this._lookupTable.delete(cachedGlyph.key);
      }
    }

    this._nextEmptyCellX = 0;
    this._nextEmptyCellY = 0;
  }
}

