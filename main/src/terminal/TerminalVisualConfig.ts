/*
 * Copyright 2019-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TerminalTheme } from "@extraterm/extraterm-extension-api";
import { FontSlice } from "extraterm-char-render-canvas";
import { LigatureMarker } from "../CachingLigatureMarker";
import { ConfigCursorStyle } from "../config/Config";
import { FontInfo } from "../config/Config";

export interface TerminalVisualConfig {
  cursorStyle: ConfigCursorStyle;
  cursorBlink: boolean;
  fontInfo: FontInfo;
  fontSizePt: number;
  extraFonts: FontSlice[];
  palette: number[];
  terminalTheme: TerminalTheme;
  transparentBackground: boolean;
  useLigatures: boolean;
  ligatureMarker: LigatureMarker;

  screenWidthHintPx: number;
  screenHeightHintPx: number;
}

export const PALETTE_BG_INDEX = 256;
export const PALETTE_FG_INDEX = 257;
export const PALETTE_CURSOR_INDEX = 258;
