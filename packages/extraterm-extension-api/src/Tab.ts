/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { Terminal } from "./Terminal";

export interface TabTitleWidget {
  getContainerElement(): HTMLElement;
}

export interface TabTitleWidgetFactory {
  (terminal: Terminal, widget: TabTitleWidget): any;
}

export interface Tab {
  /**
   * Get any terminal contained inside this tab.
   */
  getTerminal(): Terminal;

  /**
   * Show an input box requesting a number.
   *
   * This shows a picker/dialog on this tab where the user can enter a number.
   * The acceptable range of values can be defined in the `options` parameter.
   * `undefined` is returned if the user canceled the picker by pressing
   * escape, for example. The picker appears with in this tab.
   *
   * See `NumberInputOptions` for more details about how to configure this.
   *
   * @return a promise which resolves to the entered number or undefined if
   *          it was canceled.
   */
  showNumberInput(options: NumberInputOptions): Promise<number | undefined>;

  /**
   * Show a list picker requesting an item from the list.
   *
   * This shows the given list of strings and lets the user select one or
   * them or cancel the picker. The index of the item in the list is return
   * if an item is selected. `undefined` is returned if the user canceled the
   * picker by pressing escape, for example. The picker appears with in this
   * tab.
   *
   * See `ListPickerOptions` for more details about how to configure this.
   *
   * @return a promise which resolves to the selected item index or
   *          undefined if it was canceled.
   */
  showListPicker(options: ListPickerOptions): Promise<number | undefined>;

  /**
   * True if this terminal is still open.
   *
   * Once the uesr closes a terminal tab and the tab disappears, then this will return `false`.
   */
  isAlive(): boolean;
}

export interface NumberInputOptions {
  /**
   * The title of the input box.
   */
  title: string;

  /**
   * The default value of the input box.
   */
  value: number;

  /**
   * The minimum acceptable value.
   */
  minimum?: number;

  /**
   * The maximum acceptable value.
   */
  maximum?: number;
}


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
