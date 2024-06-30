/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QLabel } from "@nodegui/nodegui";
import { Terminal } from "./Terminal.js";
import { ListPickerOptions } from "./ListPickerOptions.js";
import { Window } from "./Windows.js";


export interface TabTitleWidgetFactory {
  (terminal: Terminal): QLabel;
}

export interface Tab {
  /**
   * Any terminal contained inside this tab.
   */
  readonly terminal: Terminal;


  showDialog(options: DialogOptions): Promise<number | undefined>;

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
   * Show a list picker and allow an item to be selected.
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
   * Show a text input box and allow the user to enter some text.
   *
   * See `TextInputOptions` for more details about how to configure this.
   *
   * @return a promise which resolves to the entered text or undefined if is
   *          was cancelled.
   */
  showTextInput(options: TextInputOptions): Promise<string | undefined>;

  /**
   * True if this terminal is still open.
   *
   * Once the uesr closes a terminal tab and the tab disappears, then this will return `false`.
   */
  readonly isAlive: boolean;

  /**
   * Get the window holding this tab
   *
   * Note: Tabs can move between windows.
   */
  readonly window: Window;

  /**
   * The text to show in the window title bar.
   */
  windowTitle: string;
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

export interface ButtonOptions {
  label: string;
  type?: 'success' | 'info' | 'danger' | 'warning';
}

export interface DialogOptions {
  message: string;
  isHtml?: boolean;
  buttonOptions: (string | ButtonOptions)[];
}

export interface TextInputOptions {
  message: string;
  isHtml?: boolean;
  value: string;
  placeholder?: string;
  password?: boolean;
}
