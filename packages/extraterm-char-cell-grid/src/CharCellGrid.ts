/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { stringToCodePointArray, isWide, utf16LengthOfCodePoint } from "extraterm-unicode-utilities";

/**
 * Cell schema:
 *
 * 4 bytes  - Unicode code point
 * 2 byte   - Flags
 *            * 0x1 (bit 0) - true if using foreground CLUT
 *            * 0x2 (bit 1) - true if using background CLUT
 *            * 0x4 (bit 2) - true if extra fonts are used.
 *            * 0x18 (bit 3,4) - width of the char in cells-1, 0=normal 1 cell width, 1=2 cells.
 *            * 0x20 (bit 5) - true if this is the start of a ligature
 * 2 byte   - Style
 *            * 0x0003 (bit 0, 1) - 2 bit underline style, See UNDERLINE_STYLE_* constants.
 *            * 0x0004 (bit 2) - true if bold style
 *            * 0x0008 (bit 3) - true if italic style
 *            * 0x0010 (bit 4) - true if strikethrough style
 *            * 0x0020 (bit 5) - true if blink style
 *            * 0x0030 (bit 6) - true if inverse style
 *            * 0x0080 (bit 7) - true if invisible style
 *            * 0x0100 (bit 8) - true if faint style
 *            * 0x0200 (bit 9) - true if the cursor is in this cell
 *            * 0x0400 (bit 10) - true if overline style
 * 2 byte   - Foreground Colour Lookup Table (palette / CLUT) index
 * 2 byte   - Background Colour Lookup Table (palette / CLUT) index
 * 4 bytes  - Foreground RGBA bytes
 * 4 bytes  - Background RGBA bytes
 */

export const FLAG_MASK_FG_CLUT = 1;
export const FLAG_MASK_BG_CLUT = 2;
export const FLAG_MASK_EXTRA_FONT = 4;
export const FLAG_MASK_WIDTH = 0x18;
export const FLAG_WIDTH_SHIFT = 3;
export const FLAG_MASK_LIGATURE = 0x20;

export const STYLE_MASK_UNDERLINE = 3;
export const STYLE_MASK_BOLD = 4;
export const STYLE_MASK_ITALIC = 8;
export const STYLE_MASK_STRIKETHROUGH = 16;
export const STYLE_MASK_BLINK = 32;
export const STYLE_MASK_INVERSE = 64;
export const STYLE_MASK_INVISIBLE = 128;
export const STYLE_MASK_FAINT = 256;
export const STYLE_MASK_CURSOR = 512;
export const STYLE_MASK_OVERLINE = 1024;

export const UNDERLINE_STYLE_OFF = 0;
export const UNDERLINE_STYLE_NORMAL = 1;
export const UNDERLINE_STYLE_DOUBLE = 2;
export const UNDERLINE_STYLE_CURLY = 3;


export type StyleCode = number;

const CELL_SIZE_BYTES = 20;
const CELL_SIZE_UINT32 = CELL_SIZE_BYTES/4; // If this changes, then update pasteGrid().

const OFFSET_CODEPOINT = 0;
const OFFSET_FLAGS = 4;
const OFFSET_STYLE = 6;
const OFFSET_FG_CLUT_INDEX = 8;
const OFFSET_BG_CLUT_INDEX = 10;

const OFFSET_FG = 12;
const OFFSET_BG = 16;

/**
 * The expanded contents of one cell in the grid.
 */
export interface Cell {
  codePoint: number;
  flags: number;
  style: number;
  fgRGBA: number;
  bgRGBA: number;

  fgClutIndex: number;
  bgClutIndex: number;
}

export function setCellFgClutFlag(cell: Cell, useClut: boolean): void {
  if (useClut) {
    cell.flags = cell.flags | FLAG_MASK_FG_CLUT;
  } else {
    cell.flags = cell.flags & ~FLAG_MASK_FG_CLUT;
  }
}

export function setCellBgClutFlag(cell: Cell, useClut: boolean): void {
  if (useClut) {
    cell.flags = cell.flags | FLAG_MASK_BG_CLUT;
  } else {
    cell.flags = cell.flags & ~FLAG_MASK_BG_CLUT;
  }
}

/**
 * Copies the contents of the `source` cell object to the `dest` cell object.
 */
export function copyCell(source: Cell, dest: Cell): void {
  dest.flags = source.flags;
  dest.style = source.style;
  dest.fgClutIndex = source.fgClutIndex;
  dest.bgClutIndex = source.bgClutIndex;
  dest.fgRGBA = source.fgRGBA;
  dest.bgRGBA = source.bgRGBA;
}

export const FG_COLOR_INDEX = 257;
export const BG_COLOR_INDEX = 256;

const SpaceCell: Cell = {
  codePoint: " ".codePointAt(0),
  flags: 0,
  style: 0,
  fgClutIndex: FG_COLOR_INDEX,
  bgClutIndex: BG_COLOR_INDEX,
  fgRGBA: 0xffffffff,
  bgRGBA: 0x00000000,
};

/**
 * Represents a grid of character cells
 *
 * Each cell holds a single unicode codepoint and can have multiple styles
 * and foreground/background colors applied.
 *
 * This code uses a fast and compact representation of the data.
 */
export class CharCellGrid {

  private _rawBuffer: ArrayBuffer;
  private _dataView: DataView;
  private _uint8View: Uint8Array;

  constructor(public readonly width: number, public readonly height: number, public palette: number[]=null,
      __bare__=false) {
    if (__bare__) {
      return;
    }
    this._rawBuffer = new ArrayBuffer(width * height * CELL_SIZE_BYTES);
    this._dataView = new DataView(this._rawBuffer);
    this._uint8View = new Uint8Array(this._rawBuffer);
    this.clear();
  }

  setPalette(palette: number[]) : void {
    this.palette = palette;
    this._reapplyPalette();
  }

  getPalette(): number[] {
    return this.palette;
  }

  private _reapplyPalette(): void {
    const width = this.width;
    const height = this.height;
    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        if (this.isBgClut(i, j)) {
          this.setBgClutIndex(i, j, this.getBgClutIndex(i,j));
        }
        if (this.isFgClut(i, j)) {
          this.setFgClutIndex(i, j, this.getFgClutIndex(i,j));
        }
      }
    }
  }

  clone(): CharCellGrid {
    const grid = new CharCellGrid(this.width, this.height, this.palette);
    this.cloneInto(grid);
    return grid;
  }

  cloneInto(grid: CharCellGrid): void {
    grid._rawBuffer = this._rawBuffer.slice(0);
    grid._dataView = new DataView(grid._rawBuffer);
    grid._uint8View = new Uint8Array(grid._rawBuffer);
  }

  clear(): void {
    const spaceCodePoint = " ".codePointAt(0);
    const maxChar = this.width * this.height;
    let offset = 0;

    const fgRGBA = this.palette == null ? 0xffffffff : this.palette[FG_COLOR_INDEX];
    const bgRGBA = this.palette == null ? 0x00000000 : this.palette[BG_COLOR_INDEX];

    for (let i=0; i<maxChar; i++, offset += CELL_SIZE_BYTES) {
      this._dataView.setUint32(offset, spaceCodePoint);
      this._dataView.setUint16(offset + OFFSET_FLAGS, FLAG_MASK_FG_CLUT | FLAG_MASK_BG_CLUT);
      this._dataView.setUint16(offset + OFFSET_STYLE, 0);
      this._dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, FG_COLOR_INDEX);
      this._dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, BG_COLOR_INDEX);
      this._dataView.setUint32(offset + OFFSET_FG, fgRGBA);
      this._dataView.setUint32(offset + OFFSET_BG, bgRGBA);
    }
  }

  getCell(x: number, y: number): Cell {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const cell: Cell = {
      codePoint: this._dataView.getUint32(offset),
      flags: this._dataView.getUint16(offset + OFFSET_FLAGS),
      style: this._dataView.getUint16(offset + OFFSET_STYLE),
      fgClutIndex: this._dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX),
      bgClutIndex: this._dataView.getUint16(offset + OFFSET_BG_CLUT_INDEX),
      fgRGBA: this._dataView.getUint32(offset + OFFSET_FG),
      bgRGBA: this._dataView.getUint32(offset + OFFSET_BG),
    };
    return cell;
  }

  setCell(x: number, y: number, cell: Cell): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this._dataView.setUint32(offset, cell.codePoint);
    this._dataView.setUint16(offset + OFFSET_FLAGS, cell.flags);
    this._dataView.setUint16(offset + OFFSET_STYLE, cell.style);
    this._dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, cell.fgClutIndex);
    this._dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, cell.bgClutIndex);
    this._dataView.setUint32(offset + OFFSET_FG, cell.fgRGBA);
    this._dataView.setUint32(offset + OFFSET_BG, cell.bgRGBA);
  }

  clearCell(x: number, y: number): void {
    this.setCell(x, y, SpaceCell);
  }

  formatCellDebug(x: number, y: number): string {
    return (`{ char: '${String.fromCodePoint(this.getCodePoint(x, y))}', ` +
      `codePoint: ${this.getCodePoint(x, y)}, ` +
      `extraWidth: ${this.getCharExtraWidth(x, y)}, ` +
      `ligature: ${this.getLigature(x, y)}, ` +
      `}`);
  }

  formatRowDebug(y: number): string {
    const result = [];
    for (let i=0; i<this.width; i++) {
      result.push("" + i + ": " + this.formatCellDebug(i, y));
    }
    return result.join("\n");
  }

  setCodePoint(x: number, y: number, codePoint: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const width = isWide(codePoint) ? 1 : 0;
    const flags = this._dataView.getUint16(offset + OFFSET_FLAGS);
    const newFlags = (flags & ~FLAG_MASK_WIDTH) | (width << FLAG_WIDTH_SHIFT);
    this._dataView.setUint16(offset + OFFSET_FLAGS, newFlags);

    this._dataView.setUint32(offset + OFFSET_CODEPOINT, codePoint);
  }

  getCodePoint(x: number, y: number): number {
    return this._dataView.getUint32((y * this.width + x) * CELL_SIZE_BYTES + OFFSET_CODEPOINT);
  }

  getCharExtraWidth(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this._dataView.getUint16(offset + OFFSET_FLAGS);
    return (flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT;
  }

  getFlags(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint16(offset + OFFSET_FLAGS);
  }

  getRowFlags(y: number): Uint16Array {
    const flagsArray = new Uint16Array(this.width);
    let offset = y * this.width * CELL_SIZE_BYTES + OFFSET_FLAGS;
    const width = this.width;
    for (let i=0; i<width; i++) {
      flagsArray[i] = this._dataView.getUint16(offset);
      offset += CELL_SIZE_BYTES;
    }
    return flagsArray;
  }

  setRowFlags(y: number, flagsArray: Uint16Array, flagMask=0xffff): void {
    let offset = y * this.width * CELL_SIZE_BYTES + OFFSET_FLAGS;
    const width = Math.min(this.width, flagsArray.length);

    if (flagMask === 0xffff) {
      for (let i=0; i<width; i++) {
        this._dataView.setUint16(offset, flagsArray[i]);
        offset += CELL_SIZE_BYTES;
      }
    } else {
      const invMask = ~flagMask;
      for (let i=0; i<width; i++) {
        const oldValue = this._dataView.getUint16(offset);
        const newValue = (oldValue & invMask) | (flagMask & flagsArray[i]);
        this._dataView.setUint16(offset, newValue);
        offset += CELL_SIZE_BYTES;
      }
    }
  }

  setString(x: number, y: number, str: string): void {
    const codePointArray = stringToCodePointArray(str);
    for (let i=0; i<codePointArray.length; i++) {
      this.setCodePoint(x+i, y, codePointArray[i]);
    }
  }

  getString(x: number, y: number, count?: number): string {
    const codePoints: number[] = [];

    const lastX = x + (count == null ? this.width : Math.min(this.width, count));
    for (let i=x; i<lastX; i++) {
      codePoints.push(this.getCodePoint(i, y));
    }
    return String.fromCodePoint(...codePoints);
  }

  getUTF16StringLength(x: number, y: number, count?: number): number {
    const lastX = x + (count == null ? this.width : Math.min(this.width, count));
    let size = 0;
    for (let i=x; i<lastX; i++) {
      const codePoint = this.getCodePoint(i, y);
      size += utf16LengthOfCodePoint(codePoint);
    }
    return size;
  }

  getRowCodePoints(y: number, destinationArray?: Uint32Array): Uint32Array {
    const width = this.width;
    const destArray = destinationArray == null ? new Uint32Array(width) : destinationArray;
    for (let i=0; i<width; i++) {
      destArray[i] = this.getCodePoint(i, y);
    }
    return destArray;
  }

  setBgRGBA(x: number, y: number, rgba: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this._dataView.setUint32(offset + OFFSET_BG, rgba);

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) & ~FLAG_MASK_BG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);
  }

  getBgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint32(offset + OFFSET_BG);
  }

  setFgRGBA(x: number, y: number, rgba: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this._dataView.setUint32(offset + OFFSET_FG, rgba);

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) & ~FLAG_MASK_FG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);
  }

  getFgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint32(offset + OFFSET_FG);
  }

  setFgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) | FLAG_MASK_FG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);

    this._dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, index);

    this._updateInternalRGB(index, offset);
  }

  private _updateInternalRGB(index: number, offset: number): void {
    if (this.palette != null) {
      const style = this._dataView.getUint16(offset + OFFSET_STYLE);
      let rgba = 0;
      if (index <8 && style & STYLE_MASK_BOLD) {
        rgba = this.palette[index + 8];
      } else {
        rgba = this.palette[index];
      }
      this._dataView.setUint32(offset + OFFSET_FG, rgba);
    }
  }

  getFgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX);
  }

  isFgClut(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this._dataView.getUint16(offset + OFFSET_FLAGS) & FLAG_MASK_FG_CLUT) !== 0;
  }

  setBgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) | FLAG_MASK_BG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);

    this._dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, index);

    if (this.palette != null) {
      const rgba = this.palette[index];
      this._dataView.setUint32(offset + OFFSET_BG, rgba);
    }
  }

  getBgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint16(offset + OFFSET_BG_CLUT_INDEX);
  }

  isBgClut(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this._dataView.getUint16(offset + OFFSET_FLAGS) & FLAG_MASK_BG_CLUT) !== 0;
  }

  setStyle(x: number, y: number, style: StyleCode): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    this._dataView.setUint16(offset + OFFSET_STYLE, style);

    const ifFgClut = this._dataView.getUint16(offset + OFFSET_FLAGS) & FLAG_MASK_FG_CLUT;
    if (ifFgClut) {
      const index = this._dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX);
      this._updateInternalRGB(index, offset);
    }
  }

  getStyle(x: number, y: number): StyleCode {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    return this._dataView.getUint16(offset + OFFSET_STYLE);
  }

  getExtraFontsFlag(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this._dataView.getUint16(offset + OFFSET_FLAGS) & FLAG_MASK_EXTRA_FONT) !== 0;
  }

  setExtraFontsFlag(x: number, y: number, on: boolean): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    let flags = this._dataView.getUint16(offset + OFFSET_FLAGS);
    if (on) {
      flags = flags | FLAG_MASK_EXTRA_FONT;
    } else {
      flags = flags & ~FLAG_MASK_EXTRA_FONT;
    }
    this._dataView.setUint16(offset + OFFSET_FLAGS, flags);
  }

  setLigature(x: number, y: number, ligatureLength: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this._dataView.getUint16(offset + OFFSET_FLAGS);
    if (ligatureLength <= 1) {
      if (flags & FLAG_MASK_LIGATURE) {
        // Clear ligature flag and set width to 1 (normal)
        this._dataView.setUint16(offset + OFFSET_FLAGS, flags & ~(FLAG_MASK_LIGATURE|FLAG_MASK_WIDTH));
      }
    } else {
      const widthBits = (ligatureLength-1) << FLAG_WIDTH_SHIFT;
      const newFlags = (flags & ~FLAG_MASK_WIDTH) | FLAG_MASK_LIGATURE | widthBits;
      this._dataView.setUint16(offset + OFFSET_FLAGS, newFlags);
    }
  }

  getLigature(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this._dataView.getUint16(offset + OFFSET_FLAGS);
    if ((flags & FLAG_MASK_LIGATURE) !== 0) {
      return this.getCharExtraWidth(x, y) + 1;
    } else {
      return 0;
    }
  }

  shiftCellsRight(x: number, y: number, shiftCount: number): void {
    const offsetCell = y * this.width;
    const moveCount = this.width - x - shiftCount;
    if (moveCount <= 0) {
      return;
    }

    this._uint8View.copyWithin((offsetCell + x + shiftCount) * CELL_SIZE_BYTES,  // target pos
                                (offsetCell + x) * CELL_SIZE_BYTES,         // source pos
                                (offsetCell + this.width - shiftCount) * CELL_SIZE_BYTES); // end pos
  }

  /**
   * Scroll part of a row to the left
   *
   * The region to be scrolled to the left is the row of cells starting from
   * (x,y) and extending to the right edge of the grid. The region is then
   * scrolled `shiftCount` number of cells to the left inside the region.
   * Cells on the left side of the region are removed and empty cells are
   * shifted in from the right side.
   *
   * @param x
   * @param y
   * @param shiftCount
   */
  shiftCellsLeft(x: number, y: number, shiftCount: number): void {
    const offsetCell = y * this.width;
    if ((x + shiftCount) < this.width) {
      this._uint8View.copyWithin((offsetCell + x) * CELL_SIZE_BYTES,                // target pos
                                  (offsetCell + x + shiftCount) * CELL_SIZE_BYTES,  // source pos
                                  (offsetCell + this.width) * CELL_SIZE_BYTES);     // end pos
    }

    for (let i=Math.max(x, this.width-shiftCount); i < this.width; i++) {
      this.setCell(i, y, SpaceCell);
    }
  }

  pasteGrid(sourceGrid: CharCellGrid, x: number, y: number): void {
    const endY = Math.min(y+sourceGrid.height, this.height);
    const endH = Math.min(x+sourceGrid.width, this.width);

    const uint32ArrayDest = new Uint32Array(this._rawBuffer);
    const uint32ArraySource = new Uint32Array(sourceGrid._rawBuffer);

    const sx = x < 0 ? -x : 0;
    x = Math.max(x, 0);
    let sv = y < 0 ? -y : 0;
    y = Math.max(y, 0);

    for (let v=y; v<endY; v++, sv++) {
      let sourceOffset = (sv*sourceGrid.width +sx) * CELL_SIZE_UINT32;
      let destOffset = (v*this.width + x) * CELL_SIZE_UINT32;
      for (let h=x; h<endH; h++) {

        // Unrolled copy loop for when CELL_SIZE_UINT32 is 5

        uint32ArrayDest[destOffset] = uint32ArraySource[sourceOffset];
        destOffset++;
        sourceOffset++;

        uint32ArrayDest[destOffset] = uint32ArraySource[sourceOffset];
        destOffset++;
        sourceOffset++;

        uint32ArrayDest[destOffset] = uint32ArraySource[sourceOffset];
        destOffset++;
        sourceOffset++;

        uint32ArrayDest[destOffset] = uint32ArraySource[sourceOffset];
        destOffset++;
        sourceOffset++;

        uint32ArrayDest[destOffset] = uint32ArraySource[sourceOffset];
        destOffset++;
        sourceOffset++;
      }

      if (this.palette != null) {
        for (let h=x; h<endH; h++) {
          if (this.isBgClut(h, v)) {
            this.setBgClutIndex(h, v, this.getBgClutIndex(h, v));
          }
          if (this.isFgClut(h, v)) {
            this.setFgClutIndex(h, v, this.getFgClutIndex(h, v));
          }

          destOffset += CELL_SIZE_UINT32;
        }
      }
    }
  }

  /**
   * Scroll the whole grid N rows downwards
   *
   * @param verticalOffset number of rows to scroll downs. Accepts
   *                       negative values to scroll upwards.
   */
  scrollVertical(verticalOffset: number): void {
    if (verticalOffset === 0) {
      return;
    }

    if (verticalOffset < 0) {
      this._scrollUp(verticalOffset);
    } else {
      this._scrollDown(verticalOffset);
    }
  }

  private _scrollUp(verticalOffset: number): void {
    const absOffset = Math.abs(verticalOffset);
    const rowWidthUint32 = this.width * CELL_SIZE_UINT32;

    for(let srcY=absOffset, destY=0; srcY<this.height; srcY++, destY++) {
      const sourceOffset = srcY * rowWidthUint32;
      const destOffset =  destY * rowWidthUint32;
      this._copyRow(sourceOffset, destOffset);
    }
  }

  private _scrollDown(verticalOffset: number): void {
    const absOffset = Math.abs(verticalOffset);
    const rowWidthUint32 = this.width * CELL_SIZE_UINT32;

    for(let srcY=this.height-1-absOffset, destY=this.height-1; srcY>=0; srcY--, destY--) {
      const sourceOffset = srcY * rowWidthUint32;
      const destOffset =  destY * rowWidthUint32;
      this._copyRow(sourceOffset, destOffset);
    }
  }

  private _copyRow(sourceOffset: number, destOffset: number): void {
    const width = this.width;
    const uint32Array = new Uint32Array(this._rawBuffer);
    for (let h=0; h<width; h++) {

      // Unrolled copy loop for when CELL_SIZE_UINT32 is 5

      uint32Array[destOffset] = uint32Array[sourceOffset];
      destOffset++;
      sourceOffset++;

      uint32Array[destOffset] = uint32Array[sourceOffset];
      destOffset++;
      sourceOffset++;

      uint32Array[destOffset] = uint32Array[sourceOffset];
      destOffset++;
      sourceOffset++;

      uint32Array[destOffset] = uint32Array[sourceOffset];
      destOffset++;
      sourceOffset++;

      uint32Array[destOffset] = uint32Array[sourceOffset];
      destOffset++;
      sourceOffset++;
    }
  }
}
