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

const FONT_ATLAS_PAGE_WIDTH_CELLS = 8;
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

    const xPx = this._nextEmptyCellX * (this._metrics.widthPx + this._safetyPadding*2) + this._safetyPadding;
    const yPx = this._nextEmptyCellY * (this._metrics.heightPx + this._safetyPadding*2) + this._safetyPadding;

    const cachedGlyph = this._insertCharAt(codePoint, alternateCodePoints, style, xPx, yPx, widthPx, widthInCells);

    for (let i=0; i<widthInCells; i++) {
      this._incrementNextEmptyCell();
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

    this._lookupTable.set(this._makeLookupKey(codePoint, style), cachedGlyph);

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
