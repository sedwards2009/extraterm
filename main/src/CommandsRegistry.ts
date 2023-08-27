/*
 * Copyright 2019-2023 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { Logger, getLogger, log } from 'extraterm-logging';
import { ExtensionCommandContribution, ExtensionMenusContribution } from "./extension/ExtensionMetadata.js";
import { ExtensionManager } from "./InternalTypes.js";
import { CommonExtensionWindowState } from './extension/CommonExtensionState.js';

export interface CommandMenuEntry {
  commandContribution: ExtensionCommandContribution;
  contextMenu: boolean;
  commandPalette: boolean;
  newTerminal: boolean;
  terminalTab: boolean;
  windowMenu: boolean;
}

export type CommandFunction = (state: CommonExtensionWindowState, args: any) => Promise<any>;

export class CommandsRegistry {

  private _log: Logger;
  #commandToFunctionMap = new Map<string, CommandFunction>();
  #commandToCustomizerFunctionMap = new Map<string, () => ExtensionApi.CustomizedCommand>();
  #commandToMenuEntryMap: Map<string, CommandMenuEntry[]> = null;
  #extensionManager: ExtensionManager;
  #extensionName: string;

  constructor(extensionManager: ExtensionManager, extensionName: string, commands: ExtensionCommandContribution[],
      menus: ExtensionMenusContribution) {

    this._log = getLogger("CommandsRegistry", this);
    this.#extensionManager = extensionManager;
    this.#extensionName = extensionName;
    this.#commandToMenuEntryMap = this.#buildCommandMenuIndex(commands, menus);
  }

  getCommandToMenuEntryMap(): Map<string, CommandMenuEntry[]> {
    return this.#commandToMenuEntryMap;
  }

  #buildCommandMenuIndex(commands: ExtensionCommandContribution[], menus: ExtensionMenusContribution): Map<string, CommandMenuEntry[]> {
    const index = new Map<string, CommandMenuEntry[]>();

    for (const commandContribution of commands) {

      if ( ! index.has(commandContribution.command)) {
        index.set(commandContribution.command, []);
      }

      index.get(commandContribution.command).push({
        commandContribution,
        commandPalette: true,
        contextMenu: false,
        newTerminal: false,
        terminalTab: false,
        windowMenu: false,
      });
    }

    const menuKeys: (keyof ExtensionMenusContribution & keyof CommandMenuEntry)[] = [
      "commandPalette",
      "contextMenu",
      "newTerminal",
      "terminalTab",
      "windowMenu",
    ];

    for (const menuKey of menuKeys) {
      for (const menuEntry of menus[menuKey]) {
        const entryList = index.get(menuEntry.command);
        if (entryList != null) {
          for (const entry of entryList) {
            entry[menuKey] = menuEntry.show;
          }
        } else {
          this._log.warn(`Extension '${this.#extensionName}' has a menu contribution of type ` +
            `'${menuKey}' for unknown command '${menuEntry.command}'.`);
        }
      }
    }

    return index;
  }

  registerCommand(name: string, commandFunc: CommandFunction, customizer?: () => ExtensionApi.CustomizedCommand): void {
    if ( ! this.#commandToMenuEntryMap.has(name)) {
      this._log.warn(`registerCommand() attempted on unknown command '${name}' from extension '${this.#extensionName}'.`);
      return;
    }
    this.#commandToFunctionMap.set(name, commandFunc);
    if (customizer != null) {
      this.#commandToCustomizerFunctionMap.set(name, customizer);
    }
  }

  registerCommandContribution(commandContribution: ExtensionCommandContribution): ExtensionApi.Disposable {
    if ( ! this.#commandToMenuEntryMap.has(commandContribution.command)) {
      this.#commandToMenuEntryMap.set(commandContribution.command, []);
    }
    const newEntry: CommandMenuEntry = {
      commandContribution,
      commandPalette: true,
      contextMenu: false,
      newTerminal: false,
      terminalTab: false,
      windowMenu: false,
    };
    this.#commandToMenuEntryMap.get(commandContribution.command).push(newEntry);
    return {
      dispose: (): void => {
        const entryList = this.#commandToMenuEntryMap.get(commandContribution.command);
        const newEntryList = entryList.filter(entry => entry !== newEntry);
        if (newEntryList.length === 0) {
          this.#commandToMenuEntryMap.delete(commandContribution.command);
        } else {
          this.#commandToMenuEntryMap.set(commandContribution.command, newEntryList);
        }
      }
    };
  }

  getCommandFunction(name: string): CommandFunction {
    return this.#commandToFunctionMap.get(name);
  }

  getFunctionCustomizer(name: string): () => ExtensionApi.CustomizedCommand {
    return this.#commandToCustomizerFunctionMap.get(name) || null;
  }

  executeCommand<T>(name: string, args: any): Promise<T> {
    return this.#extensionManager.executeCommand(name, args);
  }

  get commands(): string[] {
    return [...this.#commandToMenuEntryMap.keys()];
  }
}
