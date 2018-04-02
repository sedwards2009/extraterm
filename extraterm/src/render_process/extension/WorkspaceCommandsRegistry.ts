/**
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as ExtensionApi from 'extraterm-extension-api';
import * as _ from 'lodash';

import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {DisposableItemList} from '../../utils/DisposableUtils';


interface CommandRegistration<V> {
  commandLister: (viewer: V) => ExtensionApi.CommandEntry[];
  commandExecutor: (viewer: V, commandId: string, commandArguments?: object) => void;
}


export class WorkspaceCommandsRegistry {
  private _commandOnTerminalList = new DisposableItemList<CommandRegistration<ExtensionApi.Terminal>>();
  registerCommandsOnTerminal(
      commandLister: (terminal: ExtensionApi.Terminal) => ExtensionApi.CommandEntry[],
      commandExecutor: (terminal: ExtensionApi.Terminal, commandId: string, commandArguments?: object) => void
      ): ExtensionApi.Disposable {

    return this._commandOnTerminalList.add({commandLister, commandExecutor});
  }

  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(this._commandOnTerminalList.map((registration) => {
      const rawCommands = registration.commandLister(terminal);
          
      const target: CommandPaletteRequestTypes.CommandExecutor = {
        executeCommand(commandId: string, options?: object): void {
          const commandIdWithoutPrefix = commandId.slice(extensionName.length+1);
          registration.commandExecutor(terminal, commandIdWithoutPrefix, options);
        }
      };

      return this._formatCommands(rawCommands, target, extensionName);
    }));
  }

  private _formatCommands(
      rawCommands: ExtensionApi.CommandEntry[],
      commandExecutor: CommandPaletteRequestTypes.CommandExecutor,
      commandPrefix: string): CommandPaletteRequestTypes.CommandEntry[] {

    const commands: CommandPaletteRequestTypes.CommandEntry[] = [];
    for (const rawCommand of rawCommands) {
      commands.push({
        id: commandPrefix + '.' + rawCommand.id,
        group: rawCommand.group,
        iconLeft: rawCommand.iconLeft,
        iconRight: rawCommand.iconRight,
        label: rawCommand.label,
        shortcut: '',
        commandExecutor,
        commandArguments: rawCommand.commandArguments
      });
    }
    return commands;
  }

  private _commandOnTextViewerList = new DisposableItemList<CommandRegistration<ExtensionApi.TextViewer>>();
  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._commandOnTextViewerList.add({commandLister, commandExecutor});
  }

  getTextViewerCommands(extensionName: string, textViewer: ExtensionApi.TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(this._commandOnTextViewerList.map((registration) => {
      const rawCommands = registration.commandLister(textViewer);
          
      const target: CommandPaletteRequestTypes.CommandExecutor = {
        executeCommand(commandId: string, options?: object): void {
          const commandIdWithoutPrefix = commandId.slice(extensionName.length+1);
          registration.commandExecutor(textViewer, commandIdWithoutPrefix, options);
        }
      };

      return this._formatCommands(rawCommands, target, extensionName);
    }));
  }
}
