/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Category } from "../ExtensionMetadata";

export interface KeybindingsFileBinding {
  command: string;
  category: Category;
  keys: string[];
}

export interface KeybindingsFile {
  name: string;
  bindings: KeybindingsFileBinding[];
}
