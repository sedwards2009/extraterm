/**
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 */
import { QApplication, QColor, QFont, QFontMetrics, QFontWeight, QImage, QImageFormat, QPainter, QPainterPath, QPen } from "@nodegui/nodegui";

import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE,
  STYLE_MASK_OVERLINE, STYLE_MASK_HYPERLINK, STYLE_MASK_HYPERLINK_HIGHLIGHT, UNDERLINE_STYLE_NORMAL,
  UNDERLINE_STYLE_DOUBLE, UNDERLINE_STYLE_CURLY } from "extraterm-char-cell-line";
import { isWide as isFullWidth } from "extraterm-unicode-utilities";
import { select } from "floyd-rivest";
import { Logger, getLogger, log } from "extraterm-logging";
import { TripleKeyMap } from "extraterm-data-structures";
import { mat2d } from "gl-matrix";

import { MonospaceFontMetrics } from "../font_metrics/MonospaceFontMetrics.js";
import { isBoxCharacter, drawBoxCharacter } from "./BoxDrawingCharacters.js";
import { RGBAToQColor } from "../RGBAToQColor.js";


const TWO_TO_THE_24 = 2 ** 24;
const FRACTION_CELLS_TO_CLEAR_ON_FLUSH = 0.2;

export interface CachedGlyph {
  xPixels: number;  // X position of the top left corner of the glyph in the atlas.
  yPixels: number;  // Y position of the top left corner of the glyph in the atlas.
  widthCells: number; // Width of the glyph in cells.
  widthPx: number;    // Width of the glyph in pixels

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

  protected _pageImage: QImage = null;
  protected _pageImageWidth = 0;
  protected _pageImageHeight = 0;
  protected _painter: QPainter = null;

  private _atlasWidthInCells: number;
  private _atlasHeightInCells: number;
  private _atlasFlushCellCount: number;

  private _safetyPadding: number = 0;

  private _glyphCellMap: CachedGlyph[][] = null;

  private _monoTime = 1;
  private _nextEmptyCellX: number = 0;
  private _nextEmptyCellY: number = 0;
  private _lookupTable = new TripleKeyMap<number, number, number, CG>();

  private _qfont: QFont = null;
  private _qmetrics: QFontMetrics = null;
  private _extraQfonts: QFont[] = [];
  private _extraQmetrics: QFontMetrics[] = [];

  constructor(protected readonly _metrics: MonospaceFontMetrics,
      protected readonly _extraFonts: MonospaceFontMetrics[],
      protected readonly _transparentBackground: boolean,
      protected readonly _screenWidthHintPx: number,
      protected readonly _screenHeightHintPx: number) {

    this._log = getLogger("FontAtlasPage", this);

    this._qfont = new QFont();
    this._qfont.setFamily(this._metrics.fontFamily);
    this._qfont.setPixelSize(this._metrics.fontSizePx);
    this._qmetrics = new QFontMetrics(this._qfont);

    for (const extraFont of this._extraFonts) {
      const font = new QFont();
      font.setFamily(extraFont.fontFamily);
      font.setPixelSize(extraFont.fontSizePx);
      this._extraQfonts.push(font);

      const qmetrics = new QFontMetrics(font);
      this._extraQmetrics.push(qmetrics);
    }

    // this._log.debug(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
    this._initialize();
  }

  private _initialize(): void {
    this._atlasWidthInCells = Math.ceil(this._screenWidthHintPx / this._metrics.widthPx);
    this._atlasHeightInCells = Math.ceil(this._screenHeightHintPx / this._metrics.heightPx);
    this._atlasFlushCellCount = Math.floor(this._atlasWidthInCells * this._atlasHeightInCells *
                                  FRACTION_CELLS_TO_CLEAR_ON_FLUSH);

    this._safetyPadding = Math.ceil(Math.max(this._metrics.widthPx, this._metrics.heightPx) / 6);

    this._pageImageWidth = this._atlasWidthInCells * (this._metrics.widthPx + this._safetyPadding * 2);
    this._pageImageHeight = this._atlasHeightInCells * (this._metrics.heightPx + this._safetyPadding * 2);

    this._pageImage = new QImage(this._pageImageWidth, this._pageImageHeight, QImageFormat.RGB32);
    this._initializeSlots();

    this._painter = new QPainter(); //{alpha: this._transparentBackground});
    this._painter.begin(this._pageImage);
    this._painter.fillRect(0, 0, this._pageImageWidth, this._pageImageHeight, new QColor(0, 0, 0, 255));
    this._painter.end();
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
    return null;
  }

  getQImage(): QImage {
    return this._pageImage;
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

    const painter = this._painter;
    this._pageImage.setDevicePixelRatio(1);

    painter.begin(this._pageImage);
    painter.save();

    const bgColor = RGBAToQColor(bgRGBA);
    painter.fillRect(xPx, yPx, widthInCells * this._metrics.widthPx, this._metrics.heightPx, bgColor);

    const fgColor = RGBAToQColor(fgRGBA);
    painter.setPen(fgColor);

    if (isBoxCharacter(codePoint)) {
      drawBoxCharacter(painter, codePoint, xPx, yPx, this._metrics.widthPx, this._metrics.heightPx, fgColor);
    } else {
      this._drawPlainCharacter(painter, codePoint, alternateCodePoints, style, fontIndex, xPx, yPx, widthInCells);
    }

    for (let i=0; i<widthInCells; i++) {
      this._drawDecoration(painter, style, xPx + i * widthPx, yPx, widthPx, fgRGBA);
    }

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

    painter.restore();
    painter.end();

    return cachedGlyph;
  }

  private _drawPlainCharacter(painter: QPainter, codePoint: number, alternateCodePoints: number[],
      style: StyleCode, fontIndex: number, xPx: number, yPx: number, widthInCells: number): void {

    let str: string;
    if (alternateCodePoints == null) {
      str = String.fromCodePoint(codePoint);
    } else {
      str = String.fromCodePoint(...alternateCodePoints);
    }

    let font: QFont = null;
    if (fontIndex === 0) {
      font = this._qfont;
    } else {
      font = this._extraQfonts[fontIndex-1];
    }

    font.setWeight(style & STYLE_MASK_BOLD ? QFontWeight.Bold : QFontWeight.Normal);
    font.setItalic((style & STYLE_MASK_ITALIC) !== 0);

    painter.setFont(font);

    let metrics = this._metrics;
    if (fontIndex !== 0) {
      metrics = this._extraFonts[fontIndex-1];
    }

    const textXPx = xPx + this._metrics.fillTextXOffset;
    const textYPx = yPx + this._metrics.fillTextYOffset;

    let shrink = false;
    if (widthInCells === 1 && (fontIndex !== 0 || this._isSymbol(codePoint))) {
      // Probe and possibly scale glyphs which fall outside their 1 cell.
      // * Symbols have a habit of being too big even if the font is meant
      //   to be a monospace and the glyph is meant to be just one cell.
      // * Extra fonts often have different width compared to our base font.
      //   We chell all of them.
      const qmetrics = fontIndex === 0 ? this._qmetrics : this._extraQmetrics[fontIndex-1];
      const charWidthPx = qmetrics.horizontalAdvance(str);
      if (charWidthPx > 1.25 * this._metrics.widthPx) {
        // We give a 25% leniency to avoid catching glyphs which render
        // slightly outside the cell.
        shrink = true;
      }
    }

    const isItalic = (style & STYLE_MASK_ITALIC) !== 0 && metrics.widthPx !== metrics.boldItalicWidthPx;
    if (isItalic && fontIndex === 0) {
      painter.save();

      const matrix = mat2d.create();
      mat2d.translate(matrix, matrix, [textXPx, textYPx]);
      mat2d.scale(matrix, matrix, [metrics.widthPx / metrics.boldItalicWidthPx, 1]);
      painter.setTransform(matrix);

      painter.drawText(0, 0, str);
      painter.restore();
    } else {
      if (! shrink) {
        painter.drawText(textXPx, textYPx, str);
      } else {

        // Shrink big glyphs by 50%.
        painter.save();

        const matrix = mat2d.create();
        mat2d.translate(matrix, matrix, [textXPx, textYPx + Math.floor(this._metrics.heightPx/4)]);
        mat2d.scale(matrix, matrix, [0.5, 0.5]);
        painter.setTransform(matrix);

        painter.drawText(0, 0, str);
        painter.restore();
      }
    }
  }

  private _isSymbol(codePoint: number): boolean {
    return  (codePoint >= 0x2000 && codePoint < 0x2c00) || (codePoint & 0x1f000) === 0x1f000;
  }

  private _drawDecoration(painter: QPainter, style: StyleCode, xPx: number, yPx: number,
      widthPx: number, fgRGBA: number): void {

    const fgColor = RGBAToQColor(fgRGBA);
    if (style & STYLE_MASK_STRIKETHROUGH) {
      painter.fillRect(xPx, yPx + this._metrics.strikethroughY, widthPx, this._metrics.strikethroughHeight, fgColor);
    }

    const underline = style & STYLE_MASK_UNDERLINE;
    if (underline === UNDERLINE_STYLE_NORMAL || underline === UNDERLINE_STYLE_DOUBLE) {
      painter.fillRect(xPx, yPx + this._metrics.underlineY, widthPx, this._metrics.underlineHeight, fgColor);
    }
    if (underline === UNDERLINE_STYLE_DOUBLE || style & STYLE_MASK_HYPERLINK_HIGHLIGHT) {
      painter.fillRect(xPx, yPx + this._metrics.secondUnderlineY, widthPx, this._metrics.underlineHeight, fgColor);
    }
    if (underline === UNDERLINE_STYLE_CURLY) {
      const path = new QPainterPath();
      path.moveTo(xPx, yPx+this._metrics.curlyY);
      path.quadTo(xPx + widthPx/4, yPx+this._metrics.curlyY-this._metrics.curlyHeight/2,
                                      xPx + widthPx/2, yPx+this._metrics.curlyY);
      path.quadTo(xPx + widthPx*3/4, yPx+this._metrics.curlyY+this._metrics.curlyHeight/2,
                                        xPx + widthPx, yPx+this._metrics.curlyY);

      painter.save();
      const pen = new QPen();
      pen.setColor(fgColor);
      pen.setWidth(this._metrics.curlyThickness);
      painter.setPen(pen);
      painter.drawPath(path);
      painter.restore();
    }

    if (style & STYLE_MASK_OVERLINE) {
      painter.fillRect(xPx, yPx + this._metrics.overlineY, widthPx, this._metrics.overlineHeight, fgColor);
    }

    if (style & STYLE_MASK_HYPERLINK && ! (style & STYLE_MASK_HYPERLINK_HIGHLIGHT)) {
      painter.save();
      const halfAlphaFgRGBA = (fgRGBA & 0xffffff00) | ((fgRGBA >> 1) & 0x7f);
      const fgHalfTrans = RGBAToQColor(halfAlphaFgRGBA);

      // One litle dash at second underline height.
      const dashWidthPx = Math.max(1, Math.floor(widthPx / 3));
      const firstXPx = Math.floor(widthPx / 3);
      painter.fillRect(xPx + firstXPx, yPx + this._metrics.secondUnderlineY, dashWidthPx,
        this._metrics.underlineHeight, fgHalfTrans);
      painter.restore();
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
