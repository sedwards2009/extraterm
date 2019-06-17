/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { CharCellGrid, STYLE_MASK_CURSOR, STYLE_MASK_INVERSE } from "extraterm-char-cell-grid";


export class ColorPatchCanvas {
  private _backgroundCanvas: HTMLCanvasElement = null;
  private _backgroundCtx: CanvasRenderingContext2D = null;

  private _fullSizeBackgroundCanvas: HTMLCanvasElement = null;
  private _fullSizeBackgroundCtx: CanvasRenderingContext2D = null;

  private _canvasWidthPx: number;
  private _canvasHeightPx: number;

  constructor(
      private _cellGrid: CharCellGrid,
      private _cellWidth: number,
      private _cellHeight: number,
      private _fgOrBg: "foreground" | "background",
      private _cursorColor: number,
      parentElement: HTMLElement) {

    this._canvasWidthPx = this._cellGrid.width * this._cellWidth;
    this._canvasHeightPx = this._cellGrid.height * this._cellHeight;

    this._backgroundCanvas = <HTMLCanvasElement> document.createElement("canvas");
    this._backgroundCanvas.width = this._cellGrid.width;
    this._backgroundCanvas.height = this._cellGrid.height;
    this._backgroundCtx = this._backgroundCanvas.getContext("2d", { alpha: true });
    // parentElement.appendChild(this._backgroundCanvas);

    this._fullSizeBackgroundCanvas = <HTMLCanvasElement> document.createElement("canvas");
    this._fullSizeBackgroundCanvas.width = this._canvasWidthPx;
    this._fullSizeBackgroundCanvas.height = this._canvasHeightPx;
    this._fullSizeBackgroundCtx = this._fullSizeBackgroundCanvas.getContext("2d", { alpha: true });
    // parentElement.appendChild(this._fullSizeBackgroundCanvas);
  }

  setCursorColor(color: number): void {
    this._cursorColor = color;
  }

  getCanvas(): HTMLCanvasElement {
    return this._fullSizeBackgroundCanvas;
  }

  render(): void {
    const ctx = this._backgroundCtx;

    const widthChars = this._cellGrid.width;
    const heightChars = this._cellGrid.height;

    ctx.fillStyle = "#000000ff";
    ctx.fillRect(0, 0, widthChars, heightChars);

    let getRGBA: (x: number, y: number) => number = null;
    if (this._fgOrBg === "foreground") {
      getRGBA = (x: number, y: number): number => {
        const style = this._cellGrid.getStyle(x, y);
        if (style & STYLE_MASK_CURSOR) {
          return this._cursorColor;
        } else {
          return (style & STYLE_MASK_INVERSE) ? this._cellGrid.getBgRGBA(x, y) : this._cellGrid.getFgRGBA(x, y);
        }
      };
    } else {
      getRGBA = (x: number, y: number): number => {
        const style = this._cellGrid.getStyle(x, y);
        if (style & STYLE_MASK_CURSOR) {
          return this._cursorColor;
        } else {
          return (style & STYLE_MASK_INVERSE) ? this._cellGrid.getFgRGBA(x, y) : this._cellGrid.getBgRGBA(x, y);
        }
      };
    }

    const imageData = ctx.createImageData(widthChars, heightChars);
    const rawImageData = imageData.data;
    
    let offset = 0;
    for (let j=0; j<heightChars; j++) {
      for (let i=0; i<widthChars; i++) {
        const rgba = getRGBA(i, j);
        rawImageData[offset] = (rgba >> 24) & 0xff; // Red
        offset++;
        rawImageData[offset] = (rgba >> 16) & 0xff; // Green
        offset++;
        rawImageData[offset] = (rgba >> 8) & 0xff; // Blue
        offset++;
        rawImageData[offset] = 255; // Alpha
        offset++;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const cellWidth = this._cellWidth;
    const cellHeight = this._cellHeight;

    this._fullSizeBackgroundCtx.imageSmoothingEnabled = false;
    this._fullSizeBackgroundCtx.setTransform(cellWidth, 0, 0, cellHeight, 0, 0);
    this._fullSizeBackgroundCtx.drawImage(this._backgroundCanvas, 0, 0);
  }
}
