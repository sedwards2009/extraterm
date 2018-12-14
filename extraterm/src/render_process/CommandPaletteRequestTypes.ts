/*
 * Copyright 2016-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

export interface CommandMenuItem extends ExtensionApi.Command {
  shortcut?: string;
}

// A Command which is bound to a specific object/Commandable
export interface BoundCommand extends CommandMenuItem {
  commandExecutor: CommandExecutor;
}

export interface CommandExecutor {
  executeCommand(commandId: string, commandArguments?: object): void;
}

export interface Commandable extends CommandExecutor {
  getCommandPaletteEntries(commandableStack: Commandable[]): BoundCommand[];
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

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";
