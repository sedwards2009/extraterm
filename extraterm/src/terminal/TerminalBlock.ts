/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QColor, QFrame, QPainter, QPen, QWidget, QLabel, QPaintEvent, TextFormat, QImage, WidgetEventTypes } from "@nodegui/nodegui";
import { getLogger, Logger } from "extraterm-logging";
import { Disposable } from "extraterm-event-emitter";

import { Block } from "./Block";
import * as Term from "../emulator/Term";
import { RenderEvent } from "packages/term-api/dist/TermApi";
import { TerminalVisualConfig } from "./TerminalVisualConfig";

import { computeFontMetrics, MonospaceFontMetrics, TextureFontAtlas } from "extraterm-char-render-canvas";


/**
 * Shows the contents of a terminal and can accept input.
 */
export class TerminalBlock implements Block {
  private _log: Logger = null;

  #widget: QWidget = null;
  #emulator: Term.Emulator = null;
  #onRenderDispose: Disposable =null;
  #terminalVisualConfig: TerminalVisualConfig = null;
  #metrics: MonospaceFontMetrics = null;
  #fontAtlas: TextureFontAtlas = null;

  constructor() {
    this._log = getLogger("TerminalBlock", this);
    this.#widget = this.#createWidget();

    // new TextureFontAtlas();
  }

  #createWidget(): QWidget {
    const widget = new QWidget();
    widget.setObjectName(this._log.getName());

    const height = 1024;

    widget.setMaximumSize(16777215, height);
    widget.setMinimumSize(0, height);

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
    const { family, style } = terminalVisualConfig.fontInfo;

    this.#metrics = computeFontMetrics(family, style, terminalVisualConfig.fontSizePx);
    this.#fontAtlas = new TextureFontAtlas(this.#metrics, [], terminalVisualConfig.transparentBackground,
      terminalVisualConfig.screenWidthHintPx, terminalVisualConfig.screenHeightHintPx);
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
  }

  #renderEventHandler(event: RenderEvent): void {
    if (event.refreshStartRow !== -1) {
      for (let i=event.refreshStartRow; i<event.refreshEndRow; i++) {
        this._log.debug("|> " + this.#emulator.getLineText(i));
      }
    }
    this.#widget.update();
  }

  #handlePaintEvent(event: QPaintEvent): void {
    const paintRect = event.rect();
// this._log.debug(`paintRect.left: ${paintRect.left()}, paintRect.top: ${paintRect.top()}`);
// this._log.debug(`paintRect.width: ${paintRect.width()}, paintRect.height: ${paintRect.height()}`);

    const geo = this.#widget.geometry();
    const painter = new QPainter(this.#widget);
    // painter.begin(this.#widget);
    const pen = new QPen();
    pen.setColor(new QColor(255, 0, 0));
    const penWidth = 5;
    pen.setWidth(penWidth);
    painter.setPen(pen);

    const left = 0 + penWidth;
    const right = geo.width() - penWidth;
    const top = 0 + penWidth;
    const bottom = geo.height() - penWidth;

    painter.drawLine(left, top, right, top);
    painter.drawLine(left, bottom, right, bottom);

    painter.drawLine(left, top, left, bottom);
    painter.drawLine(right, top, right, bottom);

    painter.drawLine(left, top, right, bottom);
    painter.drawLine(right, top, left, bottom);

    const emulatorDimensions = this.#emulator.getDimensions();
    let y = 0;
    const qimage = this.#fontAtlas.getQImage();
    const heightPx = this.#metrics.heightPx;
    const widthPx = this.#metrics.widthPx;

    for (let row=0; row<emulatorDimensions.materializedRows; row++) {
      const line = this.#emulator.lineAtRow(row);
      // line.setPalette(this.#terminalVisualConfig.terminalTheme.
      const rowWidth = line.width;
      let x = 0;
      for (let column=0; column<rowWidth; column++) {
        const glyph = this.#fontAtlas.loadCodePoint(line.getCodePoint(column, 0), line.getStyle(column, 0), 0,
          line.getFgRGBA(column, 0), line.getBgRGBA(column, 0));
        painter.drawImage(x, y, qimage, glyph.xPixels, glyph.yPixels, glyph.widthPx, heightPx);
        x += widthPx;
      }
      y += heightPx;
    }

    painter.end();
  }
}
