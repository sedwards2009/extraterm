/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { QWidget } from "@nodegui/nodegui";
import { Block } from "./Block.js";

/**
 * A frame around a Block.
 *
 * Every block inside a terminal is held within a a `BlockFrame`. The visual
 * appearance of the `BlockFrame` can vary from invisible to a full frame
 * with title bar and surrounding visible frame.
 */
export interface BlockFrame {
  getBlock(): Block;
  setBlock(block: Block): void;

  getWidget(): QWidget;

  setViewportTop(relativeTopPx: number): void;

  getTag(): number;
}
