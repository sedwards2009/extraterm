
/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { mat2d } from "gl-matrix";

import { Block, BlockPosture, ExtensionContext, LineRangeChange, Logger, Screen, ScreenWithCursor, Terminal, TerminalBorderWidget,
  TerminalOutputDetails, TerminalOutputType } from "@extraterm/extraterm-extension-api";
import { QBrush, QColor, QImage, QImageFormat, QMouseEvent, QPainter, QPainterPath, QPaintEvent, QPen, QWidget, RenderHint,
  WidgetEventTypes } from '@nodegui/nodegui';

const terminalToExtensionMap = new WeakMap<Terminal, ScrollMap>();

const SCROLLMAP_WIDTH_CELLS = 120;
const SCROLLMAP_HEIGHT_ROWS = 256;

const LEFT_PADDING = 4;
const RIGHT_PADDING = 4;
const FRAME_WIDTH = 4;
const SCREEN_BORDER_WIDTH = 4;
const SCROLLBAR_WIDTH = SCROLLMAP_WIDTH_CELLS + LEFT_PADDING + RIGHT_PADDING + 2 * FRAME_WIDTH;

const ZOOM_FACTOR = 16;

let log: Logger = null;
let context: ExtensionContext = null;

export function activate(_context: ExtensionContext): any {
  log = _context.logger;
  context = _context;

  context.terminals.onDidCreateTerminal(handleNewTerminal);
  for (const terminal of context.terminals.terminals) {
    handleNewTerminal(terminal);
  }
}

function handleNewTerminal(terminal: Terminal): void {
  const scrollMap = new ScrollMap(terminal);
  terminalToExtensionMap.set(terminal, scrollMap);
  terminal.onDidAppendScrollbackLines(handleAppendScrollbackLines);
  terminal.onDidDeleteScrollbackLines(handleDeleteScrollbackLines);
  terminal.onDidScreenChange(handleScreenChange);
}

function handleAppendScrollbackLines(event: LineRangeChange): void {
  const pixelMap = PixelMap.getByBlock(event.block);
  pixelMap.invalidateRange(event.startLine, event.endLine);
}

function handleDeleteScrollbackLines(event: LineRangeChange): void {
  const pixelMap = PixelMap.getByBlock(event.block);
  pixelMap.deleteTopLines(event.endLine);
}

function handleScreenChange(event: LineRangeChange): void {
  const terminal = event.block.terminal;
  const pixelMap = PixelMap.getByTerminal(terminal);
  pixelMap.invalidateRange(event.startLine, event.endLine);
}

class ScrollMap {
  #terminal: Terminal = null;
  #borderWidget: TerminalBorderWidget = null;
  #scrollMapWidget: ScrollMapWidget = null;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;

    this.#borderWidget = this.#terminal.createTerminalBorderWidget("scrollmap");

    this.#scrollMapWidget = new ScrollMapWidget(log, terminal);
    this.#borderWidget.contentWidget = this.#scrollMapWidget.getWidget();
    this.#borderWidget.open();
  }
}

class ScrollMapWidget {
  #log: Logger;
  #terminal: Terminal = null;
  #rootWidget: QWidget = null;

  constructor(log: Logger, terminal: Terminal) {
    this.#log = log;
    this.#rootWidget = this.#createWidget();
    this.#terminal = terminal;

    const repaint = () => {
      this.#rootWidget.repaint();
    };
    this.#terminal.onDidScreenChange(repaint);
    this.#terminal.onDidAppendBlock(repaint);
    this.#terminal.onDidAppendScrollbackLines(repaint);
    this.#terminal.viewport.onDidChange(repaint);
  }

  #createWidget(): QWidget {
    const widget = new QWidget();

    widget.setMaximumSize(SCROLLBAR_WIDTH, 16777215);
    widget.setMinimumSize(SCROLLBAR_WIDTH, 32);

    widget.addEventListener(WidgetEventTypes.Paint, (nativeEvent) => {
      this.#handlePaintEvent(new QPaintEvent(nativeEvent));
    });

    const handleMouse = (nativeEvent) => {
      this.#handleMouse(new QMouseEvent(nativeEvent));
    };
    widget.addEventListener(WidgetEventTypes.MouseButtonPress, handleMouse);
    widget.addEventListener(WidgetEventTypes.MouseMove, handleMouse);

    return widget;
  }

  getWidget(): QWidget {
    return this.#rootWidget;
  }

  #getMapOffset(): number {
    const mapScale = 1 / ZOOM_FACTOR;
    const viewport = this.#terminal.viewport;
    const mapOffset = -(mapScale * viewport.position - viewport.position /
      (viewport.contentHeight - viewport.height) * (this.#rootWidget.height()- mapScale * viewport.height));
    return Math.min(0, mapOffset);
  }

  #handlePaintEvent(event: QPaintEvent): void {
    const paintRect = event.rect();
    const palette = this.#terminal.tab.window.style.palette;

    const painter = new QPainter(this.#rootWidget);
    painter.fillRectF(paintRect.left(), paintRect.top(), paintRect.width(), paintRect.height(),
      new QColor(palette.background));

    const mapScale = 1 / ZOOM_FACTOR;
    const viewport = this.#terminal.viewport;

    const runningColor = new QColor(palette.running);
    const runningBrush = new QBrush(runningColor);
    const successColor = new QColor(palette.success);
    const successBrush = new QBrush(successColor);
    const neutralColor = new QColor(palette.neutral);
    const neutralBrush = new QBrush(neutralColor);
    const failColor = new QColor(palette.failure);
    const failBrush = new QBrush(failColor);

    painter.setRenderHint(RenderHint.Antialiasing);

    const mapOffset = this.#getMapOffset();

    const blocks = this.#terminal.blocks;
    for (const block of blocks) {
      const y = block.geometry.positionTop * mapScale + mapOffset;
      const h = block.geometry.height * mapScale;

      let color = neutralColor;
      let brush = neutralBrush;
      switch (block.metadata.posture) {
        case BlockPosture.RUNNING:
          color = runningColor;
          brush = runningBrush;
          break;

        case BlockPosture.SUCCESS:
          color = successColor;
          brush = successBrush;
          break;

        case BlockPosture.FAILURE:
          color = failColor;
          brush = failBrush;
          break;

        default:
          break;
      }

      painter.setPen(color);

      if (block.type === TerminalOutputType) {
        painter.fillRectF(LEFT_PADDING, y, FRAME_WIDTH, h, color);
        painter.fillRectF(LEFT_PADDING + FRAME_WIDTH + SCROLLMAP_WIDTH_CELLS, y, FRAME_WIDTH, h, color);

        const terminalDetails = <TerminalOutputDetails> block.details;
        const rowHeight = terminalDetails.rowHeight;
        const pixelMap = PixelMap.getByBlock(block);
        this.#drawPixelMap(painter, pixelMap, y, rowHeight);
      } else {

        const path = new QPainterPath();
        path.addRoundedRect(0, y, SCROLLBAR_WIDTH, h, 4, 4);
        painter.fillPath(path, brush);
      }
    }

    // Draw the screen
    const lastBlock = blocks[blocks.length-1];
    const terminalDetails = <TerminalOutputDetails> lastBlock.details;
    const rowHeight = terminalDetails.rowHeight;
    const screenY = lastBlock.geometry.positionTop + terminalDetails.scrollback.height * rowHeight;
    this.#drawPixelMap(painter, PixelMap.getByTerminal(this.#terminal), screenY * mapScale + mapOffset, rowHeight);

    // Draw the viewport outline
    const widerPen = new QPen();
    widerPen.setWidth(SCREEN_BORDER_WIDTH);
    widerPen.setColor(new QColor(palette.text));
    painter.setPen(widerPen);
    painter.drawRectF(paintRect.left() + SCREEN_BORDER_WIDTH / 2, viewport.position * mapScale + mapOffset,
      paintRect.width() - SCREEN_BORDER_WIDTH, viewport.height * mapScale);

    painter.end();
  }

  #drawPixelMap(painter: QPainter, pixelMap: PixelMap, y: number, rowHeight: number): void {
    let blockRowY = 0;
    const numberOfBlocks = pixelMap.getNumberOfBlocks();
    for (let i=0; i<numberOfBlocks ; i++) {
      const { qimage, rows } = pixelMap.getQImageAt(i);

      painter.save();

      const matrix = mat2d.create();
      mat2d.translate(matrix, matrix, [LEFT_PADDING + FRAME_WIDTH, y + blockRowY * rowHeight / ZOOM_FACTOR]);
      mat2d.scale(matrix, matrix, [1, rowHeight / ZOOM_FACTOR]);
      painter.setTransform(matrix);

      painter.drawImage(0, 0, qimage, 0, 0, SCROLLMAP_WIDTH_CELLS, rows);

      painter.restore();

      blockRowY += rows;
    }
  }

  #handleMouse(event: QMouseEvent): void {
    this.#terminal.viewport.position = (event.y() - this.#getMapOffset()) * ZOOM_FACTOR - (this.#terminal.viewport.height / 2);
  }
}

interface PixelBlock {
  qimage: QImage;
  height: number;
}

class PixelMap<S extends Screen = Screen> {
  static tempBuffer = Buffer.alloc(4 * SCROLLMAP_WIDTH_CELLS * SCROLLMAP_HEIGHT_ROWS);

  static _blockToPixelMap = new WeakMap<Block, PixelMap>();

  static _terminalToPixelMap = new WeakMap<Terminal, PixelMap>();

  static getByBlock(block: Block): PixelMap {
    let pixelMap = PixelMap._blockToPixelMap.get(block);
    if (pixelMap == null) {
      const terminalDetails = <TerminalOutputDetails> block.details;
      pixelMap = new PixelMap(terminalDetails.scrollback);
      PixelMap._blockToPixelMap.set(block, pixelMap);
    }
    pixelMap.expandBlocks();
    return pixelMap;
  }

  static getByTerminal(terminal: Terminal): PixelMap {
    let pixelMap = PixelMap._terminalToPixelMap.get(terminal);
    if (pixelMap == null) {
      pixelMap = new PixelMapWithCursor(terminal.screen);
      PixelMap._terminalToPixelMap.set(terminal, pixelMap);
    }
    pixelMap.expandBlocks();
    return pixelMap;
  }

  #screen: S = null;
  #pixelBlocks: PixelBlock[] = [];

  constructor(screen: S) {
    this.#screen = screen;
  }

  protected getScreenHeight(): number {
    return this.#screen.height;
  }

  getNumberOfBlocks(): number {
    return this.#pixelBlocks.length;
  }

  getQImageAt(blockIndex: number): { qimage: QImage, rows: number} {
    const pixelBlock = this.#pixelBlocks[blockIndex];
    if (pixelBlock.qimage == null) {
      const y = this.#blockIndexToY(blockIndex);
      const image = this.#createQImage(this.#screen, y, pixelBlock.height);
      pixelBlock.qimage = image;
    }
    return { qimage: pixelBlock.qimage, rows: pixelBlock.height };
  }

  #blockIndexToY(blockIndex: number): number {
    if (blockIndex === 0) {
      return 0;
    }
    return this.#pixelBlocks[0].height + (blockIndex-1) * SCROLLMAP_HEIGHT_ROWS;
  }

  #yToBlockIndex(y: number): number {
    const blockZeroHeight = this.#pixelBlocks[0].height;
    if (y < blockZeroHeight) {
      return 0;
    }
    return Math.ceil((y - blockZeroHeight) / SCROLLMAP_HEIGHT_ROWS);
  }

  #existingRows(): number {
    // The first and last blocks can have variable heights, but the middle blocks are always SCROLLMAP_HEIGHT_ROWS.
    const pixelBlocksLength = this.#pixelBlocks.length;
    switch (pixelBlocksLength) {
      case 0:
        return 0;
      case 1:
        return this.#pixelBlocks[0].height;
      default:
        return (this.#pixelBlocks[0].height + (pixelBlocksLength - 2) * SCROLLMAP_HEIGHT_ROWS +
          this.#pixelBlocks[pixelBlocksLength-1].height);
    }
  }

  expandBlocks(): void {
    const totalScreenRows = this.getScreenHeight();
    let existingRows = this.#existingRows();

    if (totalScreenRows !== existingRows && this.#pixelBlocks.length !== 0) {
      this.#pixelBlocks.pop();
      existingRows = this.#existingRows();
    }

    while (totalScreenRows > existingRows) {
      const rows = Math.min(totalScreenRows - existingRows, SCROLLMAP_HEIGHT_ROWS);
      this.#pixelBlocks.push({ qimage: null, height: rows });
      existingRows += rows;
    }
  }

  #createQImage(screen: Screen, y: number, rows: number): QImage {
    const buffer = PixelMap.tempBuffer;

    buffer.fill(0);
    for (let i=0; i<rows; i++, y++) {
      let bufferOffset = i * SCROLLMAP_WIDTH_CELLS * 4;

      const row = screen.getBaseRow(y);
      const codePoints = row.getRowCodePoints();
      const maxX = Math.min(SCROLLMAP_WIDTH_CELLS, codePoints.length);
      for (let x=0; x<maxX; x++) {
        const codePoint = codePoints[x];
        const value = codePoint === 32 ? row.getBgRGBA(x) : row.getFgRGBA(x);

        buffer[bufferOffset] = (value >> 24) & 0xff;
        bufferOffset++;
        buffer[bufferOffset] = (value >> 16) & 0xff;
        bufferOffset++;
        buffer[bufferOffset] = (value >> 8) & 0xff;
        bufferOffset++;
        buffer[bufferOffset] = 0xff;
        bufferOffset++;
      }
    }

    return QImage.fromBuffer(buffer, SCROLLMAP_WIDTH_CELLS, SCROLLMAP_HEIGHT_ROWS, QImageFormat.RGBA8888);
  }

  invalidateRange(startLine: number, endLine: number): void {
    const startBlock = this.#yToBlockIndex(startLine);
    const endBlock = this.#yToBlockIndex(endLine);
    for (let i=startBlock; i<=endBlock; i++) {
      this.#pixelBlocks[i].qimage = null;
    }
  }

  deleteTopLines(endLine: number): void {
    let remaining = endLine;
    while (remaining > 0) {
      const block = this.#pixelBlocks[0];
      if (block.height <= remaining) {
        this.#pixelBlocks.shift();
        remaining -= block.height;
      } else {
        block.height -= remaining;
        block.qimage = null;
        remaining = 0;
      }
    }
  }
}

class PixelMapWithCursor extends PixelMap<ScreenWithCursor> {

  #screen: ScreenWithCursor = null;

  constructor(screen: ScreenWithCursor) {
    super(screen);
    this.#screen = screen;
  }

  protected getScreenHeight(): number {
    return this.#screen.materializedHeight;
  }
}
