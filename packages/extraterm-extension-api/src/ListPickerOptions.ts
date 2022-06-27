/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ListPickerOptions {
  /**
   * The title to display in the list picker.
   */
  title?: string;

  /**
   * The list of text items to display.
   */
  items: string[];

  /**
   * The index of the item to select by default.
   */
  selectedItemIndex: number;

  /**
   * Set the initial text in filter text input.
   *
   * Defaults to the empty string if nothing is provided.
   */
  filter?: string;

  /**
   * Width of the items area in abstract pixels.
   *
   * This width is scaled up and down with the DPI of the window. 1 pixel
   * is 1 real pixel at 96 DPI.
   */
   widthPx?: number;
}
