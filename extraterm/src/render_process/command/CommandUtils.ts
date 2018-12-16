/*
 * Copyright 2016-2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from 'lodash';
import { Commandable, isCommandable, BoundCommand } from "./CommandTypes";
import { ExtensionManager } from "../extension/InternalTypes";
import { EtTerminal } from "../Terminal";
import { TextViewer } from "../viewers/TextAceViewer";

function dispatchCommandRequest(eventName: string, element: Commandable & HTMLElement): void {
  const commandPaletteRequestEvent = new CustomEvent(eventName, {bubbles: true, composed: true});
  commandPaletteRequestEvent.initCustomEvent(eventName, true, true, null);
  element.dispatchEvent(commandPaletteRequestEvent);
}

export function dispatchCommandPaletteRequest(element: Commandable & HTMLElement): void {
  dispatchCommandRequest(EVENT_COMMAND_PALETTE_REQUEST, element);
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";

export const EVENT_CONTEXT_MENU_REQUEST = "EVENT_CONTEXT_MENU_REQUEST";
export const COMMAND_OPEN_CONTEXT_MENU = "COMMAND_OPEN_CONTEXT_MENU";

export enum CommandType {
  COMMAND_PALETTE,
  CONTEXT_MENU
}

export function dispatchContextMenuRequest(element: Commandable & HTMLElement, x: number, y: number): void {
  const detail = {x, y};
  const commandPaletteRequestEvent = new CustomEvent(EVENT_CONTEXT_MENU_REQUEST,
                                                     {bubbles: true, composed: true, detail});
  commandPaletteRequestEvent.initCustomEvent(EVENT_CONTEXT_MENU_REQUEST, true, true, detail);
  element.dispatchEvent(commandPaletteRequestEvent);
}

export function eventToCommandableStack(ev: CustomEvent): Commandable[] {
  const path = ev.composedPath();
  return <any> path.filter(el => isCommandable(el))
}

export function commandableStackToBoundCommands(commandType: CommandType, commandableStack: Commandable[],
                                                extensionManager: ExtensionManager): BoundCommand [] {
  const filterPredicate = commandType === CommandType.COMMAND_PALETTE ?
    (command: BoundCommand): boolean => command.commandPalette !== false :
    (command: BoundCommand): boolean => command.contextMenu;

  return _.flatten(commandableStack.map(commandable => {
    let commands = commandable.getCommands(commandableStack);
    if (commandable instanceof EtTerminal) {
      commands = [...commands, ...extensionManager.getWorkspaceTerminalCommands(commandable)];
    } else if (commandable instanceof TextViewer) {
      commands = [...commands, ...extensionManager.getWorkspaceTextViewerCommands(commandable)];
    }

    return commands.filter(filterPredicate);
  }));
}
