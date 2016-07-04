/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface CommandEntry {
  id: string;
  iconLeft?: string;
  iconRight?: string;
  label: string;
  shortcut?: string;
}
