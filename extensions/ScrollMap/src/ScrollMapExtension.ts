
/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { mat2d } from "gl-matrix";

import { Block, BlockPosture, ExtensionContext, LineRangeChange, Logger, Terminal, TerminalBorderWidget, TerminalOutputDetails, TerminalOutputType } from "@extraterm/extraterm-extension-api";
import { QBrush, QColor, QImage, QImageFormat, QMouseEvent, QPainter, QPainterPath, QPaintEvent, QWidget, RenderHint, WidgetEventTypes } from '@nodegui/nodegui';

const terminalToExtensionMap = new WeakMap<Terminal, ScrollMap>();

const SCROLLMAP_WIDTH_CELLS = 120;
const SCROLLMAP_HEIGHT_ROWS = 256;

const LEFT_PADDING = 8;
const RIGHT_PADDING = 8;
const SCROLLBAR_WIDTH = SCROLLMAP_WIDTH_CELLS + LEFT_PADDING + RIGHT_PADDING;

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
}

function handleAppendScrollbackLines(event: LineRangeChange): void {
  const pixelMap = PixelMap.get(event.block);
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

    for (const block of this.#terminal.blocks) {
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
        painter.fillRectF(0, y, LEFT_PADDING, h, color);
        painter.fillRectF(LEFT_PADDING + SCROLLMAP_WIDTH_CELLS, y, LEFT_PADDING, h, color);

        const pixelMap = PixelMap.get(block);
        const terminalDetails = <TerminalOutputDetails> block.details;
        let blockY = 0;
        const numberOfBlocks = pixelMap.getNumberOfBlocks();
        for (let i=0; i<numberOfBlocks ; i++) {
          const { qimage, rows } = pixelMap.getQImageAt(i);

          painter.save();

          const matrix = mat2d.create();
          mat2d.translate(matrix, matrix, [LEFT_PADDING, y + blockY]);
          mat2d.scale(matrix, matrix, [1, terminalDetails.rowHeight / ZOOM_FACTOR]);
          painter.setTransform(matrix);

          painter.drawImage(0, 0, qimage, 0, 0, SCROLLMAP_WIDTH_CELLS, rows);

          painter.restore();

          blockY += terminalDetails.rowHeight * SCROLLMAP_HEIGHT_ROWS / ZOOM_FACTOR;
        }
      } else {

        const path = new QPainterPath();
        path.addRoundedRect(0, y, SCROLLBAR_WIDTH, h, 4, 4);
        painter.fillPath(path, brush);
      }
    }

    // Draw the viewport.
    painter.setPen(new QColor(palette.text));
    painter.drawRectF(paintRect.left(), viewport.position * mapScale + mapOffset,
      paintRect.width(), viewport.height * mapScale);

    painter.end();
  }

  #handleMouse(event: QMouseEvent): void {
    this.#terminal.viewport.position = (event.y() - this.#getMapOffset()) * ZOOM_FACTOR - (this.#terminal.viewport.height / 2);
  }
}

interface PixelBlock {
  isDirty: boolean;
  qimage: QImage;
}

class PixelMap {
  static tempBuffer = Buffer.alloc(4 * SCROLLMAP_WIDTH_CELLS * SCROLLMAP_HEIGHT_ROWS);

  static _blockToPixelMap = new WeakMap<Block, PixelMap>();

  static get(block: Block): PixelMap {
    let pixelMap = PixelMap._blockToPixelMap.get(block);
    if (pixelMap == null) {
      pixelMap = new PixelMap(block);
      PixelMap._blockToPixelMap.set(block, pixelMap);
    }
    return pixelMap;
  }

  #block: Block = null;
  #pixelBlocks: PixelBlock[] = [];


  constructor(block: Block) {
    this.#block = block;
  }

  #getScrollbackHeight(): number {
    const terminalDetails = <TerminalOutputDetails> this.#block.details;
    return terminalDetails.scrollback.height;
  }

  getNumberOfBlocks(): number {
    return Math.ceil(this.#getScrollbackHeight() / SCROLLMAP_HEIGHT_ROWS);
  }

  getQImageAt(blockIndex: number): { qimage: QImage, rows: number} {
    this.#expandBlocks();

    const scrollbackHeight = this.#getScrollbackHeight();
    const blockY = blockIndex * SCROLLMAP_HEIGHT_ROWS;
    const blockHeight = Math.min(SCROLLMAP_HEIGHT_ROWS, scrollbackHeight - blockY);
    const pixelBlock = this.#pixelBlocks[blockIndex];
    let qimage = pixelBlock.qimage;
    if (pixelBlock.isDirty || qimage == null) {
      qimage = this.#createQImage(blockIndex);
      pixelBlock.qimage = qimage;
      pixelBlock.isDirty = false;
    }
    return { qimage, rows: blockHeight };
  }

  #expandBlocks(): void {
    const numberOfBlocks = this.getNumberOfBlocks();
    while (numberOfBlocks > this.#pixelBlocks.length) {
      this.#pixelBlocks.push({ isDirty: true, qimage: null });
    }
  }

  #createQImage(blockIndex: number): QImage {
    const terminalDetails = <TerminalOutputDetails> this.#block.details;
    const scrollback = terminalDetails.scrollback;
    const height = scrollback.height;
    let y = blockIndex * SCROLLMAP_HEIGHT_ROWS;
    const buffer = PixelMap.tempBuffer;

    buffer.fill(0);
    const blockHeight = Math.min(SCROLLMAP_HEIGHT_ROWS, height - y);
    for (let i=0; i<blockHeight; i++, y++) {
      let bufferOffset = i * SCROLLMAP_WIDTH_CELLS * 4;

      const row = scrollback.getBaseRow(y);
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
    this.#expandBlocks();
    const startBlock = Math.floor(startLine / SCROLLMAP_HEIGHT_ROWS);
    const endBlock = Math.floor(endLine / SCROLLMAP_HEIGHT_ROWS);
    for (let i=startBlock; i<=endBlock; i++) {
      this.#pixelBlocks[i].isDirty = true;
    }
  }
}
