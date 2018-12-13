/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface KeybindingsFileContext {
  [key: string]: string;
}

export interface KeybindingsFile {
  [context: string]: KeybindingsFileContext;
}
