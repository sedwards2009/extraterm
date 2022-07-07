/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { BlockFrame } from "./terminal/BlockFrame.js";
import { Terminal } from "./terminal/Terminal.js";

export interface ContextMenuEvent {
  x: number;
  y: number;
  blockFrame: BlockFrame;
  terminal: Terminal;
}
