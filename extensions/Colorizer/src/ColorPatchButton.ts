/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QColor, QPainter, QPushButton, WidgetEventTypes } from "@nodegui/nodegui";
import { PushButton } from "qt-construct";
import {
  Event,
  Logger,
} from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";


const BORDER_PX = 6;  // TODO dpi


export class ColorPatchButton {
  #log: Logger = null;
  #widget: QPushButton = null;
  #color: QColor = null;

  #onClickedEventEmitter = new EventEmitter<void>();
  onClicked: Event<void> = null;

  constructor(checkable: boolean, log: Logger) {
    this.#log = log;
    this.onClicked = this.#onClickedEventEmitter.event;

    this.#widget = PushButton({
      cssClass: ["small"],
      text: "",
      checkable,
      onClicked: () => {
        this.#onClickedEventEmitter.fire();
      }
    });
    this.#widget.addEventListener(WidgetEventTypes.Paint, (nativeEvent) => {
      this.#handlePaint();
    }, { afterDefault: true });
  }

  setColor(color: QColor): void {
    this.#color = color;
    this.#widget.update();
  }

  #handlePaint(): void {
    const painter = new QPainter(this.#widget);
    const patchColor = this.#color;
    if (patchColor != null) {
      const geo = this.#widget.geometry();
      painter.fillRect(BORDER_PX, BORDER_PX, geo.width() - 2*BORDER_PX, geo.height() - 2*BORDER_PX, patchColor);
    }
    painter.end();
  }

  getWidget(): QPushButton {
    return this.#widget;
  }
}
