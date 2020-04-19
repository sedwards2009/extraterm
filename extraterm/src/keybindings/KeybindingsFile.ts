/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Category } from "../ExtensionMetadata";

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
export interface KeybindingsFile {

  /**
   * The name of a logical keybindings set to extend with extra commands.
   *
   * This is used primarily by extensions.
   */
  extends: LogicalKeybindingsName;

  /**
   * List of commands with their default keybindings
   */
  bindings: KeybindingsFileBinding[];
}

export interface KeybindingsFileBinding {
  command: string;
  category: Category;
  keys: string[];
}

/**
 * Stores User customised keybindings
 */
export interface CustomKeybindingsFile {
  basedOn: LogicalKeybindingsName;
  customBindings: KeybindingsFileBinding[];
}

export interface CustomKeybinding {
  command: string;
  keys: string[];
}

export interface StackedKeybindingsFile {
  name: LogicalKeybindingsName;
  keybindingsFile: KeybindingsFile;
  customKeybindingsFile: CustomKeybindingsFile;
}
