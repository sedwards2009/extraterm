/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';
import { Logger, getLogger, log } from 'extraterm-logging';
import { ExtensionCommandContribution, ExtensionMenusContribution } from '../../ExtensionMetadata';
import { InternalExtensionContext } from './InternalTypes';

export interface CommandMenuEntry {
  commandContribution: ExtensionCommandContribution;
  contextMenu: boolean;
  commandPalette: boolean;
  emptyPane: boolean;
  newTerminal: boolean;
  terminalTab: boolean;
}

export class CommandsRegistry implements ExtensionApi.Commands {

  private _log: Logger;
  private _commandToFunctionMap = new Map<string, (args: any) => any>();
  private _commandToCustomizerFunctionMap = new Map<string, () => ExtensionApi.CustomizedCommand>();
  _commandToMenuEntryMap: Map<string, CommandMenuEntry[]> = null;

  constructor(
      private _internalExtensionContext: InternalExtensionContext,
      private _extensionName: string,
      commands: ExtensionCommandContribution[],
      menus: ExtensionMenusContribution) {

    this._log = getLogger("CommandsRegistry", this);

    this._commandToMenuEntryMap = this._buildCommandMenuIndex(commands, menus);
  }

  private _buildCommandMenuIndex(commands: ExtensionCommandContribution[], menus: ExtensionMenusContribution): Map<string, CommandMenuEntry[]> {
    const index = new Map<string, CommandMenuEntry[]>();

    for (const commandContribution of commands) {

      if ( ! index.has(commandContribution.command)) {
        index.set(commandContribution.command, []);
      }

      index.get(commandContribution.command).push({
        commandContribution,
        commandPalette: true,
        contextMenu: false,
        emptyPane: false,
        newTerminal: false,
        terminalTab: false,
      });
    }

    const menuKeys: (keyof ExtensionMenusContribution & keyof CommandMenuEntry)[] = [
      "commandPalette",
      "contextMenu",
      "emptyPane",
      "newTerminal",
      "terminalTab",
    ];

    for (const menuKey of menuKeys) {
      for (const menuEntry of menus[menuKey]) {
        const entryList = index.get(menuEntry.command);
        if (entryList != null) {
          for (const entry of entryList) {
            entry[menuKey] = menuEntry.show;
          }
        } else {
          this._log.warn(`Extension '${this._extensionName}' has a menu contribution of type ` +
            `'${menuKey}' for unknown command '${menuEntry.command}'.`);
        }
      }
    }

    return index;
  }

  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => ExtensionApi.CustomizedCommand): void {
    if ( ! this._commandToMenuEntryMap.has(name)) {
      this._log.warn(`registerCommand() attempted on unknown command '${name}' from extension '${this._extensionName}'.`);
      return;
    }
    this._commandToFunctionMap.set(name, commandFunc);
    if (customizer != null) {
      this._commandToCustomizerFunctionMap.set(name, customizer);
    }
  }

  registerCommandContribution(commandContribution: ExtensionCommandContribution): ExtensionApi.Disposable {
    if ( ! this._commandToMenuEntryMap.has(commandContribution.command)) {
      this._commandToMenuEntryMap.set(commandContribution.command, []);
    }
    const newEntry = {
      commandContribution,
      commandPalette: true,
      contextMenu: false,
      emptyPane: false,
      newTerminal: false,
      terminalTab: false,
    };
    this._commandToMenuEntryMap.get(commandContribution.command).push(newEntry);
    return {
      dispose: (): void => {
        const entryList = this._commandToMenuEntryMap.get(commandContribution.command);
        const newEntryList = entryList.filter(entry => entry !== newEntry);
        if (newEntryList.length === 0) {
          this._commandToMenuEntryMap.delete(commandContribution.command);
        } else {
          this._commandToMenuEntryMap.set(commandContribution.command, newEntryList);
        }
      }
    };
  }

  getCommandFunction(name: string): (args: any) => any {
    return this._commandToFunctionMap.get(name);
  }

  getFunctionCustomizer(name: string): () => ExtensionApi.CustomizedCommand {
    return this._commandToCustomizerFunctionMap.get(name) || null;
  }

  executeCommand<T>(name: string, args: any): Promise<T> {
    return this._internalExtensionContext.extensionManager.executeCommand(name, args);
  }

  getCommands(): string[] {
    return [...this._commandToMenuEntryMap.keys()];
  }
}
