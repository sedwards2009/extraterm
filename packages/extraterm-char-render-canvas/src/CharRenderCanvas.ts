/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { CharCellGrid } from "extraterm-char-cell-grid";
import { ColorPatchCanvas } from "./ColorPatchCanvas";
import { FontAtlas } from "./FontAtlas";
import { MonospaceFontMetrics } from "./MonospaceFontMetrics";
import { computeFontMetrics, debugFontMetrics } from "./FontMeasurement";

const log = console.log.bind(console);

export const PALETTE_BG_INDEX = 256;
export const PALETTE_FG_INDEX = 257;
export const PALETTE_CURSOR_INDEX = 258;


//-------------------------------------------------------------------------

const xtermColors: number[] = [
  // dark:
  0x000000ff, // black
  0xcd0000ff, // red3
  0x00cd00ff, // green3
  0xcdcd00ff, // yellow3
  0x0000eeff, // blue2
  0xcd00cdff, // magenta3
  0x00cdcdff, // cyan3
  0xe5e5e5ff, // gray90
  // bright:
  0x7f7f7fff, // gray50
  0xff0000ff, // red
  0x00ff00ff, // green
  0xffff00ff, // yellow
  0x5c5cffff, // rgb:5c/5c/ff
  0xff00ffff, // magenta
  0x00ffffff, // cyan
  0xffffffff  // white
];

// Colors 0-15 + 16-255
// Much thanks to TooTallNate for writing this.
export function xtermPalette(): number[] {
  const colors = xtermColors;
  const r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];

  const out = (r: number, g: number, b: number) => {
    colors.push( (r << 24) | (g << 16) | (b << 8) | 0xff);
  }

  let i;

  // 16-231
  i = 0;
  for (; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  i = 0;
  for (; i < 24; i++) {
    const v = 8 + i * 10;
    out(v, v, v);
  }

  // Default BG/FG
  colors[PALETTE_BG_INDEX] = 0x00000000;
  colors[PALETTE_FG_INDEX] = 0xf0f0f0ff;
  // Cursor
  colors[PALETTE_CURSOR_INDEX] = 0xffaa00ff;

  return colors;
}

//-------------------------------------------------------------------------
export interface CharRenderCanvasOptions {
  /**
   * Desired width of the canvas in pixels
   * 
   * This or `widthChars` must be specified.
   */
  widthPx?: number;

  /**
   * Desired height of the canvas in pixels
   * 
   * This or `heightChars` must be specified.
   */
  heightPx?: number;

  /**
   * Maximum width of the canvas which may be used for show character cells
   * 
   * Optional.
   */
  usableWidthPx?: number;

  /**
   * Maximum height of the canvas which may be used for show character cells
   * 
   * Optional.
   */
  usableHeightPx?: number;

  /**
   * Desired width of the canvas in character cell widths.
   * 
   * This or `widthPx` must be specified.
   */
  widthChars?: number;

  /**
   * Desired height of the canvas in character cell widths.
   * 
   * This or `heightPx` must be specified.
   */
  heightChars?: number;

  /**
   * Font family of the primary font used for rendering the cells
   * 
   * The exact name is the same as that required by CSS.
   */
  fontFamily: string;

  /**
   * Height of the primary font in pixels
   */
  fontSizePx: number;

  debugParentElement?: HTMLElement;

  /**
   * Color palette
   * 
   * An array of 258 RGBA 32bit colors values.
   * Indexes 256 (`PALETTE_BG_INDEX`), 257 (`PALETTE_FG_INDEX`) and 258
   * (`PALETTE_CURSOR_INDEX`) have special meaning. They correspond to
   * The terminal background color, foreground color, and cursor color.
   */
  palette: number[];

  /**
   * List of additional fonts for specific unicode ranges
   */
  extraFonts?: FontSlice[];
}

export interface FontSlice {
  /**
   * Font family to render the cells using
   * 
   * The exact name is the same as that required by CSS.
   */
  fontFamily: string;

  /**
   * Size of the font in pixels
   */
  fontSizePx: number;

  /**
   * Set to true if the font is a color font
   */
  isColor?: boolean;

  /**
   * Start code point of the unicode range
   * 
   * This and `unicodeEnd` define the range of unicode code points for
   * which this font is to be used.
   */
  unicodeStart: number;

  /**
   * End code point of the unicode range (exclusive)
   * 
   * This and `unicodeStart` define the range of unicode code points for
   * which this font is to be used.
   */
  unicodeEnd: number;

  /**
   * Characters used to determine the effective size of the glyphs
   * 
   * These characters are rendered and examined on the pixel level to
   * determine the actual size of the font on the screen.
   */
  sampleChars?: string[];
}

interface ExtraFontSlice extends FontSlice {
  fontAtlas: FontAtlas;
}

export class CharRenderCanvas {

  private _canvas: HTMLCanvasElement = null;
  private _canvasCtx: CanvasRenderingContext2D = null;

  private _charCanvas: HTMLCanvasElement = null;
  private _charCanvasCtx: CanvasRenderingContext2D = null;

  private _canvasWidthPx = 512;
  private _canvasHeightPx = 512;

  private _widthChars = 0;
  private _heightChars = 0;

  private _fontFamily = "sans";
  private _fontSizePx = 10;
  
  private _fontAtlas: FontAtlas = null;
  private _extraFontSlices: ExtraFontSlice[] = [];

  private cellWidthPx: number = 0;
  private cellHeightPx: number = 0;

  private _cellGrid: CharCellGrid = null;
  private _bgColorPatchCanvas: ColorPatchCanvas = null;
  private _fgColorPatchCanvas: ColorPatchCanvas = null;

  private _palette: number[] = null;

  constructor(options: CharRenderCanvasOptions) {
    const { widthPx, heightPx, usableWidthPx, usableHeightPx, widthChars, heightChars, fontFamily, fontSizePx,
            debugParentElement, palette } = options;

    this._palette = palette;

    this._fontSizePx = fontSizePx || 10;
    this._fontFamily = fontFamily || "monospace";

    const fontMetrics = computeFontMetrics(this._fontFamily, this._fontSizePx);
    debugFontMetrics(fontMetrics);
    this.cellWidthPx = fontMetrics.widthPx;
    this.cellHeightPx = fontMetrics.heightPx;
  
    if (widthPx != null) {
      // Derive char width from pixels width
      const effectiveWidthPx = usableWidthPx == null ? widthPx : usableWidthPx;
      this._widthChars = Math.floor(effectiveWidthPx / this.cellWidthPx);
      this._canvasWidthPx = widthPx;  
    } else {
      this._widthChars = widthChars;
      this._canvasWidthPx = this._widthChars * this.cellWidthPx;
    }

    if (heightPx != null) {
      const effectiveHeightPx = usableHeightPx == null? heightPx : usableHeightPx;
      this._heightChars = Math.floor(effectiveHeightPx / this.cellHeightPx);
      this._canvasHeightPx = heightPx;
    } else {
      this._heightChars = heightChars;
      this._canvasHeightPx = this._heightChars * this.cellHeightPx;
    }

    this._cellGrid = new CharCellGrid(this._widthChars, this._heightChars, this._palette);

    this._canvas = <HTMLCanvasElement> document.createElement("canvas");
    this._canvas.width = this._canvasWidthPx;
    this._canvas.height = this._canvasHeightPx;
    this._canvasCtx = this._canvas.getContext("2d", { alpha: true });

    if (debugParentElement != null) {
      debugParentElement.appendChild(this._canvas);
    }

    this._charCanvas = <HTMLCanvasElement> document.createElement("canvas");
    this._charCanvas.width = this._canvasWidthPx;
    this._charCanvas.height = this._canvasHeightPx;

    this._charCanvasCtx = this._charCanvas.getContext("2d", { alpha: true });
      
    if (debugParentElement != null) {
      debugParentElement.appendChild(this._charCanvas);
    }
        
    this._fontAtlas = new FontAtlas(fontMetrics);
    this._extraFontSlices = this._setupExtraFontSlices(options.extraFonts, fontMetrics);
    this._bgColorPatchCanvas = new ColorPatchCanvas(this._cellGrid, this.cellWidthPx, this.cellHeightPx, "background",
                                                    this._palette[PALETTE_CURSOR_INDEX], debugParentElement);
    this._fgColorPatchCanvas = new ColorPatchCanvas(this._cellGrid, this.cellWidthPx, this.cellHeightPx, "foreground",
                                                    this._palette[0], debugParentElement);
  }

  getCellGrid(): CharCellGrid {
    return this._cellGrid;
  }

  getCanvasElement(): HTMLCanvasElement {
    return this._canvas;
  }

  getWidthPx(): number {
    return this._canvasWidthPx;
  }

  getHeightPx(): number {
    return this._canvasHeightPx;
  }

  setPalette(palette: number[]) : void {
    this._palette = palette;
    this._cellGrid.setPalette(this._palette);
    this._bgColorPatchCanvas.setCursorColor(this._palette[PALETTE_CURSOR_INDEX]);
    this._fgColorPatchCanvas.setCursorColor(this._palette[0]);
  }

  private _setupExtraFontSlices(extraFonts: FontSlice[], metrics: MonospaceFontMetrics): ExtraFontSlice[] {
    if (extraFonts == null) {
      return [];
    }

    return extraFonts.map(extraFont => {

      const customMetrics = {
        ...metrics,
        fontFamily: extraFont.fontFamily,
        fontSizePx: extraFont.fontSizePx,
      };

      const actualFontMetrics = computeFontMetrics(extraFont.fontFamily, extraFont.fontSizePx, extraFont.sampleChars);
      customMetrics.fontSizePx = actualFontMetrics.fontSizePx;
      customMetrics.fillTextYOffset = actualFontMetrics.fillTextYOffset;

      const fontAtlas = new FontAtlas(customMetrics);
      return { ...extraFont, fontAtlas }
    });
  }

  private _updateCharGridFlags(): void {
    const cellGrid = this._cellGrid;
    const width = cellGrid.width;
    const height = cellGrid.height;

    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        if (this._getExtraFontSliceFromCodePoint(cellGrid.getCodePoint(i, j)) != null) {
          cellGrid.setExtraFontsFlag(i, j, true);
        } else {
          cellGrid.setExtraFontsFlag(i, j, false);
        }
      }
    }
  }

  private _getExtraFontSliceFromCodePoint(codePoint: number): ExtraFontSlice {
    for (const fontSlice of this._extraFontSlices) {
      if (codePoint >= fontSlice.unicodeStart && codePoint < fontSlice.unicodeEnd) {
        return fontSlice;
      }
    }
    return null;
  }

  render(): void {
    this._updateCharGridFlags();

    this._renderCharacters();
    this._fgColorPatchCanvas.render();
    this._bgColorPatchCanvas.render();

    this._canvasCtx.globalCompositeOperation = "copy";
    this._canvasCtx.drawImage(this._charCanvas, 0, 0);

    this._canvasCtx.globalCompositeOperation = "source-in";
    this._canvasCtx.drawImage(this._fgColorPatchCanvas.getCanvas(), 0, 0);

    this._canvasCtx.globalCompositeOperation = "destination-over";
    this._canvasCtx.drawImage(this._bgColorPatchCanvas.getCanvas(), 0, 0);

    this._renderColorCharacters(this._canvasCtx);
  }

  private _renderCharacters(): void {
    const ctx = this._charCanvasCtx;
    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, this._canvasWidthPx, this._canvasHeightPx);
    ctx.fillStyle = "#ffffffff";
    
    ctx.globalCompositeOperation = "source-over";

    const cellGrid = this._cellGrid;
    const cellWidth = this.cellWidthPx;
    const cellHeight = this.cellHeightPx;
    const width = cellGrid.width;
    const height = cellGrid.height;
    const spaceCodePoint = " ".codePointAt(0);
    
    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        if ( ! cellGrid.getExtraFontsFlag(i, j)) {
          const codePoint = cellGrid.getCodePoint(i, j);
          if (codePoint !== spaceCodePoint) {
            this._fontAtlas.drawCodePoint(ctx,
                                          cellGrid.getCodePoint(i, j),
                                          cellGrid.getStyle(i, j),
                                          i * cellWidth,
                                          j * cellHeight);
          }
        }
      }
    }
  }

  private _renderColorCharacters(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#ffffffff";
    ctx.globalCompositeOperation = "source-over";

    const cellGrid = this._cellGrid;
    const cellWidth = this.cellWidthPx;
    const cellHeight = this.cellHeightPx;
    const width = cellGrid.width;
    const height = cellGrid.height;

    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        if (cellGrid.getExtraFontsFlag(i, j)) {
          const codePoint = cellGrid.getCodePoint(i, j);
          const extraFont = this._getExtraFontSliceFromCodePoint(codePoint);
          extraFont.fontAtlas.drawCodePoint(ctx,
                                        codePoint,
                                        cellGrid.getStyle(i, j),
                                        i * cellWidth,
                                        j * cellHeight);
        }
      }
    }
  }

}
