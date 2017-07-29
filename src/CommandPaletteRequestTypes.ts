/*
 * Copyright 2016-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as CommandPaletteTypes from './gui/CommandPaletteTypes';

export interface CommandExecutor {
  executeCommand(commandId: string, options?: object): void;
}

export interface Commandable extends CommandExecutor {
  getCommandPaletteEntries(commandableStack: Commandable[]): CommandEntry[];
}

export function isCommandable(instance: any): instance is Commandable {
  if (instance === null || instance === undefined) {
    return false;
  }
  return (<Commandable> instance).executeCommand !== undefined && (<Commandable> instance).getCommandPaletteEntries !== undefined;
}

export function dispatchCommandPaletteRequest(element: Commandable & HTMLElement): void {
  const commandPaletteRequestEvent = new CustomEvent(EVENT_COMMAND_PALETTE_REQUEST, {bubbles: true, composed: true});
  commandPaletteRequestEvent.initCustomEvent(EVENT_COMMAND_PALETTE_REQUEST, true, true, null);
  element.dispatchEvent(commandPaletteRequestEvent);
}

export interface CommandEntry extends CommandPaletteTypes.CommandEntry {
  id: string;
  target: CommandExecutor;
  targetOptions?: object;
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";
