/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ListPickerOptions {
  /**
   * The title to display in the list picker.
   */
  title: string;

  /**
   * The list of text items to display.
   */
  items: string[];

  /**
   * The index of the item to select by default.
   */
  selectedItemIndex: number;
}
