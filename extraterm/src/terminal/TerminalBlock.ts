/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QColor, QFrame, QPainter, QPen, QWidget, QLabel, QPaintEvent, TextFormat, QImage, WidgetEventTypes } from "@nodegui/nodegui";
import { getLogger, Logger } from "extraterm-logging";
import { Block } from "./Block";

/**
 * Shows the contents of a terminal and can accept input.
 */
export class TerminalBlock implements Block {
  private _log: Logger = null;

  #widget: QWidget = null;

  constructor() {
    this._log = getLogger("TerminalBlock", this);
    this.#widget = this.#createWidget();
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

  #handlePaintEvent(event: QPaintEvent): void {
    const paintRect = event.rect();
this._log.debug(`paintRect.left: ${paintRect.left()}, paintRect.top: ${paintRect.top()}`);
this._log.debug(`paintRect.width: ${paintRect.width()}, paintRect.height: ${paintRect.height()}`);

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

    painter.end();
  }
}
