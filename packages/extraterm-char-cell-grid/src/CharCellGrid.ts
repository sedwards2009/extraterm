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
 * 1 byte   - Flags
 *            * 0x1 (bit 0) - true if using foreground CLUT
 *            * 0x2 (bit 1) - true if using background CLUT
 *            * 0x4 (bit 2) - true if extra fonts are used.
 *            * 0x38 (bit 3,4,5) ligature size as 3 bit number.
 * 1 byte   - Style
 *            * 0x1 (bit 0) - true if bold style
 *            * 0x2 (bit 1) - true if underline style
 *            * 0x4 (bit 2) - true if italic style
 *            * 0x8 (bit 3) - true if strikethrough style
 *            * 0x10 (bit 4) - true if blink style
 *            * 0x20 (bit 5) - true if inverse style
 *            * 0x40 (bit 6) - true if invisible style
 *            * 0x80 (bit 7) - true if faint style
 * 1 byte   - Foreground Colour Lookup Table (palette / CLUT) index
 * 1 byte   - Background Colour Lookup Table (palette / CLUT) index
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

type StyleCode = number;

const CELL_SIZE_BYTES = 16;

const OFFSET_CODEPOINT = 0;
const OFFSET_FLAGS = 4;
const OFFSET_STYLE = 5;
const OFFSET_FG_CLUT_INDEX = 6;
const OFFSET_BG_CLUT_INDEX = 7;

const OFFSET_FG = 8;
const OFFSET_BG = 12;


export class CharCellGrid {

  private _rawBuffer: ArrayBuffer;
  private _dataView: DataView;

  constructor(public readonly width: number, public readonly height: number, private readonly _palette: number[]) {
    this._rawBuffer = new ArrayBuffer(width * height * CELL_SIZE_BYTES);
    this._dataView = new DataView(this._rawBuffer);
    this.clear();
  }

  clear(): void {
    const spaceCodePoint = " ".codePointAt(0);
    const maxChar = this.width * this.height;
    let offset = 0;
    for (let i=0; i<maxChar; i++, offset += CELL_SIZE_BYTES) {
      this._dataView.setUint32(offset, spaceCodePoint);
      this._dataView.setUint8(offset + OFFSET_FLAGS, 0);
      this._dataView.setUint8(offset + OFFSET_STYLE, 0);
      this._dataView.setUint8(offset + OFFSET_FG_CLUT_INDEX, 0);
      this._dataView.setUint8(offset + OFFSET_BG_CLUT_INDEX, 0);
      this._dataView.setUint32(offset + OFFSET_FG, 0xffffffff);
      this._dataView.setUint32(offset + OFFSET_BG, 0x000000ff);
    }
  }

  clearCell(x: number, y: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    const spaceCodePoint = " ".codePointAt(0);
    this._dataView.setUint32(offset, spaceCodePoint);
    this._dataView.setUint8(offset + OFFSET_FLAGS, 0);
    this._dataView.setUint8(offset + OFFSET_STYLE, 0);
    this._dataView.setUint8(offset + OFFSET_FG_CLUT_INDEX, 0);
    this._dataView.setUint8(offset + OFFSET_BG_CLUT_INDEX, 0);
    this._dataView.setUint32(offset + OFFSET_FG, 0xffffffff);
    this._dataView.setUint32(offset + OFFSET_BG, 0x000000ff);
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

    const newAttr = this._dataView.getUint8(offset + OFFSET_FLAGS) & ~FLAG_MASK_BG_CLUT;
    this._dataView.setUint8(offset + OFFSET_FLAGS, newAttr);
  }

  getBgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint32(offset + OFFSET_BG)
  }

  setFgRGBA(x: number, y: number, rgba: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    this._dataView.setUint32(offset + OFFSET_FG, rgba);

    const newAttr = this._dataView.getUint8(offset + OFFSET_FLAGS) & ~FLAG_MASK_FG_CLUT;
    this._dataView.setUint8(offset + OFFSET_FLAGS, newAttr);
  }

  getFgRGBA(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint32(offset + OFFSET_FG);
  }

  setFgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this._dataView.getUint8(offset + OFFSET_FLAGS) | FLAG_MASK_FG_CLUT;
    this._dataView.setUint8(offset + OFFSET_FLAGS, newAttr);

    this._dataView.setUint8(offset + OFFSET_FG_CLUT_INDEX, index);

    const rgba = this._palette[index];
    this._dataView.setUint32(offset + OFFSET_FG, rgba);
  }

  getFgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint8(offset + OFFSET_FG_CLUT_INDEX);
  }

  setBgClutIndex(x: number, y: number, index: number): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    const newAttr = this._dataView.getUint8(offset + OFFSET_FLAGS) | FLAG_MASK_BG_CLUT;
    this._dataView.setUint8(offset + OFFSET_FLAGS, newAttr);

    this._dataView.setUint8(offset + OFFSET_BG_CLUT_INDEX, index);

    const rgba = this._palette[index];
    this._dataView.setUint32(offset + OFFSET_BG, rgba);
  }

  getBgClutIndex(x: number, y: number): number {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return this._dataView.getUint8(offset + OFFSET_BG_CLUT_INDEX);
  }

  setStyle(x: number, y: number, style: StyleCode): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    this._dataView.setUint8(offset + OFFSET_STYLE, style);
  }

  getStyle(x: number, y: number): StyleCode {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;

    return this._dataView.getUint8(offset + OFFSET_STYLE);
  }

  getExtraFontsFlag(x: number, y: number): boolean {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    return (this._dataView.getUint8(offset + OFFSET_FLAGS) & FLAG_MASK_EXTRA_FONT) !== 0;
  }

  setExtraFontsFlag(x: number, y: number, on: boolean): void {
    const offset = (y * this.width + x) * CELL_SIZE_BYTES;
    let flags = this._dataView.getUint8(offset + OFFSET_FLAGS);
    if (on) {
      flags = flags | FLAG_MASK_EXTRA_FONT;
    } else {
      flags = flags & ~FLAG_MASK_EXTRA_FONT;
    }
    this._dataView.setUint8(offset + OFFSET_FLAGS, flags);
  }
}
