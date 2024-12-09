
/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { mat2d } from "gl-matrix";

import { Block, BlockPosture, ExtensionContext, LineRangeChange, Logger, Screen, ScreenWithCursor, Terminal, TerminalBorderWidget,
  TerminalOutputDetails, TerminalOutputType } from "@extraterm/extraterm-extension-api";
import { QBrush, QColor, QImage, QImageFormat, QMouseEvent, QPainter, QPainterPath, QPaintEvent, QWidget, RenderHint,
  WidgetEventTypes } from '@nodegui/nodegui';

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
  terminal.onDidScreenChange(handleScreenChange);
}

function handleAppendScrollbackLines(event: LineRangeChange): void {
  const pixelMap = PixelMap.getByBlock(event.block);
  pixelMap.invalidateRange(event.startLine, event.endLine);
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
        painter.fillRectF(0, y, LEFT_PADDING, h, color);
        painter.fillRectF(LEFT_PADDING + SCROLLMAP_WIDTH_CELLS, y, LEFT_PADDING, h, color);

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
    painter.setPen(new QColor(palette.text));
    painter.drawRectF(paintRect.left(), viewport.position * mapScale + mapOffset,
      paintRect.width(), viewport.height * mapScale);

    painter.end();
  }

  #drawPixelMap(painter: QPainter, pixelMap: PixelMap, y: number, rowHeight: number): void {
    let blockY = 0;
    const numberOfBlocks = pixelMap.getNumberOfBlocks();
    for (let i=0; i<numberOfBlocks ; i++) {
      const { qimage, rows } = pixelMap.getQImageAt(i);

      painter.save();

      const matrix = mat2d.create();
      mat2d.translate(matrix, matrix, [LEFT_PADDING, y + blockY]);
      mat2d.scale(matrix, matrix, [1, rowHeight / ZOOM_FACTOR]);
      painter.setTransform(matrix);

      painter.drawImage(0, 0, qimage, 0, 0, SCROLLMAP_WIDTH_CELLS, rows);

      painter.restore();

      blockY += rowHeight * SCROLLMAP_HEIGHT_ROWS / ZOOM_FACTOR;
    }
  }

  #handleMouse(event: QMouseEvent): void {
    this.#terminal.viewport.position = (event.y() - this.#getMapOffset()) * ZOOM_FACTOR - (this.#terminal.viewport.height / 2);
  }
}

interface PixelBlock {
  isDirty: boolean;
  qimage: QImage;
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
    return pixelMap;
  }

  static getByTerminal(terminal: Terminal): PixelMap {
    let pixelMap = PixelMap._terminalToPixelMap.get(terminal);
    if (pixelMap == null) {
      pixelMap = new PixelMapWithCursor(terminal.screen);
      PixelMap._terminalToPixelMap.set(terminal, pixelMap);
    }
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
    return Math.ceil(this.getScreenHeight() / SCROLLMAP_HEIGHT_ROWS);
  }

  getQImageAt(blockIndex: number): { qimage: QImage, rows: number} {
    this.#expandBlocks();

    const scrollbackHeight = this.getScreenHeight();
    const blockY = blockIndex * SCROLLMAP_HEIGHT_ROWS;
    const blockHeight = Math.min(SCROLLMAP_HEIGHT_ROWS, scrollbackHeight - blockY);
    const pixelBlock = this.#pixelBlocks[blockIndex];
    let qimage = pixelBlock.qimage;
    if (pixelBlock.isDirty || qimage == null) {
      qimage = this.#createQImage(this.#screen, this.getScreenHeight(), blockIndex * SCROLLMAP_HEIGHT_ROWS);
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

  #createQImage(screen: Screen, heightRows: number, y: number): QImage {
    const buffer = PixelMap.tempBuffer;

    buffer.fill(0);
    const blockHeight = Math.min(SCROLLMAP_HEIGHT_ROWS, heightRows - y);
    for (let i=0; i<blockHeight; i++, y++) {
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
    this.#expandBlocks();
    const startBlock = Math.floor(startLine / SCROLLMAP_HEIGHT_ROWS);
    const endBlock = Math.floor(endLine / SCROLLMAP_HEIGHT_ROWS);
    for (let i=startBlock; i<=endBlock; i++) {
      this.#pixelBlocks[i].isDirty = true;
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
