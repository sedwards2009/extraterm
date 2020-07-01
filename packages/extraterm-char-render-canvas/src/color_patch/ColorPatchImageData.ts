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
    const isBackground = this._fgOrBg === "background";
    const widthChars = this._cellGrid.width;
    const heightChars = this._cellGrid.height;
    const imageData = this._imageData;
    const rawImageData = imageData.data;
    const cellWidth = this._cellWidth;
    const cellHeight = this._cellHeight;
    const rowWidthBytes = imageData.width * 4;

    for (let j=0; j<heightChars; j++) {

      const startOffset = cellHeight * j * rowWidthBytes;
      let offset = startOffset;

      for (let i=0; i<widthChars; i++) {
        let rgba = 0;
        const style = this._cellGrid.getStyle(i, j);
        if ((style & STYLE_MASK_CURSOR) && renderCursor) {
          rgba = this._cursorColor;
        } else {
          rgba = (((style & STYLE_MASK_INVERSE) !==0) !== isBackground
                  ? this._cellGrid.getBgRGBA(i, j)
                  : this._cellGrid.getFgRGBA(i, j));
        }

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

      for (let cy=1; cy<cellHeight; cy++) {
        const targetOffset = startOffset + rowWidthBytes * cy;
        rawImageData.copyWithin(targetOffset, startOffset, targetOffset + rowWidthBytes);
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
      const imageDataOffset = j * imageData.width * 4;
      for (let i=0; i < effectiveWidth; i+=4) {
        const red = imageDataArray[i + imageDataOffset];
        const green = imageDataArray[i + imageDataOffset];
        const blue = imageDataArray[i + imageDataOffset];
        const brightness = (red + red + red + blue + green + green + green + green) >> 3;
        patchImageDataArray[i + patchOffset] = brightness;
      }
    }
  }
}
