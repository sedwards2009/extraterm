/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ColorRule {
  uuid: string;
  pattern: string;
  isCaseSensitive: boolean;
  isRegex: boolean;
  foreground: number;
  background: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
}

export interface Config {
  enabled: boolean;
  rules: ColorRule[];
}
