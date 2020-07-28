/**
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 */

import { CharCellGrid, STYLE_MASK_CURSOR } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { Disposable } from "./Disposable";
import { FontSlice } from "./FontSlice";
import { CursorStyle } from "./CursorStyle";
import { WebGLRenderer } from "./WebGLRenderer";
import { RGBAToCss } from "./RGBAToCss";
import { WebGLRendererRepository } from "./WebGLRendererRepository";

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
  };

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
  colors[PALETTE_BG_INDEX] = 0x000000ff;
  colors[PALETTE_FG_INDEX] = 0xf0f0f0ff;
  // Cursor
  colors[PALETTE_CURSOR_INDEX] = 0xffaa00ff;

  return colors;
}

export interface WebGLCharRenderCanvasOptions {
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

  transparentBackground: boolean;

  /**
   * List of additional fonts for specific unicode ranges
   */
  extraFonts?: FontSlice[];

  webGLRendererRepository: WebGLRendererRepository;

  cursorStyle?: CursorStyle;
}


export class WebGLCharRenderCanvas implements Disposable {
  private _log: Logger = null;
  private _disposables: Disposable[] = [];

  private _canvas: HTMLCanvasElement = null;
  private _canvasCtx: CanvasRenderingContext2D = null;

  private _canvasWidthPx = 512;
  private _canvasHeightPx = 512;

  private _widthChars = 0;
  private _heightChars = 0;

  private _fontFamily = "sans";
  private _fontSizePx = 10;

  // private _extraFontSlices: ExtraFontSlice[] = [];

  private cellWidthPx: number = 0;
  private cellHeightPx: number = 0;

  private _cellGrid: CharCellGrid = null;
  private _palette: number[] = null;
  private _cursorStyle = CursorStyle.BLOCK;
  private _transparentBackground = false;

  private _webglRenderer: WebGLRenderer = null;

  constructor(options: WebGLCharRenderCanvasOptions) {
    this._log = getLogger("CharRenderCanvas", this);
    const {
      cursorStyle,
      debugParentElement,
      extraFonts,
      fontFamily,
      fontSizePx,
      heightChars,
      heightPx,
      palette,
      transparentBackground,
      usableHeightPx,
      usableWidthPx,
      webGLRendererRepository,
      widthChars,
      widthPx,
    } = options;

    this._palette = palette;
    this._cursorStyle = cursorStyle === undefined? CursorStyle.BLOCK : cursorStyle;

    this._fontSizePx = fontSizePx || 10;
    this._fontFamily = fontFamily || "monospace";
    this._transparentBackground = transparentBackground;

    const webglRenderer = webGLRendererRepository.getWebGLRenderer(this._fontFamily, this._fontSizePx, extraFonts,
      transparentBackground);
    this._disposables.push(webglRenderer);
    this._webglRenderer = webglRenderer;

    const fontMetrics = this._webglRenderer.getFontMetrics();
    // debugFontMetrics(fontMetrics);
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
    this._canvasCtx = this._canvas.getContext("2d", {alpha: this._transparentBackground});

    this._paintInRightGapBackground();

    if (debugParentElement != null) {
      debugParentElement.appendChild(this._canvas);
    }
  }

  private _paintInRightGapBackground(): void {
    const gapPx = this._canvasWidthPx - this._widthChars * this.cellWidthPx;
    if (gapPx !== 0) {
      const ctx = this._canvasCtx;
      ctx.save();
      const bgColor = RGBAToCss(this._palette[PALETTE_BG_INDEX]);
      ctx.fillStyle = bgColor;
      ctx.globalCompositeOperation = "source-over";
      this._canvasCtx.fillRect(this.cellWidthPx * this._widthChars, 0, gapPx, this._canvasHeightPx);
      ctx.restore();
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }

  getCanvasElement(): HTMLCanvasElement {
    return this._canvas;
  }

  getCellGrid(): CharCellGrid {
    return this._cellGrid;
  }

  setPalette(palette: number[]) : void {
    this._palette = palette;
    this._cellGrid.setPalette(this._palette);
    this._webglRenderer.setCursorColor(this._palette[PALETTE_CURSOR_INDEX]);
    this._paintInRightGapBackground();
  }

  setCursorStyle(cursorStyle: CursorStyle): void {
    this._cursorStyle = cursorStyle;
    this._webglRenderer.setRenderBlockCursor(this._cursorStyle === CursorStyle.BLOCK);
  }

  render(): void {
    this._webglRenderer.setCursorColor(this._palette[PALETTE_CURSOR_INDEX]);
    this._webglRenderer.setRenderBlockCursor(this._cursorStyle === CursorStyle.BLOCK);
    this._webglRenderer.render(this._canvasCtx, this._cellGrid);
    this._renderCursors(this._canvasCtx);
  }

  getFontAtlasCanvasElement(): HTMLCanvasElement {
    return this._webglRenderer.getFontAtlas().getCanvas();
  }

  scrollVertical(verticalOffsetChars: number): void {
  }

  private _renderCursors(ctx: CanvasRenderingContext2D): void {
    if (this._cursorStyle === CursorStyle.BLOCK) {
      return;
    }

    ctx.save();
    const cursorColor = RGBAToCss(this._palette[PALETTE_CURSOR_INDEX]);
    ctx.strokeStyle = cursorColor;
    ctx.fillStyle = cursorColor;
    ctx.globalCompositeOperation = "source-over";

    const cellGrid = this._cellGrid;
    const cellWidth = this.cellWidthPx;
    const cellHeight = this.cellHeightPx;
    const width = cellGrid.width;
    const height = cellGrid.height;

    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        if (cellGrid.getStyle(i, j) & STYLE_MASK_CURSOR) {
          switch (this._cursorStyle) {
            case CursorStyle.BLOCK_OUTLINE:
              ctx.strokeRect(i * cellWidth +0.5, j * cellHeight + 0.5, cellWidth-1, cellHeight-1);
              break;

            case CursorStyle.UNDERLINE:
              ctx.fillRect(i * cellWidth, j * cellHeight + cellHeight-3, cellWidth, 3);
              break;

            case CursorStyle.UNDERLINE_OUTLINE:
              ctx.strokeRect(i * cellWidth +0.5, j * cellHeight + cellHeight-2.5, cellWidth-1, 2);
              break;

            case CursorStyle.BEAM:
              ctx.fillRect(i * cellWidth, j * cellHeight, 2, cellHeight);
              break;

            case CursorStyle.BEAM_OUTLINE:
              ctx.strokeRect(i * cellWidth +0.5, j * cellHeight + 0.5, 2, cellHeight-1);
              break;

            default:
              break;
          }
        }
      }
    }

    ctx.restore();
  }
}
