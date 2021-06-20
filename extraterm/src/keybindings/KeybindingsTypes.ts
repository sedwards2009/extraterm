/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
export type LogicalKeybindingsName = "pc-style" | "pc-style-emacs" | "macos-style" | "macos-style-emacs";

export const AllLogicalKeybindingsNames: LogicalKeybindingsName[] = [
  "pc-style",
  "pc-style-emacs",
  "macos-style",
  "macos-style-emacs"
];

/**
 * Defines extra commands and default keybindings for a logical set of keybindings.
 */
export interface KeybindingsSet {

  /**
   * The name of a logical keybindings set to extend with extra commands.
   *
   * This is used primarily by extensions.
   */
  extends: LogicalKeybindingsName;

  /**
   * List of commands with their default keybindings
   */
  bindings: KeybindingsBinding[];
}

export interface KeybindingsBinding {
  command: string;
  keys: string[];
}

/**
 * Stores User customised keybindings
 */
export interface CustomKeybindingsSet {
  basedOn: LogicalKeybindingsName;
  customBindings: CustomKeybinding[];
}

export interface CustomKeybinding {
  command: string;
  keys: string[];
}

export interface StackedKeybindingsSet {
  name: LogicalKeybindingsName;
  keybindingsSet: KeybindingsSet;
  customKeybindingsSet: CustomKeybindingsSet;
}
