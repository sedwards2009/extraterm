
/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { BlockPosture, ExtensionContext, Logger, Terminal, TerminalBorderWidget, TerminalOutputDetails, TerminalOutputType } from "@extraterm/extraterm-extension-api";
import { QBrush, QColor, QMouseEvent, QPainter, QPainterPath, QPaintEvent, QWidget, RenderHint, WidgetEventTypes } from '@nodegui/nodegui';

const terminalToExtensionMap = new WeakMap<Terminal, ScrollMap>();

const SCROLLBAR_WIDTH = 32;
const LEFT_PADDING = 8;
const FRAME_WIDTH = SCROLLBAR_WIDTH - LEFT_PADDING - LEFT_PADDING;

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

  #handlePaintEvent(event: QPaintEvent): void {
    // this.#log.debug(`Paint event: ${event.rect().left()}, ${event.rect().top()}, ` +
    //   `${event.rect().width()}, ${event.rect().height()}`);
    const paintRect = event.rect();
    const palette = this.#terminal.tab.window.style.palette;

    const painter = new QPainter(this.#rootWidget);
    painter.fillRectF(paintRect.left(), paintRect.top(), paintRect.width(), paintRect.height(),
      new QColor(palette.background));

    const viewport = this.#terminal.viewport;
    const hScale = paintRect.height() / viewport.contentHeight;

    const runningColor = new QColor(palette.running);
    const runningBrush = new QBrush(runningColor);
    const successColor = new QColor(palette.success);
    const successBrush = new QBrush(successColor);
    const neutralColor = new QColor(palette.neutral);
    const neutralBrush = new QBrush(neutralColor);
    const failColor = new QColor(palette.failure);
    const failBrush = new QBrush(failColor);

    painter.setRenderHint(RenderHint.Antialiasing);

    for (const block of this.#terminal.blocks) {
      const y = block.geometry.positionTop * hScale;
      const h = block.geometry.height * hScale;

      const path = new QPainterPath();

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

      // painter.fillRectF(LEFT_PADDING, y, FRAME_WIDTH, h, color);
      painter.setPen(color);
      // painter.drawRoundedRectF(LEFT_PADDING, y, FRAME_WIDTH, h, 4, 4);

      path.addRoundedRect(LEFT_PADDING, y, FRAME_WIDTH, h, 4, 4);
      painter.fillPath(path, brush);
    }

    // Draw the viewport.
    painter.setPen(new QColor(palette.text));
    painter.drawRectF(paintRect.left(), viewport.position * hScale,
      paintRect.width(), viewport.height * hScale);

    painter.end();
  }

  #handleMouse(event: QMouseEvent): void {
    this.#terminal.viewport.position = event.y() / this.#rootWidget.height() * this.#terminal.viewport.contentHeight -
      this.#terminal.viewport.height / 2;
  }
}
