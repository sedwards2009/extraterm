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

export function dispatchCommandPaletteRequest(element: Commandable & HTMLElement): void {
  const commandPaletteRequestEvent = new CustomEvent(EVENT_COMMAND_PALETTE_REQUEST, {bubbles: true, composed: true});
  commandPaletteRequestEvent.initCustomEvent(EVENT_COMMAND_PALETTE_REQUEST, true, true, null);
  element.dispatchEvent(commandPaletteRequestEvent);
}

export const EVENT_COMMAND_PALETTE_REQUEST = "EVENT_COMMAND_PALETTE_REQUEST";
export const COMMAND_OPEN_COMMAND_PALETTE = "openCommandPalette";

export function eventToCommandableStack(ev: CustomEvent): Commandable[] {
  const path = ev.composedPath();
  return <any> path.filter(el => isCommandable(el))
}

export function commandableStackToBoundCommands(commandableStack: Commandable[],
                                                extensionManager: ExtensionManager): BoundCommand [] {
  return _.flatten(commandableStack.map(commandable => {
    let result = commandable.getCommands(commandableStack);
    if (commandable instanceof EtTerminal) {
      result = [...result, ...extensionManager.getWorkspaceTerminalCommands(commandable)];
    } else if (commandable instanceof TextViewer) {
      result = [...result, ...extensionManager.getWorkspaceTextViewerCommands(commandable)];
    }
    return result;
  }));
}
