/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';
import { Logger, getLogger, log } from 'extraterm-logging';
import { ExtensionCommandContribution } from '../../ExtensionMetadata';
import { ExtensionManager } from './InternalTypes';

export class CommandsRegistry implements ExtensionApi.Commands {

  private _log: Logger;
  private _commandToFunctionMap = new Map<string, (args: any) => any>();
  private _commandToCustomizerFunctionMap = new Map<string, () => ExtensionApi.CustomizedCommand>();
  private _knownCommands = new Set<string>();

  constructor(private _extensionManager: ExtensionManager, private _extensionName: string, commands: ExtensionCommandContribution[]) {
    this._log = getLogger("CommandsRegistry", this);

    for (const command of commands) {
      this._knownCommands.add(command.command);
    }
  }

  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => ExtensionApi.CustomizedCommand): void {
    if ( ! this._knownCommands.has(name)) {
      this._log.warn(`registerCommand() attempted on unknown command '${name}' from extension '${this._extensionName}'.`);
      return;
    }
    this._commandToFunctionMap.set(name, commandFunc);
    if (customizer != null) {
      this._commandToCustomizerFunctionMap.set(name, customizer);
    }
  }

  getCommandFunction(name: string): (args: any) => any {
    return this._commandToFunctionMap.get(name);
  }

  getFunctionCustomizer(name: string): () => ExtensionApi.CustomizedCommand {
    return this._commandToCustomizerFunctionMap.get(name) || null;
  }

  executeCommand<T>(name: string, args: any): Promise<T> {
    return this._extensionManager.executeCommand(name, args);
  }

  getCommands(): string[] {
    return [...this._knownCommands];
  }
}