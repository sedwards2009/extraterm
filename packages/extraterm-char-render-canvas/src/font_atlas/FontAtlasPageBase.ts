/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_FAINT, STYLE_MASK_OVERLINE, UNDERLINE_STYLE_NORMAL, UNDERLINE_STYLE_DOUBLE,
  UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-grid";
import { isWide as isFullWidth } from "extraterm-unicode-utilities";

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics";
import { Logger, getLogger, log } from "extraterm-logging";
import { isBoxCharacter, drawBoxCharacter } from "./BoxDrawingCharacters";


const TWO_TO_THE_24 = 2 ** 24;

const FONT_ATLAS_PAGE_WIDTH_CELLS = 32;
const FONT_ATLAS_PAGE_HEIGHT_CELLS = 32;


export interface CachedGlyph {
  xPixels: number;
  yPixels: number;
  widthCells: number;
  widthPx: number;
}


export abstract class FontAtlasPageBase<CG extends CachedGlyph> {
  private _log: Logger = null;

  protected _pageCanvas: HTMLCanvasElement = null;
  protected _pageCtx: CanvasRenderingContext2D = null;
  private _safetyPadding: number = 0;

  private _glyphCellMap: CachedGlyph[][] = null;

  private _nextEmptyCellX: number = 0;
  private _nextEmptyCellY: number = 0;
  private _lookupTable: Map<number, CG> = new Map();
  private _isFull = false;

  constructor(protected readonly _metrics: MonospaceFontMetrics) {
    this._log = getLogger("FontAtlasPage", this);

    // this._log.debug(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
    this._initialize();
  }

  private _initialize(): void {
    this._safetyPadding = Math.ceil(Math.max(this._metrics.widthPx, this._metrics.heightPx) /4);

    this._pageCanvas = document.createElement("canvas");
    this._pageCanvas.width = FONT_ATLAS_PAGE_WIDTH_CELLS * (this._metrics.widthPx + this._safetyPadding * 2);
    this._pageCanvas.height = FONT_ATLAS_PAGE_HEIGHT_CELLS * (this._metrics.heightPx + this._safetyPadding * 2);

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
    for (let j=0; j<FONT_ATLAS_PAGE_HEIGHT_CELLS; j++) {
      const slotRow = new Array(FONT_ATLAS_PAGE_WIDTH_CELLS);
      for (let i=0; i<FONT_ATLAS_PAGE_WIDTH_CELLS; i++) {
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
    const cachedGlyph = this._lookupTable.get(this._makeLookupKey(codePoint, style));
    if (cachedGlyph != null) {
      return cachedGlyph;
    }
    if (this._isFull) {
      return null;
    }
    return this._insertChar(codePoint, alternateCodePoints, style);
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

    this._lookupTable.set(this._makeLookupKey(codePoint, style), cachedGlyph);
    for (let i=0; i<widthInCells; i++) {
      this._glyphCellMap[this._nextEmptyCellY][this._nextEmptyCellX + i] = cachedGlyph;
    }
    return cachedGlyph;
  }

  protected _insertCharAt(codePoint: number, alternateCodePoints: number[], style: StyleCode, xPixels: number,
      yPixels: number, widthPx: number, widthInCells: number): CG {

    this._pageCtx.save();
    if (style & STYLE_MASK_FAINT) {
      this._pageCtx.fillStyle = "#ffffff80";
    }

    if (isBoxCharacter(codePoint)) {
      drawBoxCharacter(this._pageCtx, codePoint, xPixels, yPixels, this._metrics.widthPx, this._metrics.heightPx);
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
    for (let j=y; j<FONT_ATLAS_PAGE_HEIGHT_CELLS; j++) {
      for (let i=x; i<FONT_ATLAS_PAGE_WIDTH_CELLS; i++) {
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
    if (x + widthInCells >= FONT_ATLAS_PAGE_WIDTH_CELLS) {
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

  private _flushLRU(): void {
    console.log("_flushLRU()");
  }
}
