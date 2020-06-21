/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

import { CharCellGrid, FLAG_MASK_LIGATURE, FLAG_MASK_WIDTH, FLAG_WIDTH_SHIFT, FLAG_MASK_EXTRA_FONT, STYLE_MASK_CURSOR, STYLE_MASK_INVISIBLE } from "extraterm-char-cell-grid";
import { log, Logger, getLogger } from "extraterm-logging";
import { ColorPatchCanvas } from "./color_patch/ColorPatchCanvas";
import { FontAtlas } from "./font_atlas/FontAtlas";
import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics";
import { computeFontMetrics, debugFontMetrics } from "./font_metrics/FontMeasurement";
import { FontAtlasRepository } from "./font_atlas/FontAtlasRepository";
import { Disposable } from "./Disposable";
import { ColorPatchImageData } from "./color_patch/ColorPatchImageData";

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
  colors[PALETTE_BG_INDEX] = 0x00000000;
  colors[PALETTE_FG_INDEX] = 0xf0f0f0ff;
  // Cursor
  colors[PALETTE_CURSOR_INDEX] = 0xffaa00ff;

  return colors;
}

export enum Renderer {
  ImageBitmap,  // Use ImageBitmap and graphics API to copy glyphs.
  CPU   // Use the CPU to copy glyphs.
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

  /**
   * Font atlas repository to use for fetching font atlases
   */
  fontAtlasRepository?: FontAtlasRepository;

  cursorStyle?: CursorStyle;

  /**
   * The render method to use.
   */
  renderer?: Renderer;
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
  unicodeStart?: number;

  /**
   * End code point of the unicode range (exclusive)
   *
   * This and `unicodeStart` define the range of unicode code points for
   * which this font is to be used.
   */
  unicodeEnd?: number;

  /**
   * Characters used to determine the effective size of the glyphs
   *
   * These characters are rendered and examined on the pixel level to
   * determine the actual size of the font on the screen.
   */
  sampleChars?: string[];

  unicodeCodePoints?: number[];
}

interface ExtraFontSlice extends FontSlice {
  fontAtlas: FontAtlas;
  codePointSet: Set<number>;
}

export enum CursorStyle {
  BLOCK,
  BLOCK_OUTLINE,
  UNDERLINE,
  UNDERLINE_OUTLINE,
  BEAM,
  BEAM_OUTLINE,
}

export class CharRenderCanvas implements Disposable {
  private _log: Logger = null;

  private _canvas: HTMLCanvasElement = null;
  private _canvasCtx: CanvasRenderingContext2D = null;

  private _charCanvas: HTMLCanvasElement = null;
  private _charCanvasCtx: CanvasRenderingContext2D = null;
  private _charCanvasImageData: ImageData = null;

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
  private _renderedCellGrid: CharCellGrid = null;

  private _bgColorPatchCanvas: ColorPatchCanvas = null;
  private _fgColorPatchCanvas: ColorPatchCanvas = null;
  private _fgColorPatchImageData: ColorPatchImageData = null;

  private _palette: number[] = null;
  private _fontAtlasRepository: FontAtlasRepository = null;

  private _disposables: Disposable[] = [];

  private _cursorStyle = CursorStyle.BLOCK;
  private _renderer: Renderer;

  constructor(options: CharRenderCanvasOptions) {
    this._log = getLogger("CharRenderCanvas", this);
    const { widthPx, heightPx, usableWidthPx, usableHeightPx, widthChars, heightChars, fontFamily, fontSizePx,
            debugParentElement, palette, fontAtlasRepository, cursorStyle, renderer } = options;

    this._renderer = renderer || Renderer.ImageBitmap;
    this._palette = palette;
    this._cursorStyle = cursorStyle === undefined? CursorStyle.BLOCK : cursorStyle;

    this._fontSizePx = fontSizePx || 10;
    this._fontFamily = fontFamily || "monospace";

    const fontMetrics = computeFontMetrics(this._fontFamily, this._fontSizePx);
    // debugFontMetrics(fontMetrics);
    this.cellWidthPx = fontMetrics.widthPx;
    this.cellHeightPx = fontMetrics.heightPx;

    if (fontAtlasRepository == null) {
      this._fontAtlasRepository = new FontAtlasRepository();
    } else {
      this._fontAtlasRepository = fontAtlasRepository;
    }

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
    this._renderedCellGrid = new CharCellGrid(this._widthChars, this._heightChars, this._palette);

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
    this._charCanvasImageData = new ImageData(this._canvasWidthPx, this._canvasHeightPx);

    if (debugParentElement != null) {
      debugParentElement.appendChild(this._charCanvas);
    }

    const primaryFontAtlas =  this._fontAtlasRepository.getFontAtlas(fontMetrics);
    this._disposables.push(primaryFontAtlas);
    this._fontAtlas = primaryFontAtlas;

    this._extraFontSlices = this._setupExtraFontSlices(options.extraFonts, fontMetrics);
    this._bgColorPatchCanvas = new ColorPatchCanvas(this._cellGrid, this.cellWidthPx, this.cellHeightPx, "background",
                                                    this._palette[PALETTE_CURSOR_INDEX], debugParentElement);

    if (this._renderer === Renderer.ImageBitmap) {
      this._fgColorPatchCanvas = new ColorPatchCanvas(this._cellGrid, this.cellWidthPx, this.cellHeightPx,
                                                      "foreground", this._palette[0], debugParentElement);
    } else {
      this._fgColorPatchImageData = new ColorPatchImageData(this._cellGrid, this.cellWidthPx, this.cellHeightPx,
        "foreground", this._palette[0]);
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
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

  setCursorStyle(cursorStyle: CursorStyle): void {
    this._cursorStyle = cursorStyle;
  }

  setPalette(palette: number[]) : void {
    this._palette = palette;
    this._cellGrid.setPalette(this._palette);
    this._bgColorPatchCanvas.setCursorColor(this._palette[PALETTE_CURSOR_INDEX]);
    if (this._fgColorPatchCanvas != null) {
      this._fgColorPatchCanvas.setCursorColor(this._palette[0]);
    }
    if (this._fgColorPatchImageData != null) {
      this._fgColorPatchImageData.setCursorColor(this._palette[0]);
    }
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

      const fontAtlas = this._fontAtlasRepository.getFontAtlas(customMetrics);
      this._disposables.push(fontAtlas);

      let codePointSet: Set<number> = null;
      if (extraFont.unicodeCodePoints != null) {
        codePointSet = new Set<number>(extraFont.unicodeCodePoints);
      }

      if (extraFont.unicodeStart != null && extraFont.unicodeEnd != null) {
        if (codePointSet == null) {
          codePointSet = new Set();
        }
        for (let c = extraFont.unicodeStart; c <= extraFont.unicodeEnd; c++) {
          codePointSet.add(c);
        }
      }

      return { ...extraFont, fontAtlas, codePointSet };
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
      if (fontSlice.codePointSet.has(codePoint)) {
        return fontSlice;
      }
    }
    return null;
  }

  render(): void {
    this._updateCharGridFlags();

    const renderCursor = this._cursorStyle === CursorStyle.BLOCK;

    if (this._renderer === Renderer.ImageBitmap) {
      // This path uses gfx APIs mostly
      this._fgColorPatchCanvas.setRenderCursor(renderCursor);
      this._fgColorPatchCanvas.render();
      this._bgColorPatchCanvas.setRenderCursor(renderCursor);
      this._bgColorPatchCanvas.render();

      this._renderCharacters();
      this._canvasCtx.globalCompositeOperation = "copy";
      this._canvasCtx.drawImage(this._charCanvas, 0, 0);

      this._canvasCtx.globalCompositeOperation = "source-in";
      this._canvasCtx.drawImage(this._fgColorPatchCanvas.getCanvas(), 0, 0);

      this._canvasCtx.globalCompositeOperation = "destination-over";
      this._canvasCtx.drawImage(this._bgColorPatchCanvas.getCanvas(), 0, 0);

    } else {
      // This path uses the CPU for most of the work.
      this._fgColorPatchImageData.setRenderCursor(renderCursor);
      this._fgColorPatchImageData.render();

      this._bgColorPatchCanvas.setRenderCursor(renderCursor);
      this._bgColorPatchCanvas.render();

      this._renderCharactersToImageData(this._charCanvasCtx, this._charCanvasImageData);

      this._fgColorPatchImageData.pasteAlphaChannel(this._charCanvasImageData);

      this._canvasCtx.globalCompositeOperation = "copy";
      this._canvasCtx.putImageData(this._fgColorPatchImageData.getImageData(), 0, 0);

      this._canvasCtx.globalCompositeOperation = "destination-over";
      this._canvasCtx.drawImage(this._bgColorPatchCanvas.getCanvas(), 0, 0);
    }

    this._renderColorCharacters(this._canvasCtx);
    this._renderCursors(this._canvasCtx);

    this._updateRenderedCellGrid();
  }

  private _renderCharacters(): void {
    const ctx = this._charCanvasCtx;

    ctx.fillStyle = "#ffffffff";
    ctx.globalCompositeOperation = "copy";

    const cellGrid = this._cellGrid;
    const renderedCellGrid = this._renderedCellGrid;
    const cellWidth = this.cellWidthPx;
    const cellHeight = this.cellHeightPx;
    const width = cellGrid.width;
    const height = cellGrid.height;
    const spaceCodePoint = " ".codePointAt(0);

    for (let j=0; j<height; j++) {

      // These control the correct re-rendering or not rendering
      // of cells which are to the right of multi-cell characters.
      let charWidthCounter = 0;
      let renderedCharWidthCounter = 0;

      for (let i=0; i<width; i++) {

        const flags = cellGrid.getFlags(i, j);
        const renderedFlags = renderedCellGrid.getFlags(i, j);

        const extraFontFlag = (flags & FLAG_MASK_EXTRA_FONT) !== 0;
        const renderedExtraFontFlag = (renderedFlags & FLAG_MASK_EXTRA_FONT) !== 0;

        if (extraFontFlag) {
          if ( ! renderedExtraFontFlag) {
            // Erase the char in the char canvas and make room for
            // the glyph from the extrafont which will be drawn later.
            this._fontAtlas.drawCodePoint(ctx, spaceCodePoint, 0, i * cellWidth, j * cellHeight);

          }
        } else {
          const codePoint = cellGrid.getCodePoint(i, j);
          const style = cellGrid.getStyle(i, j);
          const renderedCodePoint = renderedCellGrid.getCodePoint(i, j);
          const renderedStyle = renderedCellGrid.getStyle(i, j);

          const cellChanged = codePoint !== renderedCodePoint || style !== renderedStyle;

          let mustRender = false;
          if (cellChanged) {

            // Only allow the render if we aren't destroying an extra wide char to the left.
            if (charWidthCounter <= 0) {
              mustRender = true;
            }
          } else {
            if(renderedCharWidthCounter > 0 && charWidthCounter <= 0) {
              mustRender = true;
            }
          }
          charWidthCounter = Math.max(charWidthCounter,
                                      ((flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT)+1);
          renderedCharWidthCounter = Math.max(renderedCharWidthCounter,
                                              ((renderedFlags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT)+1);
          if (mustRender) {
            const effectiveCodePoint = (style & STYLE_MASK_INVISIBLE) ? spaceCodePoint : codePoint;
            this._fontAtlas.drawCodePoint(ctx, effectiveCodePoint, style, i * cellWidth, j * cellHeight);
          }
        }

        charWidthCounter--;
        renderedCharWidthCounter--;
      }
    }
  }

  private _renderCharactersToImageData(ctx: CanvasRenderingContext2D, imageData: ImageData): void {
    ctx.fillStyle = "#ffffffff";
    ctx.globalCompositeOperation = "copy";

    const height = this._cellGrid.height;
    for (let j=0; j<height; j++) {
      this._renderCharacterRowToImageData(imageData, j);
    }
  }

  private _renderCharacterRowToImageData(imageData: ImageData, row: number): void {
    /*
    This works by stepping through the contents of the previously rendered row and
    the new row contents and comparing the two. Differences between the two indicate
    glyphs/cells which need to rerendered. Sometimes multiple adjacent cells/glyphs
    need to be rendered at the same time, for example, full width (2 cells) characters
    and ligatures. We step through each row by one "group" of cells at a time. Most groups
    are a single char/cell. Full width and ligature groups can be 2-4 cells wide.

    Each trip through the main loop increments either the index into the rendered row
    OR the current row.

    For example:

    Previously rendered row is "same === X". Current row is "same = = Y". The "===" in
    the rendered row is a 3 cell wide ligature.

    The groups and the comparision between then look like this:

      Rendered row: [s] [a] [m] [e] [ ] [   ===   ] [ ] [X]

      Current row:  [s] [a] [m] [e] [ ] [=] [ ] [=] [ ] [Y]
                                        ^^^^^^^^^^^     ^^^
      Diffs which                           |            |
      trigger rendering:           Glyph size diff.  Code point diff.

    In this example the substring "= =" will need to be rendered, and the "Y" too.
    */

    const cellGrid = this._cellGrid;
    const renderedCellGrid = this._renderedCellGrid;
    const cellWidth = this.cellWidthPx;
    const cellHeight = this.cellHeightPx;
    const width = cellGrid.width;
    const spaceCodePoint = " ".codePointAt(0);

    let xRendered = 0;
    let x = 0;
    while (x < width) {
      const renderedFlags = renderedCellGrid.getFlags(xRendered, row);
      const renderedWidthChars = ((renderedFlags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT) + 1;
      if (xRendered < x) {
        xRendered += renderedWidthChars;
        continue;
      }

      const flags = cellGrid.getFlags(x, row);
      const widthChars = ((flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT) + 1;
      const style = cellGrid.getStyle(x, row);
      const ligature = cellGrid.getLigature(x, row);

      const extraFontFlag = (flags & FLAG_MASK_EXTRA_FONT) !== 0;
      const renderedExtraFontFlag = (renderedFlags & FLAG_MASK_EXTRA_FONT) !== 0;

      let mustRender = false;
      if (x < xRendered) {
        mustRender = true;
      } else {

        const renderedLigature = renderedCellGrid.getLigature(xRendered, row);
        const renderedStyle = renderedCellGrid.getStyle(xRendered, row);

        mustRender = (style !== renderedStyle) || (ligature !== renderedLigature);
        mustRender = mustRender || (extraFontFlag !== renderedExtraFontFlag);
        mustRender = mustRender || ! (
          widthChars === renderedWidthChars && (
            (cellGrid.getCodePoint(x, row) === renderedCellGrid.getCodePoint(xRendered, row)) &&
            (widthChars < 2 || (cellGrid.getCodePoint(x+1, row) === renderedCellGrid.getCodePoint(xRendered+1, row))) &&
            (widthChars < 3 || (cellGrid.getCodePoint(x+2, row) === renderedCellGrid.getCodePoint(xRendered+2, row))) &&
            (widthChars < 4 || (cellGrid.getCodePoint(x+3, row) === renderedCellGrid.getCodePoint(xRendered+3, row)))
          ));
      }

      if (mustRender) {
        if (flags & FLAG_MASK_LIGATURE) {
          const codePoints = [];
          for (let k=0; k<widthChars; k++) {
            codePoints[k] = cellGrid.getCodePoint(x+k, row);
          }
          this._fontAtlas.drawCodePointsToImageData(imageData, codePoints, style, x * cellWidth,
            row * cellHeight);
        } else {
          const codePoint = cellGrid.getCodePoint(x, row);
          const effectiveCodePoint = ((style & STYLE_MASK_INVISIBLE) || extraFontFlag) ? spaceCodePoint : codePoint;
          this._fontAtlas.drawCodePointToImageData(imageData, effectiveCodePoint, style, x * cellWidth,
            row * cellHeight);
        }
      }
      x += widthChars;
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
          const style = cellGrid.getStyle(i, j);
          const extraFont = this._getExtraFontSliceFromCodePoint(codePoint);
          extraFont.fontAtlas.drawCodePoint(ctx, codePoint, style, i * cellWidth, j * cellHeight);
        }
      }
    }
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

  private _updateRenderedCellGrid(): void {
    this._renderedCellGrid.pasteGrid(this._cellGrid, 0, 0);
  }

  /**
   * Scroll the whole canvas N rows downwards
   *
   * @param verticalOffsetChars number of rows to scroll downs. Accepts
   *                            negative values to scroll upwards.
   */
  scrollVertical(verticalOffsetChars: number): void {
    if (verticalOffsetChars === 0) {
      return;
    }

    if (this._renderer === Renderer.ImageBitmap) {
      this._scrollCharCanvas(verticalOffsetChars);
    } else {
      this._scrollCharImageData(verticalOffsetChars);
    }

    this._cellGrid.scrollVertical(verticalOffsetChars);
    this._renderedCellGrid.scrollVertical(verticalOffsetChars);
  }

  private _scrollCharCanvas(verticalOffsetChars: number): void {
    const ctx = this._charCanvasCtx;
    const scrollingUp = verticalOffsetChars < 0;

    const affectedHeightPx = (this._cellGrid.height - Math.abs(verticalOffsetChars)) * this.cellHeightPx;
    if (affectedHeightPx < 0) {
      // Scroll offset is so big that nothing will change on screen.
      return;
    }

    ctx.save();
    ctx.beginPath();
    if (scrollingUp) {
      ctx.rect(0, 0, this._canvasWidthPx, affectedHeightPx);
    } else {
      ctx.rect(0, verticalOffsetChars * this.cellHeightPx, this._canvasWidthPx, affectedHeightPx);
    }
    ctx.clip();

    this._charCanvasCtx.drawImage(this._charCanvas, 0, verticalOffsetChars * this.cellHeightPx);
    ctx.restore();
  }

  private _scrollCharImageData(verticalOffsetChars: number): void {
    if (verticalOffsetChars === 0) {
      return;
    }

    const affectedHeightPx = (this._cellGrid.height - Math.abs(verticalOffsetChars)) * this.cellHeightPx;
    if (affectedHeightPx < 0) {
      // Scroll offset is so big that nothing will change on screen.
      return;
    }

    const scrollingUp = verticalOffsetChars < 0;
    if (scrollingUp) {
      this._charCanvasImageData.data.copyWithin(0, (-verticalOffsetChars * this.cellHeightPx) * this._charCanvasImageData.width *4);
    } else {
      this._charCanvasImageData.data.copyWithin((verticalOffsetChars * this.cellHeightPx) * this._charCanvasImageData.width *4, 0);
    }
  }
}

function RGBAToCss(rgba: number): string {
  const red = (rgba >> 24) & 0xff;
  const green = (rgba >> 16) & 0xff;
  const blue = (rgba >> 8) & 0xff;
  const alpha = (rgba & 0xff) / 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
