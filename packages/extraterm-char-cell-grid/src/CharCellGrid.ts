/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { stringToCodePointArray } from "./UnicodeUtils";

/**
 * Cell schema:
 * 
 * 4 bytes  - Unicode code point
 * 2 byte   - Flags
 *            * 0x1 (bit 0) - true if using foreground CLUT
 *            * 0x2 (bit 1) - true if using background CLUT
 *            * 0x4 (bit 2) - true if extra fonts are used.
 *            * 0x38 (bit 3,4,5) ligature size as 3 bit number.
 * 2 byte   - Style
 *            * 0x0001 (bit 0) - true if bold style
 *            * 0x0002 (bit 1) - true if underline style
 *            * 0x0004 (bit 2) - true if italic style
 *            * 0x0008 (bit 3) - true if strikethrough style
 *            * 0x0010 (bit 4) - true if blink style
 *            * 0x0020 (bit 5) - true if inverse style
 *            * 0x0040 (bit 6) - true if invisible style
 *            * 0x0080 (bit 7) - true if faint style
 *            * 0x0100 (bit 8) - true if the cursor is in this cell
 * 2 byte   - Foreground Colour Lookup Table (palette / CLUT) index
 * 2 byte   - Background Colour Lookup Table (palette / CLUT) index
 * 4 bytes  - Foreground RGBA bytes
 * 4 bytes  - Background RGBA bytes
 */

const FLAG_MASK_FG_CLUT = 1;
const FLAG_MASK_BG_CLUT = 2;
const FLAG_MASK_EXTRA_FONT = 4;
const FLAG_MASK_LIGATURE = 0x38;
const FLAG_RSHIFT_LIGATURE = 3;

export const STYLE_MASK_BOLD = 1;
export const STYLE_MASK_UNDERLINE = 2;
export const STYLE_MASK_ITALIC = 4;
export const STYLE_MASK_STRIKETHROUGH = 8;
export const STYLE_MASK_BLINK = 16;
export const STYLE_MASK_INVERSE = 32;
export const STYLE_MASK_INVISIBLE = 64;
export const STYLE_MASK_FAINT = 128;
export const STYLE_MASK_CURSOR = 256;

type StyleCode = number;

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

const FG_COLOR_INDEX = 257;
const BG_COLOR_INDEX = 256;

const SpaceCell: Cell = {
  codePoint: " ".codePointAt(0),
  flags: 0,
  style: 0,
  fgClutIndex: FG_COLOR_INDEX,
  bgClutIndex: BG_COLOR_INDEX,
  fgRGBA: 0xffffffff,
  bgRGBA: 0x00000000,
}    

export class CharCellGrid {

  private _rawBuffer: ArrayBuffer;
  private _dataView: DataView;
  private _uint8View: Uint8Array;

  constructor(public readonly width: number, public readonly height: number, private readonly _palette: number[]=null,
      __bare__=false) {
    if (__bare__) {
      return;
    }
    this._rawBuffer = new ArrayBuffer(width * height * CELL_SIZE_BYTES);
    this._dataView = new DataView(this._rawBuffer);
    this._uint8View = new Uint8Array(this._rawBuffer);
    this.clear();
  }

  clone(): CharCellGrid {
    const grid = new CharCellGrid(this.width, this.height, this._palette);
    grid._rawBuffer = this._rawBuffer.slice(0);
    grid._dataView = new DataView(grid._rawBuffer);
    grid._uint8View = new Uint8Array(grid._rawBuffer);
    return grid;
  }

  clear(): void {
    const spaceCodePoint = " ".codePointAt(0);
    const maxChar = this.width * this.height;
    let offset = 0;
    for (let i=0; i<maxChar; i++, offset += CELL_SIZE_BYTES) {
      this._dataView.setUint32(offset, spaceCodePoint);
      this._dataView.setUint16(offset + OFFSET_FLAGS, 0);
      this._dataView.setUint16(offset + OFFSET_STYLE, 0);
      this._dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, 0);
      this._dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, 0);
      this._dataView.setUint32(offset + OFFSET_FG, 0xffffffff);
      this._dataView.setUint32(offset + OFFSET_BG, 0x000000ff);
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

  setCodePoint(x: number, y: number, codePoint: number): void {
    this._dataView.setUint32((y * this.width + x) * CELL_SIZE_BYTES + OFFSET_CODEPOINT, codePoint);
  }

  getCodePoint(x: number, y: number): number {
    return this._dataView.getUint32((y * this.width + x) * CELL_SIZE_BYTES + OFFSET_CODEPOINT);
  }

  setString(x: number, y: number, str: string): void {
    const codePointArray = stringToCodePointArray(str);
    for (let i=0; i<codePointArray.length; i++) {
      this.setCodePoint(x+i, y, codePointArray[i]);
    }
  }

  setBgRGBA(x: number, y: number, rgba: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this._dataView.setUint32(offset + OFFSET_BG, rgba);

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) & ~FLAG_MASK_BG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);
  }

  getBgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint32(offset + OFFSET_BG)
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

    if (this._palette != null) {
      const rgba = this._palette[index];
      this._dataView.setUint32(offset + OFFSET_FG, rgba);
    }
  }

  getFgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX);
  }

  setBgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this._dataView.getUint16(offset + OFFSET_FLAGS) | FLAG_MASK_BG_CLUT;
    this._dataView.setUint16(offset + OFFSET_FLAGS, newAttr);

    this._dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, index);

    if (this._palette != null) {
      const rgba = this._palette[index];
      this._dataView.setUint32(offset + OFFSET_BG, rgba);
    }
  }

  getBgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint16(offset + OFFSET_BG_CLUT_INDEX);
  }

  setStyle(x: number, y: number, style: StyleCode): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    this._dataView.setUint16(offset + OFFSET_STYLE, style);
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

  shiftCellsLeft(x: number, y: number, shiftCount: number): void {
    const offsetCell = y * this.width;
    shiftCount = Math.min(x, shiftCount);

    this._uint8View.copyWithin((offsetCell + x) * CELL_SIZE_BYTES,                // target pos
                                (offsetCell + x + shiftCount) * CELL_SIZE_BYTES,  // source pos
                                (offsetCell + this.width) * CELL_SIZE_BYTES);     // end pos

    for (let i=this.width-shiftCount; i < this.width; i++) {
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
      let sourceOffset = (sv*sourceGrid.width +sx)* CELL_SIZE_UINT32;
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
    }
  }
}
