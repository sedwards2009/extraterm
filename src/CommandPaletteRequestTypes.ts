/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as CommandPaletteTypes from './gui/CommandPaletteTypes';

export interface Commandable {
  executeCommand(commandId: string): void;
}

export function isCommandable(instance: any): instance is Commandable {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<Commandable> instance).executeCommand !== undefined;
}

export interface CommandEntry extends CommandPaletteTypes.CommandEntry {
  id: string;
  iconLeft?: string;
  iconRight?: string;
  label: string;
  shortcut?: string;
  target: Commandable;
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";

export interface CommandPaletteRequest {
  commandEntries: CommandEntry[];
  srcElement: HTMLElement;
  contextElement: HTMLElement;
}
