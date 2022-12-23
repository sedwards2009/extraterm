/*
 * Copyright 2019-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Tab } from "../Tab.js";
import { BlockFrame } from "../terminal/BlockFrame.js";
import { Terminal } from "../terminal/Terminal.js";
import { Window } from "../Window.js";

// This is a way of passing through all of the state which is common across all extension contexts.

export interface CommonExtensionWindowState {
  activeWindow: Window;
  activeTab: Tab;
  activeTerminal: Terminal;
  activeBlockFrame: BlockFrame;
  activeHyperlinkURL: string;
}
