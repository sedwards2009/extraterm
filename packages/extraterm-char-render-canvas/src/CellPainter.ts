/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QImage, QPainter } from "@nodegui/nodegui";
import { CharCellLine, STYLE_MASK_CURSOR, STYLE_MASK_HYPERLINK_HIGHLIGHT, STYLE_MASK_INVERSE } from "extraterm-char-cell-line";
import { TextureCachedGlyph, TextureFontAtlas } from "./font_atlas/TextureFontAtlas.js";
import { MonospaceFontMetrics } from "./font_metrics/MonospaceFontMetrics.js";
import { NormalizedCell, normalizedCellIterator } from "./NormalizedCellIterator.js";
import { FontSlice } from "./FontSlice.js";


export interface EmbeddedImage {
  sourceImage: QImage;
  sourceCellWidthPx: number
  sourceCellHeightPx: number;

  image: QImage;
  cellWidthPx: number
  cellHeightPx: number;
}

export type EmbeddedImageMap = Map<number, EmbeddedImage>;


export class CellPainter {
  #painter: QPainter = null;
  #dpr = 1;
  #fontAtlas: TextureFontAtlas = null;
  #fontMetrics: MonospaceFontMetrics = null;
  #palette: number[] = [];
  #cursorColor: number = 0;
  #fontSlices: FontSlice[] = [];

  constructor(
    painter: QPainter,
    fontAtlas: TextureFontAtlas,
    fontMetrics: MonospaceFontMetrics,
    dpr: number,
    palette: number[],
    cursorColor: number,
    fontSlices: FontSlice[],
  ) {
    this.#painter = painter;
    this.#fontAtlas = fontAtlas;
    this.#fontMetrics = fontMetrics;
    this.#dpr = dpr;
    this.#palette = palette;
    this.#cursorColor = cursorColor;
    this.#fontSlices = fontSlices;
  }

  renderLine(line: CharCellLine, y: number, renderCursor: boolean, embeddedImageMap: EmbeddedImageMap,
      hoverLinkID = 0): void {

    const painter = this.#painter;
    const qimage = this.#fontAtlas.getQImage();
    const metrics= this.#fontMetrics;
    const widthPx = metrics.widthPx;
    const heightPx = metrics.heightPx;
    const palette = this.#palette;
    const cursorColor = this.#cursorColor;
    const normalizedCell: NormalizedCell = {
      x: 0,
      segment: 0,
      codePoint: 0,
      extraFontFlag: false,
      isLigature: false,
      ligatureCodePoints: null,
      linkID: 0,
      imageID: 0,
      imageX: 0,
      imageY: 0,
    };
    const dpr = this.#dpr;

    line.setPalette(palette); // TODO: Maybe the palette should pushed up into the emulator.
    this.#updateCharGridFlags(line);

    let xPx = 0;
    for (const column of normalizedCellIterator(line, normalizedCell)) {
      const codePoint = normalizedCell.codePoint;
      if (codePoint !== 0) {
        const fontIndex = normalizedCell.extraFontFlag ? 1 : 0;

        let fgRGBA = line.getFgRGBA(column);
        let bgRGBA = line.getBgRGBA(column);

        let style = line.getStyle(column);
        if ((style & STYLE_MASK_CURSOR) && renderCursor) {
          fgRGBA = bgRGBA;
          bgRGBA = cursorColor;
        } else {
          if (style & STYLE_MASK_INVERSE) {
            const tmp = fgRGBA;
            fgRGBA = bgRGBA;
            bgRGBA = tmp;
          }
        }
        fgRGBA |= 0x000000ff;

        if ((hoverLinkID !== 0) && (normalizedCell.linkID === hoverLinkID)) {
          style |= STYLE_MASK_HYPERLINK_HIGHLIGHT;
        }

        let glyph: TextureCachedGlyph;
        if (normalizedCell.isLigature) {
          glyph = this.#fontAtlas.loadCombiningCodePoints(normalizedCell.ligatureCodePoints, style,
            fontIndex, fgRGBA, bgRGBA);
        } else {
          glyph = this.#fontAtlas.loadCodePoint(codePoint, style, fontIndex, fgRGBA, bgRGBA);
        }
        qimage.setDevicePixelRatio(dpr);
        const sourceX = glyph.xPixels + normalizedCell.segment * glyph.widthPx;
        const sourceY = glyph.yPixels;
        painter.drawImageF(xPx / dpr, y / dpr, qimage, sourceX, sourceY, glyph.widthPx, heightPx);

      }

      if (normalizedCell.imageID !== 0) {
        const embeddedImage = embeddedImageMap.get(normalizedCell.imageID);
        if (embeddedImage != null) {
          const sourceX = normalizedCell.imageX * widthPx;
          const sourceY = normalizedCell.imageY * heightPx;
          painter.drawImageF(xPx / dpr, y / dpr, embeddedImage.image, sourceX, sourceY, widthPx, heightPx);
        }
      }

      xPx += widthPx;
    }
  }

  #updateCharGridFlags(line: CharCellLine): void {
    const width = line.width;
    const fontSlices = this.#fontSlices;
    for (let i=0; i<width; i++) {
      const codePoint = line.getCodePoint(i);
      let isExtra = false;
      for (const fontSlice of fontSlices) {
        if (fontSlice.containsCodePoint(codePoint)) {
          line.setExtraFontsFlag(i, true);
          isExtra = true;
          break;
        }
      }
      line.setExtraFontsFlag(i, isExtra);
      line.setLigature(i, 0);
    }
  }
}
