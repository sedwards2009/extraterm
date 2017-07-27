/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as CommandPaletteTypes from './gui/CommandPaletteTypes';

export interface Commandable {
  executeCommand(commandId: string, options?: object): void;
  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[];
}

export function isCommandable(instance: any): instance is Commandable {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<Commandable> instance).executeCommand !== undefined;
}

export interface CommandEntry extends CommandPaletteTypes.CommandEntry {
  id: string;
  target: Commandable;
  targetOptions?: object;
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";

export interface CommandPaletteRequest {
  commandableStack: Commandable[];
}
