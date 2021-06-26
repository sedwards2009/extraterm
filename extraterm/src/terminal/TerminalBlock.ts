/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QPainter, QWidget, QPaintEvent, WidgetEventTypes } from "@nodegui/nodegui";
import { getLogger, Logger } from "extraterm-logging";
import { Disposable } from "extraterm-event-emitter";
import { normalizedCellIterator, NormalizedCell, TextureFontAtlas, RGBAToQColor } from "extraterm-char-render-canvas";
import { STYLE_MASK_CURSOR, STYLE_MASK_INVERSE } from "extraterm-char-cell-grid";

import { Block } from "./Block";
import * as Term from "../emulator/Term";
import { Line, RenderEvent } from "term-api";
import { PALETTE_BG_INDEX, PALETTE_CURSOR_INDEX, TerminalVisualConfig } from "./TerminalVisualConfig";


/**
 * Shows the contents of a terminal and can accept input.
 */
export class TerminalBlock implements Block {
  private _log: Logger = null;

  #widget: QWidget = null;
  #emulator: Term.Emulator = null;
  #onRenderDispose: Disposable =null;
  #terminalVisualConfig: TerminalVisualConfig = null;
  #fontAtlas: TextureFontAtlas = null;
  #heightPx = 1;

  #scrollback: Line[] = [];

  constructor() {
    this._log = getLogger("TerminalBlock", this);
    this.#widget = this.#createWidget();

    // new TextureFontAtlas();
  }

  #createWidget(): QWidget {
    const widget = new QWidget();
    widget.setObjectName(this._log.getName());

    widget.setMaximumSize(16777215, this.#heightPx);

    widget.addEventListener(WidgetEventTypes.Paint, (nativeEvent) => {
      this.#handlePaintEvent(new QPaintEvent(nativeEvent));
    });

    return widget;
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  setTerminalVisualConfig(terminalVisualConfig: TerminalVisualConfig): void {
    this.#terminalVisualConfig = terminalVisualConfig;

    this.#fontAtlas = new TextureFontAtlas(this.#terminalVisualConfig.fontMetrics, [],
      terminalVisualConfig.transparentBackground, terminalVisualConfig.screenWidthHintPx,
      terminalVisualConfig.screenHeightHintPx);

    this.#updateWidgetSize();
  }

  #updateWidgetSize(): void {
    if (this.#emulator == null || this.#terminalVisualConfig == null) {
      return;
    }

    const metrics= this.#terminalVisualConfig.fontMetrics;
    const dimensions = this.#emulator.getDimensions();
    const newHeightPx = (dimensions.materializedRows + this.#scrollback.length) * metrics.heightPx;
    if (newHeightPx === this.#heightPx) {
      return;
    }

    this.#widget.setMinimumSize(10 * metrics.widthPx, newHeightPx);
    this.#widget.setMaximumSize(16777215, newHeightPx);
    this.#heightPx = newHeightPx;
  }

  setEmulator(emulator: Term.Emulator): void {
    if (this.#emulator !== null) {
      // Disconnect the last emulator.
      this.#onRenderDispose.dispose();
      this.#onRenderDispose = null;
      this.#emulator = null;
    }

    if (emulator !== null) {
      this.#onRenderDispose = emulator.onRender(this.#renderEventHandler.bind(this));
    }

    this.#emulator = emulator;
    this.#updateWidgetSize();
  }

  #renderEventHandler(event: RenderEvent): void {
    this.#updateWidgetSize();

    if (event.scrollbackLines.length !== 0) {
      this.#scrollback.splice(this.#scrollback.length, 0, ...event.scrollbackLines);
      this.#updateWidgetSize();
    }

    this.#widget.update();
  }

  #handlePaintEvent(event: QPaintEvent): void {
    const paintRect = event.rect();

    const metrics= this.#terminalVisualConfig.fontMetrics;
    const heightPx = metrics.heightPx;

    const topRenderRow = Math.floor(paintRect.top() / heightPx);
    const heightRows = Math.ceil(paintRect.height() / heightPx) + 1;

    const painter = new QPainter(this.#widget);
    const emulatorDimensions = this.#emulator.getDimensions();

    const bgRGBA = this.#terminalVisualConfig.palette[PALETTE_BG_INDEX];
    painter.fillRect(paintRect.left(), paintRect.top(), paintRect.width(), paintRect.height(), RGBAToQColor(bgRGBA));

    const scrollbackLength = this.#scrollback.length;
    if (topRenderRow < scrollbackLength) {
      const lastRenderRow = Math.min(topRenderRow + heightRows, scrollbackLength);
      const lines = this.#scrollback.slice(topRenderRow, lastRenderRow);
      this.#renderLines(painter, lines, topRenderRow * heightPx, false);
    }

    if (topRenderRow + heightRows >= scrollbackLength) {
      const screenTopRow = Math.max(topRenderRow, scrollbackLength) - scrollbackLength;
      const screenLastRow = Math.min(topRenderRow + heightRows - scrollbackLength, emulatorDimensions.materializedRows);

      const lines: Line[] = [];
      for (let i = screenTopRow; i < screenLastRow; i++) {
        const line = this.#emulator.lineAtRow(i);
        lines.push(line);
      }
      this.#renderLines(painter, lines, (screenTopRow + scrollbackLength) * heightPx, true);
    }

    painter.end();
  }

  #renderLines(painter: QPainter, lines: Line[], startY: number, renderCursor: boolean): void {
    const qimage = this.#fontAtlas.getQImage();
    let y = startY;

    const metrics= this.#terminalVisualConfig.fontMetrics;
    const heightPx = metrics.heightPx;
    const widthPx = metrics.widthPx;

    const cursorColor = this.#terminalVisualConfig.palette[PALETTE_CURSOR_INDEX];
    const normalizedCell: NormalizedCell = {
      x: 0,
      segment: 0,
      codePoint: 0,
      extraFontFlag: false,
      isLigature: false,
      ligatureCodePoints: null
    };

    const palette = this.#terminalVisualConfig.palette;

    for (const line of lines) {
      line.setPalette(palette); // TODO: Maybe the palette should pushed up into the emulator.

      let px = 0;
      for (const column of normalizedCellIterator(line, 0, normalizedCell)) {
        const codePoint = line.getCodePoint(column, 0);
        const fontIndex = 0;

        let fgRGBA = line.getFgRGBA(column, 0);
        let bgRGBA = line.getBgRGBA(column, 0);

        const style = line.getStyle(column, 0);
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

        const glyph = this.#fontAtlas.loadCodePoint(codePoint, style, fontIndex, fgRGBA, bgRGBA);
        painter.drawImage(px, y, qimage, glyph.xPixels, glyph.yPixels, glyph.widthPx, heightPx);
        px += widthPx;
      }
      y += heightPx;
    }
  }
}
