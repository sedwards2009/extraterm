/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { StyleCode, STYLE_MASK_BOLD, STYLE_MASK_ITALIC, STYLE_MASK_STRIKETHROUGH, STYLE_MASK_UNDERLINE } from "extraterm-char-cell-grid";
import * as easta from "easta";
import { MonospaceFontMetrics } from "./MonospaceFontMetrics";

const log = console.log.bind(console);


export class FontAtlas {

  private _cellWidth: number = 0;
  private _cellHeight: number = 0;
  private _pages: FontAtlasPage[] = [];

  constructor(private readonly _metrics: MonospaceFontMetrics) {
    this._cellWidth = this._metrics.widthPx;
    this._cellHeight = this._metrics.heightPx;
    log(`FontAtlas cellWidth: ${this._cellWidth}, cellHeight: ${this._cellHeight}`);
    this._appendPage();
  }

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode,
                xPixel: number, yPixel: number): void {

    for (let page of this._pages) {
      if (page.drawCodePoint(ctx, codePoint, style, xPixel, yPixel)) {
        return;
      }
    }

    const page = this._appendPage();
    page.drawCodePoint(ctx, codePoint, style, xPixel, yPixel);
  }

  private _appendPage(): FontAtlasPage {
    const page = new FontAtlasPage(this._metrics);
    this._pages.push(page);
    return page;
  }
}

//-------------------------------------------------------------------------

const FONT_ATLAS_PAGE_WIDTH_CELLS = 8;
const FONT_ATLAS_PAGE_HEIGHT_CELLS = 32;


interface CachedGlyph {
  xPixels: number;
  yPixels: number;
  isWide: boolean;
  imageBitmapPromise: Promise<ImageBitmap>;
  imageBitmap: ImageBitmap;
}


class FontAtlasPage {

  private _pageCanvas: HTMLCanvasElement = null;
  private _pageCtx: CanvasRenderingContext2D = null;
  private _safetyPadding: number = 0;

  private _nextEmptyCellX: number = 0;
  private _nextEmptyCellY: number = 0;
  private _lookupTable: Map<number, CachedGlyph> = new Map();
  private _isFull = false;

  constructor(private readonly _metrics: MonospaceFontMetrics) {
    log(`FontAtlasPage cellWidth: ${this._metrics.widthPx}, cellHeight: ${this._metrics.heightPx}`);
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

  drawCodePoint(ctx: CanvasRenderingContext2D, codePoint: number, style: StyleCode, xPixel: number, yPixel: number): boolean {
    let cachedGlyph = this._lookupTable.get((style << 24) | codePoint);
    if (cachedGlyph == null) {
      if (this._isFull) {
        return false;
      }
      cachedGlyph = this._insertChar(codePoint, style);
    }

    const widthPx = cachedGlyph.isWide ? 2*this._metrics.widthPx : this._metrics.widthPx;
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
    return true;
  }

  private _insertChar(codePoint: number, style: StyleCode): CachedGlyph {
    const xPixels = this._nextEmptyCellX * (this._metrics.widthPx + this._safetyPadding*2) + this._safetyPadding;
    const yPixels = this._nextEmptyCellY * (this._metrics.heightPx + this._safetyPadding*2) + this._safetyPadding;
    const str = String.fromCodePoint(codePoint);

    const isWide = isFullWidth(str);
    const widthPx = isWide ? 2*this._metrics.widthPx : this._metrics.widthPx;

    let styleName = "";
    if (style & STYLE_MASK_BOLD) {
      styleName += "bold ";
    }
    if (style & STYLE_MASK_ITALIC) {
      styleName += "italic ";
    }

    this._pageCtx.font = styleName + this._metrics.fontSizePx + "px " + this._metrics.fontFamily;
    this._pageCtx.fillText(str, xPixels + this._metrics.fillTextXOffset, yPixels + this._metrics.fillTextYOffset);

    if (style & STYLE_MASK_STRIKETHROUGH) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.strikethroughY,
                              widthPx, this._metrics.strikethroughHeight);
    }

    if (style & STYLE_MASK_UNDERLINE) {
      this._pageCtx.fillRect(xPixels,
                              yPixels + this._metrics.underlineY,
                              widthPx, this._metrics.underlineHeight);
    }

    // ImageBitmaps are meant to be much fast to paint with compared to normal canvas.
    const promise = window.createImageBitmap(this._pageCanvas, xPixels, yPixels, widthPx, this._metrics.heightPx);
    const cachedGlyph = {
      xPixels,
      yPixels,
      isWide,
      imageBitmapPromise: promise,
      imageBitmap: null
    };
    promise.then((imageBitmap: ImageBitmap) => {
      cachedGlyph.imageBitmap = imageBitmap;
      cachedGlyph.imageBitmapPromise = null;
    });

    this._lookupTable.set((style << 24) | codePoint, cachedGlyph);

    this._incrementNextEmptyCell();
    if (isWide) {
      this._incrementNextEmptyCell();
    }

    return cachedGlyph;
  }

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


function isFullWidth(ch: string): boolean {
  switch (easta(ch)) {
  	case 'Na': //Narrow
 	  return false;
  	case 'F': //FullWidth
  	  return true;
  	case 'W': // Wide
  	  return true;
  	case 'H': //HalfWidth
  	  return false;
  	case 'A': //Ambiguous
  	  return false;
  	case 'N': //Neutral
  	  return false;
  	default:
  	  return false;
  }
}

