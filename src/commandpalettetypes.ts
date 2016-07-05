/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface Commandable {
  executeCommand(commandId: string): void;
}

export interface CommandEntry {
  id: string;
  iconLeft?: string;
  iconRight?: string;
  label: string;
  shortcut?: string;
  target: Commandable;
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";

export interface CommandPaletteRequest {
  commandEntries: CommandEntry[];
  srcElement: HTMLElement;
}
