/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { CharCellGrid } from "extraterm-char-cell-grid";
import { ColorPatchCanvas } from "./ColorPatchCanvas";
import { FontAtlas } from "./FontAtlas";
import { MonospaceFontMetrics } from "./MonospaceFontMetrics";

const log = console.log.bind(console);

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
  colors[256] = 0x00000000;
  colors[257] = 0xf0f0f0ff;
  return colors;
}

//-------------------------------------------------------------------------
export interface CharRenderCanvasOptions {
  widthPx?: number;
  heightPx?: number;

  widthChars?: number;
  heightChars?: number;

  fontFamily: string;
  fontSizePx: number;

  debugParentElement?: HTMLElement;
  palette: number[];

  extraFonts?: FontSlice[];
}

export interface FontSlice {
  fontFamily: string;
  fontSizePx: number;
  isColor?: boolean;
  unicodeStart: number;
  unicodeEnd: number;
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

  cellGrid: CharCellGrid = null;
  private _bgColorPatchCanvas: ColorPatchCanvas = null;
  private _fgColorPatchCanvas: ColorPatchCanvas = null;

  private _palette: number[];

  constructor(options: CharRenderCanvasOptions) {
    const { widthPx, heightPx, widthChars, heightChars, fontFamily, fontSizePx, debugParentElement, palette } = options;

    this._palette = palette;

    this._fontSizePx = fontSizePx || 10;
    this._fontFamily = fontFamily || "monospace";

    const fontMetrics = this._computeFontMetrics(this._fontFamily, this._fontSizePx);
    this._debugFontMetric(fontMetrics);
    this.cellWidthPx = fontMetrics.widthPx;
    this.cellHeightPx = fontMetrics.heightPx;
  
    if (widthPx != null) {
      // Derive char width from pixels width
      this._widthChars = Math.floor(widthPx / this.cellWidthPx);
    } else {
      this._widthChars = widthChars;
    }
    this._canvasWidthPx = this._widthChars * this.cellWidthPx;

    if (heightPx != null) {
      this._heightChars = Math.floor(heightPx / this.cellHeightPx);
    } else {
      this._heightChars = heightChars;
    }
    this._canvasHeightPx = this._heightChars * this.cellHeightPx;

    this.cellGrid = new CharCellGrid(this._widthChars, this._heightChars, this._palette);

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
    this._bgColorPatchCanvas = new ColorPatchCanvas(this.cellGrid, this.cellWidthPx, this.cellHeightPx, "background", debugParentElement);
    this._fgColorPatchCanvas = new ColorPatchCanvas(this.cellGrid, this.cellWidthPx, this.cellHeightPx, "foreground", debugParentElement);
  }

  getCellGrid(): CharCellGrid {
    return this.cellGrid;
  }

  getCanvasElement(): HTMLCanvasElement {
    return this._canvas;
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

      const actualFontMetrics = this._computeFontMetrics(extraFont.fontFamily, extraFont.fontSizePx, extraFont.sampleChars);
      customMetrics.fontSizePx = actualFontMetrics.fontSizePx;
      customMetrics.fillTextYOffset = actualFontMetrics.fillTextYOffset;

      const fontAtlas = new FontAtlas(customMetrics);
      return { ...extraFont, fontAtlas }
    });
  }

  private _updateCharGridFlags(): void {
    const cellGrid = this.cellGrid;
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

  private _computeFontMetrics(fontFamily: string, fontSizePx: number, sampleChars: string[]=null): MonospaceFontMetrics {
    if (sampleChars == null) {
      sampleChars = ["X"];
    }

    const canvas = <HTMLCanvasElement> document.createElement("canvas");

    const canvasWidth = fontSizePx * 3;
    const canvasHeight = fontSizePx * 3;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.font = "" + fontSizePx + "px " + fontFamily;
    ctx.textBaseline = "top";

    // Note: most of the properties on a TextMetrics object are behind Blink's experimental flag. 1/5/2019
    const metrics = ctx.measureText(sampleChars[0]);
    logFontMetrics(sampleChars[0], metrics);

    const {topY: xTopY, bottomY: xBottomY} = this._renderAndMeasureText(ctx, fontSizePx, sampleChars[0]);
    log(`X: topY: ${xTopY}, bottomY: ${xBottomY}`);

    const {topY: mTopY, bottomY: mBottomY} = this._renderAndMeasureText(ctx, fontSizePx, "m");
    log(`m: topY: ${mTopY}, bottomY: ${mBottomY}`);

    const charWidthPx = Math.ceil(metrics.width);
    const charHeightPx = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);

    let fillTextYOffset = Math.ceil(metrics.fontBoundingBoxAscent);
    if (xTopY < 0) {
      // Sometimes glyphs still manage to protrude above the top of the font box.
      // So we shrink and shift them a bit.
      fontSizePx = fontSizePx + xTopY;
      fillTextYOffset = fillTextYOffset - xTopY;
    }

    return {
      fontSizePx,
      fontFamily,

      widthPx: charWidthPx,
      heightPx: charHeightPx,

      fillTextYOffset,
      fillTextXOffset: 0,

      strikethroughY: Math.round((mTopY + mBottomY) /2) + fillTextYOffset,
      strikethroughHeight: 1,
      underlineY: Math.round(xBottomY + 2) + fillTextYOffset,
      underlineHeight: 1,
    };
  }

  private _renderAndMeasureText(ctx: CanvasRenderingContext2D, fontSizePx: number, text: string): { topY: number, bottomY: number } {
    ctx.save();

    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, this._canvasWidthPx, this._canvasHeightPx);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#ffffffff";

    ctx.fillText(text, fontSizePx, fontSizePx);

    const imageData = ctx.getImageData(0, 0, fontSizePx * 3, fontSizePx * 3);
    const topRowY = this._findTopRowInImageData(imageData);
    const bottomRowY = this._findBottomRowInImageData(imageData);
    ctx.restore();
    return { topY: topRowY-fontSizePx, bottomY: bottomRowY-fontSizePx }
  }

  private _findTopRowInImageData(imageData: ImageData): number {
    const rawData = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let offset = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++, offset += 4) {
        if (rawData[offset] !== 0) {
          return y;
        }
      }
    }
    return -1;
  }

  private _findBottomRowInImageData(imageData: ImageData): number {
    const rawData = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let offset = 4 * width * height - 4;
    for (let y = height-1; y >= 0; y--) {
      for (let x = 0; x < width; x++, offset -= 4) {
        if (rawData[offset] !== 0) {
          return y;
        }
      }
    }
    return -1;
  }

  private _debugFontMetric(fontMetrics: MonospaceFontMetrics): void {
    log("MonospaceFontMetrics: " + JSON.stringify(fontMetrics, null, "  "));
  }

  private _renderCharacters(): void {
    const ctx = this._charCanvasCtx;
    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, this._canvasWidthPx, this._canvasHeightPx);
    ctx.fillStyle = "#ffffffff";
    
    ctx.globalCompositeOperation = "source-over";

    const cellGrid = this.cellGrid;
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

    const cellGrid = this.cellGrid;
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


function dumpFontMetrics(ctx: CanvasRenderingContext2D): void {
  const textString = "ABCXYZabcxyz|-+=[].";

  for (let i=0; i<textString.length; i++) {
    const metrics = ctx.measureText("AAAAA" + textString.charAt(i));
    logFontMetrics(textString.charAt(i), metrics);
  }
}

function logFontMetrics(c, metrics): void {
  log(`${c} is:
  width: ${metrics.width}
  actualBoundingBoxAscent: ${metrics.actualBoundingBoxAscent}
  actualBoundingBoxDescent: ${metrics.actualBoundingBoxDescent}
  actualBoundingBoxLeft: ${metrics.actualBoundingBoxLeft}
  actualBoundingBoxRight: ${metrics.actualBoundingBoxRight}
  alphabeticBaseline: ${metrics.alphabeticBaseline}
  emHeightAscent: ${metrics.emHeightAscent}
  emHeightDescent: ${metrics.emHeightDescent}
  fontBoundingBoxAscent: ${metrics.fontBoundingBoxAscent}
  fontBoundingBoxDescent: ${metrics.fontBoundingBoxDescent}
  hangingBaseline: ${metrics.hangingBaseline}`);
}
