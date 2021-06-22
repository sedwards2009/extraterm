/*
 * Copyright 2019-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { ConfigCursorStyle } from "../config/Config";
// import { LigatureMarker } from "extraterm-ace-terminal-renderer";
import { FontInfo } from "../config/Config";

export interface TerminalVisualConfig {
  cursorStyle: ConfigCursorStyle;
  cursorBlink: boolean;
  fontInfo: FontInfo;
  fontSizePx: number;
  // fontFilePath: string;
  terminalTheme: TerminalTheme;
  transparentBackground: boolean;
  useLigatures: boolean;
  // ligatureMarker: LigatureMarker;

  screenWidthHintPx: number;
  screenHeightHintPx: number;
}