/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

 import * as ExtensionApi from 'extraterm-extension-api';
import { Logger, getLogger, log } from 'extraterm-logging';

export class CommandsRegistry implements ExtensionApi.Commands {

  private _log: Logger;

  constructor() {
    this._log = getLogger("CommandsRegistry", this);
  }

  @log
  registerCommand(name: string, commandFunc: (args: any) => any, customizer?: () => ExtensionApi.CustomizedCommand): void {
  }
  
  executeCommand<T>(name: string, args: any): Promise<T> {
    throw new Error("Method not implemented.");
  }

  getCommands(): string[] {
    throw new Error("Method not implemented.");
  }
}