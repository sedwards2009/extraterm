/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Direction, QWidget } from "@nodegui/nodegui";
import { BoxLayout, Widget } from "qt-construct";
import { getLogger, log, Logger } from "extraterm-logging";
import { Block } from "./Block";
import { BlockFrame } from "./BlockFrame";

/**
 * A frame around a Block.
 *
 * Every block inside a terminal is held within a a `BlockFrame`. The visual
 * appearance of the `BlockFrame` can vary from invisible to a full frame
 * with title bar and surrounding visible frame.
 */
export class SpacerFrame implements BlockFrame {
  #block: Block = null;
  #widget: QWidget = null;

  constructor(block: Block) {
    this.#block = block;

    this.#widget = Widget({
      cssClass: "frame",
      layout: BoxLayout({
        direction: Direction.TopToBottom,
        contentsMargins: [10, 5, 10, 5],
        children: [
          block.getWidget()
        ]
      })
    });
  }

  getBlock(): Block {
    return this.#block;
  }

  getWidget(): QWidget {
    return this.#widget;
    // return this.#block.getWidget();
  }
}
