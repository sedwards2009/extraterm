/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { stringToCodePointArray, isWide, utf16LengthOfCodePoint } from "extraterm-unicode-utilities";

/**
 * Cell schema:
 *
 * 4 bytes  - Unicode code point
 * 1 byte   - Flags
 *            * 0x1 (bit 0) - true if using foreground CLUT
 *            * 0x2 (bit 1) - true if using background CLUT
 *            * 0x4 (bit 2) - true if extra fonts are used.
 *            * 0x18 (bit 3,4) - width of the char in cells-1, 0=normal 1 cell width, 1=2 cells.
 *            * 0x20 (bit 5) - true if this is the start of a ligature
 * 1 byte   - Link ID. 0 indicates no link. The mapping of IDs to URLs is elsewhere.
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
 *            * 0x0800 (bit 11) - true if hyperlink style
 *            * 0x1000 (bit 12) - true if hyperlink highlight style
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
export const STYLE_MASK_HYPERLINK = 2048;
export const STYLE_MASK_HYPERLINK_HIGHLIGHT = 4096;

export const UNDERLINE_STYLE_OFF = 0;
export const UNDERLINE_STYLE_NORMAL = 1;
export const UNDERLINE_STYLE_DOUBLE = 2;
export const UNDERLINE_STYLE_CURLY = 3;


export type StyleCode = number;

const CELL_SIZE_BYTES = 20;
const CELL_SIZE_UINT32 = CELL_SIZE_BYTES/4; // If this changes, then update pasteGrid().

const OFFSET_CODEPOINT = 0;
const OFFSET_FLAGS = 4;
const OFFSET_LINK_ID = 5;
const OFFSET_STYLE = 6;
const OFFSET_FG_CLUT_INDEX = 8;
const OFFSET_BG_CLUT_INDEX = 10;

const OFFSET_FG = 12;
const OFFSET_BG = 16;

/**
 * The expanded contents of one cell from the grid including all attributes.
 */
export interface Cell {
  codePoint: number;
  flags: number;
  linkID: number;
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
  dest.linkID = source.linkID;
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
  linkID: 0,
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

  #rawBuffer: ArrayBuffer;
  #dataView: DataView;
  #uint8View: Uint8Array;
  #dirtyFlag = true;
  width: number;
  height: number;
  palette: number[];

  /**
   * Create a new cell grid.
   *
   * Cell support index based palette colors and also full RGB colors. `palette`
   * maps indices to full RGBA colors.
   *
   * @param width The width of the grid in cells.
   * @param height The height of the grid in cells.
   * @param palette The palette to use. This is an array of 257 32bit RGBA
   *    values. This array is not copied and once passed here should not be
   *    modified externally.
   * @param __bare__ This is internal.
   */
  constructor(width_: number, height_: number, palette_: number[]=null,
      __bare__=false) {
    this.width = width_;
    this.height = height_;
    this.palette = palette_;
    if (__bare__) {
      return;
    }
    this.#rawBuffer = new ArrayBuffer(width_ * height_ * CELL_SIZE_BYTES);
    this.#dataView = new DataView(this.#rawBuffer);
    this.#uint8View = new Uint8Array(this.#rawBuffer);
    this.clear();
  }

  setPalette(palette: number[]) : void {
    this.palette = palette;
    this.#reapplyPalette();
    this.#dirtyFlag = true;
  }

  getPalette(): number[] {
    return this.palette;
  }

  isDirtyFlag(): boolean {
    return this.#dirtyFlag;
  }

  clearDirtyFlag(): void {
    this.#dirtyFlag = false;
  }

  #reapplyPalette(): void {
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

  /**
   * Create a complete copy of this grid.
   */
  clone(): CharCellGrid {
    const grid = new CharCellGrid(this.width, this.height, this.palette);
    this.cloneInto(grid);
    return grid;
  }

  cloneInto(grid: CharCellGrid): void {
    grid.#rawBuffer = this.#rawBuffer.slice(0);
    grid.#dataView = new DataView(grid.#rawBuffer);
    grid.#uint8View = new Uint8Array(grid.#rawBuffer);
  }

  /**
   * Reset every cell back to empty defaults.
   *
   * Each cell is set to a space char, no style, and default palette
   * foreground and background.
   */
  clear(): void {
    const spaceCodePoint = " ".codePointAt(0);
    const maxChar = this.width * this.height;
    let offset = 0;

    const fgRGBA = this.palette == null ? 0xffffffff : this.palette[FG_COLOR_INDEX];
    const bgRGBA = this.palette == null ? 0x00000000 : this.palette[BG_COLOR_INDEX];

    for (let i=0; i<maxChar; i++, offset += CELL_SIZE_BYTES) {
      this.#dataView.setUint32(offset, spaceCodePoint);
      this.#dataView.setUint8(offset + OFFSET_FLAGS, FLAG_MASK_FG_CLUT | FLAG_MASK_BG_CLUT);
      this.#dataView.setUint8(offset + OFFSET_LINK_ID, 0);
      this.#dataView.setUint16(offset + OFFSET_STYLE, 0);
      this.#dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, FG_COLOR_INDEX);
      this.#dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, BG_COLOR_INDEX);
      this.#dataView.setUint32(offset + OFFSET_FG, fgRGBA);
      this.#dataView.setUint32(offset + OFFSET_BG, bgRGBA);
    }
    this.#dirtyFlag = true;
  }

  /**
   * Get the completecontents of a cell.
   */
  getCell(x: number, y: number): Cell {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const cell: Cell = {
      codePoint: this.#dataView.getUint32(offset),
      flags: this.#dataView.getUint8(offset + OFFSET_FLAGS),
      linkID: this.#dataView.getUint8(offset + OFFSET_LINK_ID),
      style: this.#dataView.getUint16(offset + OFFSET_STYLE),
      fgClutIndex: this.#dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX),
      bgClutIndex: this.#dataView.getUint16(offset + OFFSET_BG_CLUT_INDEX),
      fgRGBA: this.#dataView.getUint32(offset + OFFSET_FG),
      bgRGBA: this.#dataView.getUint32(offset + OFFSET_BG),
    };
    return cell;
  }

  /**
   * Set the contents of a cell.
   */
  setCell(x: number, y: number, cell: Cell): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this.#dataView.setUint32(offset, cell.codePoint);
    this.#dataView.setUint8(offset + OFFSET_FLAGS, cell.flags);
    this.#dataView.setUint8(offset + OFFSET_LINK_ID, cell.linkID);

    let style = cell.style;
    if (cell.linkID === 0) {
      style = style & ~STYLE_MASK_HYPERLINK;
    } else {
      style = style | STYLE_MASK_HYPERLINK;
    }
    this.#dataView.setUint16(offset + OFFSET_STYLE, style);

    this.#dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, cell.fgClutIndex);
    this.#dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, cell.bgClutIndex);
    this.#dataView.setUint32(offset + OFFSET_FG, cell.fgRGBA);
    this.#dataView.setUint32(offset + OFFSET_BG, cell.bgRGBA);
    this.#dirtyFlag = true;
  }

  clearCell(x: number, y: number): void {
    this.setCell(x, y, SpaceCell);
    this.#dirtyFlag = true;
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
    const flags = this.#dataView.getUint8(offset + OFFSET_FLAGS);
    const newFlags = (flags & ~FLAG_MASK_WIDTH) | (width << FLAG_WIDTH_SHIFT);
    this.#dataView.setUint8(offset + OFFSET_FLAGS, newFlags);

    this.#dataView.setUint32(offset + OFFSET_CODEPOINT, codePoint);
    this.#dirtyFlag = true;
  }

  getCodePoint(x: number, y: number): number {
    return this.#dataView.getUint32((y * this.width + x) * CELL_SIZE_BYTES + OFFSET_CODEPOINT);
  }

  getCharExtraWidth(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this.#dataView.getUint8(offset + OFFSET_FLAGS);
    return (flags & FLAG_MASK_WIDTH) >> FLAG_WIDTH_SHIFT;
  }

  getFlags(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint8(offset + OFFSET_FLAGS);
  }

  getRowFlags(y: number): Uint8Array {
    const flagsArray = new Uint8Array(this.width);
    let offset = y * this.width * CELL_SIZE_BYTES + OFFSET_FLAGS;
    const width = this.width;
    for (let i=0; i<width; i++) {
      flagsArray[i] = this.#dataView.getUint8(offset);
      offset += CELL_SIZE_BYTES;
    }
    return flagsArray;
  }

  setRowFlags(y: number, flagsArray: Uint8Array, flagMask=0xffff): void {
    let offset = y * this.width * CELL_SIZE_BYTES + OFFSET_FLAGS;
    const width = Math.min(this.width, flagsArray.length);

    if (flagMask === 0xffff) {
      for (let i=0; i<width; i++) {
        this.#dataView.setUint8(offset, flagsArray[i]);
        offset += CELL_SIZE_BYTES;
      }
    } else {
      const invMask = ~flagMask;
      for (let i=0; i<width; i++) {
        const oldValue = this.#dataView.getUint8(offset);
        const newValue = (oldValue & invMask) | (flagMask & flagsArray[i]);
        this.#dataView.setUint8(offset, newValue);
        offset += CELL_SIZE_BYTES;
      }
    }
    this.#dirtyFlag = true;
  }

  /**
   * The code points for a range of cells from a string.
   *
   * @param x X position in the cells to modify.
   * @param y The row to modify.
   * @param str The string to read from.
   */
  setString(x: number, y: number, str: string): void {
    const codePointArray = stringToCodePointArray(str);
    for (let i=0; i<codePointArray.length; i++) {
      this.setCodePoint(x+i, y, codePointArray[i]);
    }
    this.#dirtyFlag = true;
  }

  /**
   * Get the string representation from a range of cells.
   *
   * @param x X position in the row to start count from.
   * @param y The row to scan.
   * @param count The number of cells to include. If this is not given, then
   *    the row is scanned up to the end.
   */
  getString(x: number, y: number, count?: number): string {
    const codePoints: number[] = [];

    const lastX = x + (count == null ? this.width : Math.min(this.width, count));
    for (let i=x; i<lastX; i++) {
      codePoints.push(this.getCodePoint(i, y));
    }
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Get the length of the UTF16 string representation of a range of cells.
   *
   * Cells hold Unicode code points. A code point can map to 1 or more UTF16
   * values.
   *
   * @param x X position in the row to start count from.
   * @param y The row to scan.
   * @param count The number of cells to scan. If this is not given, then the
   *    row is scanned up to the end.
   */
  getUTF16StringLength(x: number, y: number, count?: number): number {
    const lastX = x + (count == null ? this.width : Math.min(this.width, count));
    let size = 0;
    for (let i=x; i<lastX; i++) {
      const codePoint = this.getCodePoint(i, y);
      size += utf16LengthOfCodePoint(codePoint);
    }
    return size;
  }

  /**
   * Get the Unicode code points from a row.
   *
   * @param y The row to read the code points from.
   * @param destinationArray If provided, the output will be placed directly
   *    into this array. This should be as long as the grid is wide.
   * @returns The array with code points. If `destinationArray` was provided
   *    then it is returned.
   */
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
    this.#dataView.setUint32(offset + OFFSET_BG, rgba);

    const newAttr = this.#dataView.getUint8(offset + OFFSET_FLAGS) & ~FLAG_MASK_BG_CLUT;
    this.#dataView.setUint8(offset + OFFSET_FLAGS, newAttr);
    this.#dirtyFlag = true;
  }

  getBgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint32(offset + OFFSET_BG);
  }

  setFgRGBA(x: number, y: number, rgba: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this.#dataView.setUint32(offset + OFFSET_FG, rgba);

    const newAttr = this.#dataView.getUint8(offset + OFFSET_FLAGS) & ~FLAG_MASK_FG_CLUT;
    this.#dataView.setUint8(offset + OFFSET_FLAGS, newAttr);
    this.#dirtyFlag = true;
  }

  getFgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint32(offset + OFFSET_FG);
  }

  setFgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this.#dataView.getUint8(offset + OFFSET_FLAGS) | FLAG_MASK_FG_CLUT;
    this.#dataView.setUint8(offset + OFFSET_FLAGS, newAttr);

    this.#dataView.setUint16(offset + OFFSET_FG_CLUT_INDEX, index);

    this._updateInternalRGB(index, offset);

    this.#dirtyFlag = true;
  }

  private _updateInternalRGB(index: number, offset: number): void {
    if (this.palette != null) {
      const style = this.#dataView.getUint16(offset + OFFSET_STYLE);
      let rgba = 0;
      if (index <8 && style & STYLE_MASK_BOLD) {
        rgba = this.palette[index + 8];
      } else {
        rgba = this.palette[index];
      }
      this.#dataView.setUint32(offset + OFFSET_FG, rgba);
    }
  }

  getFgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX);
  }

  isFgClut(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this.#dataView.getUint8(offset + OFFSET_FLAGS) & FLAG_MASK_FG_CLUT) !== 0;
  }

  setBgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this.#dataView.getUint8(offset + OFFSET_FLAGS) | FLAG_MASK_BG_CLUT;
    this.#dataView.setUint8(offset + OFFSET_FLAGS, newAttr);

    this.#dataView.setUint16(offset + OFFSET_BG_CLUT_INDEX, index);

    if (this.palette != null) {
      const rgba = this.palette[index];
      this.#dataView.setUint32(offset + OFFSET_BG, rgba);
    }
    this.#dirtyFlag = true;
  }

  getBgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint16(offset + OFFSET_BG_CLUT_INDEX);
  }

  isBgClut(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this.#dataView.getUint8(offset + OFFSET_FLAGS) & FLAG_MASK_BG_CLUT) !== 0;
  }

  setStyle(x: number, y: number, style: StyleCode): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    this.#dataView.setUint16(offset + OFFSET_STYLE, style);

    const ifFgClut = this.#dataView.getUint8(offset + OFFSET_FLAGS) & FLAG_MASK_FG_CLUT;
    if (ifFgClut) {
      const index = this.#dataView.getUint16(offset + OFFSET_FG_CLUT_INDEX);
      this._updateInternalRGB(index, offset);
    }
    this.#dirtyFlag = true;
  }

  getStyle(x: number, y: number): StyleCode {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    return this.#dataView.getUint16(offset + OFFSET_STYLE);
  }

  getExtraFontsFlag(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this.#dataView.getUint8(offset + OFFSET_FLAGS) & FLAG_MASK_EXTRA_FONT) !== 0;
  }

  setExtraFontsFlag(x: number, y: number, on: boolean): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    let flags = this.#dataView.getUint8(offset + OFFSET_FLAGS);
    if (on) {
      flags = flags | FLAG_MASK_EXTRA_FONT;
    } else {
      flags = flags & ~FLAG_MASK_EXTRA_FONT;
    }
    this.#dataView.setUint8(offset + OFFSET_FLAGS, flags);
    this.#dirtyFlag = true;
  }

  setLigature(x: number, y: number, ligatureLength: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this.#dataView.getUint8(offset + OFFSET_FLAGS);
    if (ligatureLength <= 1) {
      if (flags & FLAG_MASK_LIGATURE) {
        // Clear ligature flag and set width to 1 (normal)
        this.#dataView.setUint8(offset + OFFSET_FLAGS, flags & ~(FLAG_MASK_LIGATURE|FLAG_MASK_WIDTH));
      }
    } else {
      const widthBits = (ligatureLength-1) << FLAG_WIDTH_SHIFT;
      const newFlags = (flags & ~FLAG_MASK_WIDTH) | FLAG_MASK_LIGATURE | widthBits;
      this.#dataView.setUint8(offset + OFFSET_FLAGS, newFlags);
    }
    this.#dirtyFlag = true;
  }

  getLigature(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const flags = this.#dataView.getUint8(offset + OFFSET_FLAGS);
    if ((flags & FLAG_MASK_LIGATURE) !== 0) {
      return this.getCharExtraWidth(x, y) + 1;
    } else {
      return 0;
    }
  }

  setLinkID(x: number, y: number, linkID: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this.#dataView.setUint8(offset + OFFSET_LINK_ID, linkID);

    let style = this.getStyle(x, y);
    if (linkID === 0) {
      style = style & ~STYLE_MASK_HYPERLINK;
    } else {
      style = style | STYLE_MASK_HYPERLINK;
    }
    this.setStyle(x, y, style);
    this.#dirtyFlag = true;
  }

  getLinkID(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this.#dataView.getUint8(offset + OFFSET_LINK_ID);
  }

  shiftCellsRight(x: number, y: number, shiftCount: number): void {
    const offsetCell = y * this.width;
    const moveCount = this.width - x - shiftCount;
    if (moveCount <= 0) {
      return;
    }

    this.#uint8View.copyWithin((offsetCell + x + shiftCount) * CELL_SIZE_BYTES,  // target pos
                                (offsetCell + x) * CELL_SIZE_BYTES,         // source pos
                                (offsetCell + this.width - shiftCount) * CELL_SIZE_BYTES); // end pos
    this.#dirtyFlag = true;
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
      this.#uint8View.copyWithin((offsetCell + x) * CELL_SIZE_BYTES,                // target pos
                                  (offsetCell + x + shiftCount) * CELL_SIZE_BYTES,  // source pos
                                  (offsetCell + this.width) * CELL_SIZE_BYTES);     // end pos
    }

    for (let i=Math.max(x, this.width-shiftCount); i < this.width; i++) {
      this.setCell(i, y, SpaceCell);
    }
    this.#dirtyFlag = true;
  }

  pasteGrid(sourceGrid: CharCellGrid, x: number, y: number): void {
    const endY = Math.min(y+sourceGrid.height, this.height);
    const endH = Math.min(x+sourceGrid.width, this.width);

    const uint32ArrayDest = new Uint32Array(this.#rawBuffer);
    const uint32ArraySource = new Uint32Array(sourceGrid.#rawBuffer);

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
    this.#dirtyFlag = true;
  }
}
