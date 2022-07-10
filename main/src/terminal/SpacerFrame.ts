/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QBoxLayout, QWidget } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Block } from "./Block.js";
import { BlockFrame } from "./BlockFrame.js";
import { UiStyle } from "../ui/UiStyle.js";

/**
 * A frame around a Block.
 *
 * Every block inside a terminal is held within a a `BlockFrame`. The visual
 * appearance of the `BlockFrame` can vary from invisible to a full frame
 * with title bar and surrounding visible frame.
 */
export class SpacerFrame implements BlockFrame {
  private _log: Logger = null;
  #uiStyle: UiStyle = null;

  #block: Block = null;
  #widget: QWidget = null;
  #layout: QBoxLayout = null;

  constructor(uiStyle: UiStyle) {
    this._log = getLogger("SpacerFrame", this);
    this.#uiStyle = uiStyle;

    const leftRightMargin = this.#uiStyle.getFrameMarginLeftRightPx();

    this.#widget = Widget({
      objectName: this._log.getName(),
      cssClass: "frame",
      layout: this.#layout = BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [
          leftRightMargin,
          0,
          leftRightMargin,
          0
        ],
        children: [
        ]
      })
    });
  }

  getTag(): number {
    return -1;
  }

  getBlock(): Block {
    return this.#block;
  }

  setBlock(block: Block): void {
    if (this.#block != null) {
      this.#layout.removeWidget(this.#block.getWidget());
      this.#block.getWidget().setParent(null);
    }
    this.#block = block;
    if (block != null) {
      this.#layout.addWidget(block.getWidget());
      block.getWidget().setParent(this.#widget);
    }
  }

  getWidget(): QWidget {
    return this.#widget;
  }

  setViewportTop(relativeTopPx: number): void {
    //no-op
  }
}
