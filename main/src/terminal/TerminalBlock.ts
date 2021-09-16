/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QPainter, QWidget, QPaintEvent, WidgetEventTypes, QMouseEvent, MouseButton, KeyboardModifier, CompositionMode } from "@nodegui/nodegui";
import { getLogger, Logger } from "extraterm-logging";
import { Disposable, Event } from "extraterm-event-emitter";
import { normalizedCellIterator, NormalizedCell, TextureFontAtlas, RGBAToQColor } from "extraterm-char-render-canvas";
import { STYLE_MASK_CURSOR, STYLE_MASK_INVERSE } from "extraterm-char-cell-grid";
import { Color } from "extraterm-color-utilities";
import { EventEmitter } from "extraterm-event-emitter";
import { countCells, reverseString } from "extraterm-unicode-utilities";

import { Block } from "./Block";
import * as Term from "../emulator/Term";
import { Line, MouseEventOptions, RenderEvent, TerminalCoord } from "term-api";


import { PALETTE_BG_INDEX, PALETTE_CURSOR_INDEX, TerminalVisualConfig } from "./TerminalVisualConfig";
import XRegExp = require("xregexp");  // TODO Switch to ES modules


enum SelectionMode {
  NORMAL,
  BLOCK
};

const WORD_SELECTION_REGEX = XRegExp("^[\\p{L}\\p{Mn}\\p{Mc}\\p{Nd}\\p{Pc}\\$_@~?&=%#/:\\\\.-]+", "g");

interface ExpandedMouseEventOptions extends MouseEventOptions {
  nearestColumnEdge: number;
}


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

  #selectionStart: TerminalCoord = null;
  #selectionEnd: TerminalCoord = null;
  #selectionMode = SelectionMode.NORMAL;
  #isWordSelection = false;

  #onSelectionChangedEventEmitter = new EventEmitter<void>();
  onSelectionChanged: Event<void>;

  constructor() {
    this._log = getLogger("TerminalBlock", this);
    this.onSelectionChanged = this.#onSelectionChangedEventEmitter.event;

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
    widget.addEventListener(WidgetEventTypes.MouseButtonPress, (nativeEvent) => {
      this.#handleMouseButtonPress(new QMouseEvent(nativeEvent));
    });
    widget.addEventListener(WidgetEventTypes.MouseButtonRelease, (nativeEvent) => {
      this.#handleMouseButtonRelease(new QMouseEvent(nativeEvent));
    });
    widget.addEventListener(WidgetEventTypes.MouseButtonDblClick, (nativeEvent) => {
      this.#handleMouseDoubleClick(new QMouseEvent(nativeEvent));
    });
    widget.addEventListener(WidgetEventTypes.MouseMove, (nativeEvent) => {
      this.#handleMouseMove(new QMouseEvent(nativeEvent));
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

    const metrics = this.#terminalVisualConfig.fontMetrics;
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

    const metrics = this.#terminalVisualConfig.fontMetrics;
    const heightPx = metrics.heightPx;

    const topRenderRow = Math.floor(paintRect.top() / heightPx);
    const heightRows = Math.ceil(paintRect.height() / heightPx) + 1;

    const painter = new QPainter(this.#widget);
    const emulatorDimensions = this.#emulator.getDimensions();

    const bgRGBA = this.#terminalVisualConfig.palette[PALETTE_BG_INDEX];
    painter.fillRect(paintRect.left(), paintRect.top(), paintRect.width(), paintRect.height(), RGBAToQColor(bgRGBA));

    // Render any lines from the scrollback
    const scrollbackLength = this.#scrollback.length;
    if (topRenderRow < scrollbackLength) {
      const lastRenderRow = Math.min(topRenderRow + heightRows, scrollbackLength);
      const lines = this.#scrollback.slice(topRenderRow, lastRenderRow);
      this.#renderLines(painter, lines, topRenderRow * heightPx, false);
    }

    // Render any lines from the emulator screen
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

    this.#renderSelection(painter, topRenderRow, heightRows);

    painter.end();
  }

  #renderSelection(painter: QPainter, topRenderRow: number, heightRows: number): void {
    const metrics = this.#terminalVisualConfig.fontMetrics;
    const heightPx = metrics.heightPx;
    const widthPx = metrics.widthPx;

    let selectionStart = this.#selectionStart;
    let selectionEnd = this.#selectionEnd;

    if (selectionStart == null || selectionEnd == null || terminalCoordEqual(selectionStart, selectionEnd)) {
      return;
    }

    if ( ! terminalCoordLess(selectionStart, selectionEnd)) {
      selectionStart = this.#selectionEnd;
      selectionEnd = this.#selectionStart;
    }

    const selectionColor = this.#terminalVisualConfig.terminalTheme.selectionBackgroundColor;
    const selectionQColor = RGBAToQColor(new Color(selectionColor).toRGBA());
    const firstRow = Math.max(topRenderRow, selectionStart.y);
    const lastRow = Math.min(topRenderRow + heightRows + 1, selectionEnd.y + 1);

    const emulatorWidth = this.#emulator.getDimensions().cols;

    painter.setCompositionMode(CompositionMode.CompositionMode_Screen);

    for (let i=firstRow; i<lastRow; i++) {
      if (i === selectionStart.y) {
        if (selectionStart.y === selectionEnd.y) {
          // Small selection contained within one row.
          painter.fillRect(selectionStart.x*widthPx, selectionStart.y*heightPx,
            (selectionEnd.x - selectionStart.x) * widthPx, heightPx, selectionQColor);
        } else {
          // Top row of the selection.
          let rowLength = emulatorWidth;
          if (i < this.#scrollback.length) {
            rowLength = this.#scrollback[i].width;
          }
          painter.fillRect(selectionStart.x*widthPx, selectionStart.y*heightPx,
            (rowLength - selectionStart.x) * widthPx, heightPx, selectionQColor);
        }
      } else {
        if (i !== selectionEnd.y) {
          // A row within a multi-row selection.
          let rowLength = emulatorWidth;
          if (i < this.#scrollback.length) {
            rowLength = this.#scrollback[i].width;
          }
          painter.fillRect(0, i*heightPx, rowLength*widthPx, heightPx, selectionQColor);
        } else {
          // The last row of a multi-row selection.
          painter.fillRect(0, i*heightPx, selectionEnd.x*widthPx, heightPx, selectionQColor);
        }
      }
    }
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

  #handleMouseButtonPress(event: QMouseEvent): void {
    const termEvent = this.#qMouseEventToTermApi(event);

    if (termEvent.ctrlKey) {

    } else {
      if (this.#emulator != null && termEvent.row >= 0 && this.#emulator.mouseDown(termEvent)) {
        return;
      }
    }
    this.#selectionStart = { x: termEvent.nearestColumnEdge, y: termEvent.row + this.#scrollback.length };
    this.#selectionEnd = this.#selectionStart;
    this.#selectionMode = SelectionMode.NORMAL;
    this.#isWordSelection = false;

    this.#widget.update();
  }

  #qMouseEventToTermApi(event: QMouseEvent): ExpandedMouseEventOptions {
    const pos = this.#pixelToCell(event.x(), event.y());
    const columnEdgePos = this.#pixelToRowColumnEdge(event.x(), event.y());

    const termEvent: ExpandedMouseEventOptions = {
      row: pos.y - this.#scrollback.length,
      column: pos.x,
      nearestColumnEdge: columnEdgePos.x,
      leftButton: (event.buttons() & MouseButton.LeftButton) !== 0,
      middleButton: (event.buttons() & MouseButton.MiddleButton) !== 0,
      rightButton: (event.buttons() & MouseButton.RightButton) !== 0,
      shiftKey: (event.modifiers() & KeyboardModifier.ShiftModifier) !== 0,
      metaKey: (event.modifiers() & KeyboardModifier.MetaModifier) !== 0,
      ctrlKey: (event.modifiers() & KeyboardModifier.ControlModifier) !== 0,
    };
    return termEvent;
  }

  #pixelToRowColumnEdge(x: number, y: number): TerminalCoord {
    const gridY = Math.floor(y / this.#terminalVisualConfig.fontMetrics.heightPx);
    const gridX = Math.round(x / this.#terminalVisualConfig.fontMetrics.widthPx);
    return { x: gridX, y: gridY };
  }

  #pixelToCell(x: number, y: number): TerminalCoord {
    const gridY = Math.floor(y / this.#terminalVisualConfig.fontMetrics.heightPx);
    const gridX = Math.floor(x / this.#terminalVisualConfig.fontMetrics.widthPx);
    return { x: gridX, y: gridY };
  }

  #handleMouseButtonRelease(event: QMouseEvent): void {
    const termEvent = this.#qMouseEventToTermApi(event);
    if ( ! termEvent.ctrlKey && this.#emulator != null && termEvent.row >= 0 && this.#emulator.mouseUp(termEvent)) {
      return;
    }

    this.#onSelectionChangedEventEmitter.fire();
  }

  #handleMouseDoubleClick(event: QMouseEvent): void {
    const termEvent = this.#qMouseEventToTermApi(event);
    if ( ! termEvent.ctrlKey && this.#emulator != null && termEvent.row >= 0 && this.#emulator.mouseUp(termEvent)) {
      return;
    }
    this.#isWordSelection = true;

    this.#selectionStart = { x: this.#extendXWordLeft(termEvent), y: termEvent.row + this.#scrollback.length };
    this.#selectionEnd = { x: this.#extendXWordRight(termEvent), y: termEvent.row + this.#scrollback.length };
    this.#selectionMode = SelectionMode.NORMAL;

    this.#widget.update();
  }

  #extendXWordRight(termEvent: MouseEventOptions): number {
    const line = this.#getLine(termEvent.row + this.#scrollback.length);
    const lineStringRight = line.getString(termEvent.column, 0);
    const rightMatch = lineStringRight.match(WORD_SELECTION_REGEX);
    if (rightMatch != null) {
      return termEvent.column + countCells("" + rightMatch);
    }
    return termEvent.column;
  }

  #extendXWordLeft(termEvent: MouseEventOptions): number {
    const line = this.#getLine(termEvent.row + this.#scrollback.length);
    const lineStringLeft = reverseString(line.getString(0, 0, termEvent.column));
    const leftMatch = lineStringLeft.match(WORD_SELECTION_REGEX);
    if (leftMatch != null) {
      const newX = termEvent.column - countCells("" + leftMatch);
      return newX;
    }
    return termEvent.column;
  }

  #handleMouseMove(event: QMouseEvent): void {
    const termEvent = this.#qMouseEventToTermApi(event);
    if ( ! termEvent.ctrlKey && this.#emulator != null && termEvent.row >= 0 && this.#emulator.mouseMove(termEvent)) {
      return;
    }

    if (this.#selectionStart == null) {
      this.#selectionStart = { x: termEvent.column, y: termEvent.row + this.#scrollback.length };
      this.#selectionEnd = this.#selectionStart;
    }

    if (termEvent.column === this.#selectionStart.x && termEvent.row === this.#selectionStart.y) {
      return;
    }

    if (this.#isWordSelection) {
      const isBeforeSelection = terminalCoordLess({x: termEvent.column, y: termEvent.row + this.#scrollback.length},
                                                  this.#selectionStart);
      if (isBeforeSelection) {
        this.#selectionEnd = { x: this.#extendXWordLeft(termEvent), y: termEvent.row + this.#scrollback.length };
      } else {
        this.#selectionEnd = { x: this.#extendXWordRight(termEvent), y: termEvent.row + this.#scrollback.length };
      }
    } else {
      this.#selectionEnd = { x: termEvent.nearestColumnEdge, y: termEvent.row + this.#scrollback.length };
    }

    this.#widget.update();
  }

  getSelectionText(): string {
    let selectionStart = this.#selectionStart;
    let selectionEnd = this.#selectionEnd;
    if (selectionStart == null || selectionEnd == null) {
      return null;
    }

    if ((selectionEnd.y < selectionStart.y) || (selectionEnd.y === selectionStart.y && selectionEnd.x < selectionStart.x)) {
      selectionStart = this.#selectionEnd;
      selectionEnd = this.#selectionStart;
    }

    const firstRow = selectionStart.y;
    const lastRow = selectionEnd.y + 1;

    const lineText: string[] = [];

    let isLastLineWrapped = false;

    for (let i=firstRow; i<lastRow; i++) {
      const line = this.#getLine(i);
      if (i === selectionStart.y) {
        if (selectionStart.y === selectionEnd.y) {
          // Small selection contained within one row.
          lineText.push(line.getString(selectionStart.x, 0, selectionEnd.x - selectionStart.x).trim());
        } else {
          // Top row of the selection.
          lineText.push(line.getString(selectionStart.x, 0, line.width-selectionStart.x).trim());
        }
      } else {
        if ( ! isLastLineWrapped) {
          lineText.push("\n");
        }
        if (i !== selectionEnd.y) {
          lineText.push(line.getString(0, 0, line.width).trim());
        } else {
          // The last row of a multi-row selection.
          lineText.push(line.getString(0, 0, selectionEnd.x));
        }
      }
      isLastLineWrapped = line.wrapped;
    }
    return lineText.join("");
  }

  #getLine(row: number): Line {
    if (row < this.#scrollback.length) {
      return this.#scrollback[row];
    }
    const screenRow = row - this.#scrollback.length;
    if (this.#emulator == null) {
      return null;
    }
    const dimensions = this.#emulator.getDimensions();
    if (screenRow >= dimensions.rows) {
      return null;
    }
    return this.#emulator.lineAtRow(screenRow);
  }
}


function terminalCoordEqual(a: TerminalCoord, b: TerminalCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

function terminalCoordLess(a: TerminalCoord, b: TerminalCoord): boolean {
  if (a.y < b.y) {
    return true;
  }
  if (a.y === b.y) {
    return a.x < b.x;
  }
  return false;
}
