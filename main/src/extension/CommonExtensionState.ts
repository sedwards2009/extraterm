/*
 * Copyright 2019-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Terminal } from "../terminal/Terminal.js";
import { Window } from "../Window.js";

// This is a way of passing through all of the state which is common across all extension contexts.

export interface CommonExtensionWindowState {
  activeWindow: Window;
  // activeTabContent: HTMLElement;
  activeTerminal: Terminal;
  // activeViewerElement: ViewerElement;

  // isInputFieldFocus: boolean;

  activeHyperlinkURL: string;
}
