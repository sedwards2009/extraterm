/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */
import { CharCellGrid, STYLE_MASK_CURSOR, STYLE_MASK_INVERSE } from "extraterm-char-cell-grid";


export class ColorPatchImageData {

  private _imageData: ImageData = null;
  private _imageWidthPx: number;
  private _imageHeightPx: number;

  private _renderCursor = true;

  constructor(
      private _cellGrid: CharCellGrid,
      private _cellWidth: number,
      private _cellHeight: number,
      private _fgOrBg: "foreground" | "background",
      private _cursorColor: number) {

    this._imageWidthPx = this._cellGrid.width * this._cellWidth;
    this._imageHeightPx = this._cellGrid.height * this._cellHeight;

    this._imageData = new ImageData(this._imageWidthPx, this._imageHeightPx);
  }

  getImageData(): ImageData {
    return this._imageData;
  }

  setCursorColor(color: number): void {
    this._cursorColor = color;
  }

  setRenderCursor(renderCursor: boolean): void {
    this._renderCursor = renderCursor;
  }

  render(): void {
    const renderCursor = this._renderCursor;

    let getRGBA: (x: number, y: number) => number = null;
    if (this._fgOrBg === "foreground") {
      getRGBA = (x: number, y: number): number => {
        const style = this._cellGrid.getStyle(x, y);
        if ((style & STYLE_MASK_CURSOR) && renderCursor) {
          return this._cursorColor;
        } else {
          return (style & STYLE_MASK_INVERSE) ? this._cellGrid.getBgRGBA(x, y) : this._cellGrid.getFgRGBA(x, y);
        }
      };
    } else {
      getRGBA = (x: number, y: number): number => {
        const style = this._cellGrid.getStyle(x, y);
        if ((style & STYLE_MASK_CURSOR) && renderCursor) {
          return this._cursorColor;
        } else {
          return (style & STYLE_MASK_INVERSE) ? this._cellGrid.getFgRGBA(x, y) : this._cellGrid.getBgRGBA(x, y);
        }
      };
    }

    const widthChars = this._cellGrid.width;
    const heightChars = this._cellGrid.height;
    const imageData = this._imageData;
    const rawImageData = imageData.data;
    const cellWidth = this._cellWidth;
    const cellHeight = this._cellHeight;

    for (let j=0; j<heightChars; j++) {
      for (let cy=0; cy<cellHeight; cy++) {
        let offset = (((cellHeight * j) + cy) * imageData.width) * 4;
        for (let i=0; i<widthChars; i++) {
          const rgba = getRGBA(i, j);

          const red = (rgba >> 24) & 0xff; // Red
          const green = (rgba >> 16) & 0xff; // Green
          const blue = (rgba >> 8) & 0xff; // Blue
          const alpha = rgba & 0xff; // Alpha

          for (let cx=0; cx<cellWidth; cx++) {
            rawImageData[offset] = red;
            offset++;
            rawImageData[offset] = green;
            offset++;
            rawImageData[offset] = blue;
            offset++;
            rawImageData[offset] = alpha;
            offset++;
          }
        }
      }
    }
  }

  pasteAlphaChannel(imageData: ImageData): void {
    const patchImageData = this._imageData;

    const effectiveWidth = Math.min(patchImageData.width, imageData.width) * 4;
    const patchImageDataArray = patchImageData.data;
    const imageDataArray = imageData.data;
    for (let j=0; j < Math.min(patchImageData.height, imageData.height); j++) {
      const patchOffset = j * patchImageData.width * 4 + 3;
      const imageDataOffset = j * imageData.width * 4 + 3;
      for (let i=0; i < effectiveWidth; i+=4) {
        patchImageDataArray[i + patchOffset] = imageDataArray[i + imageDataOffset];
      }
    }
  }
}
