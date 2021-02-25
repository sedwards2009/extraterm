/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { Logger, getLogger, log } from 'extraterm-logging';
import { ExtensionCommandContribution } from '../../ExtensionMetadata';


export class MainCommandsRegistry implements ExtensionApi.Commands {
  private _log: Logger;
  #commandToFunctionMap = new Map<string, (args: any) => any>();
  #extensionName: string = null;
  #commands: ExtensionCommandContribution[] = null;

  constructor(
  //     private _internalExtensionContext: InternalExtensionContext,
      extensionName: string,
      commands: ExtensionCommandContribution[]) {

    this.#extensionName = extensionName;
    this.#commands = commands;
    this._log = getLogger("CommandsRegistry", this);
  }

  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => ExtensionApi.CustomizedCommand): void {
    for (const commandContribution of this.#commands) {
      if (commandContribution.command === name) {
        this.#commandToFunctionMap.set(name, commandFunc);
        return;
      }
    }
    this._log.warn(`registerCommand() attempted on unknown command '${name}' from extension '${this.#extensionName}'.`);
    return;
  }

  // getCommandFunction(name: string): (args: any) => any {
  //   return this._commandToFunctionMap.get(name);
  // }

  // getFunctionCustomizer(name: string): () => ExtensionApi.CustomizedCommand {
  //   return this._commandToCustomizerFunctionMap.get(name) || null;
  // }

  executeCommand<T>(name: string, args: any): Promise<T> {
    return null;
    // return this._internalExtensionContext._extensionManager.executeCommand(name, args);
  }

  getCommandFunction(name: string): (args: any) => any {
    return this.#commandToFunctionMap.get(name);
  }

  get commands(): string[] {
    return [...this.#commandToFunctionMap.keys()];
  }
}
