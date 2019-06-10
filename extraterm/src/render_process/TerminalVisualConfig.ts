/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { TerminalTheme } from 'extraterm-extension-api';

export interface TerminalVisualConfig {
  fontFamily: string;
  fontSizePx: number;
  terminalTheme: TerminalTheme;
}
