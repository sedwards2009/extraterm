/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import Logger from './Logger';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as CommandPaletteRequestTypes from './CommandPaletteRequestTypes';
import * as ExtensionApi from 'extraterm-extension-api';
import {TextViewer} from'./viewers/TextViewer';

interface ActiveExtension {
  extensionMetadata: ExtensionMetadata;
  extensionContextImpl: ExtensionContextImpl;
  extensionPublicApi: any;
}


export class ExtensionManager {

  private _log: Logger = null;

  private _extensionLoader: ExtensionLoader = null;

  private _activeExtensions: ActiveExtension[] = [];

  constructor() {
    this._log = new Logger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../extensions" )]);
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      this._startExtension(extensionInfo);
    }
  }

  private _startExtension(extensionMetadata: ExtensionMetadata): void {
    if (this._extensionLoader.load(extensionMetadata)) {
      try {
        const extensionContextImpl = new ExtensionContextImpl(this, extensionMetadata);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }

  workspaceGetTerminals(): TerminalImpl[] {
    return [];
  }

  workspaceOnDidCreateTerminal = new OwnerTrackingEventListenerList<ExtensionApi.Terminal>();

  workspaceRegisterCommandsOnTextViewer = new OwnerTrackingList<CommandRegistration<ExtensionApi.TextViewer>>();

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(this.workspaceRegisterCommandsOnTextViewer.mapWithOwner(
      (ownerExtensionContext, registration): CommandPaletteRequestTypes.CommandEntry[] => {
        const rawCommands = registration.commandLister(textViewer);
        
        const target: CommandPaletteRequestTypes.CommandExecutor = {
          executeCommand(commandId: string, options?: object): void {
            const commandIdWithoutPrefix = commandId.slice(ownerExtensionContext.extensionMetadata.name.length+1);
            registration.commandExecutor(textViewer, commandIdWithoutPrefix, options);
          }
        };
        
        const commands: CommandPaletteRequestTypes.CommandEntry[] = [];
        for (const rawCommand of rawCommands) {
          commands.push({
            id: ownerExtensionContext.extensionMetadata.name + '.' + rawCommand.id,
            group: rawCommand.group,
            iconLeft: rawCommand.iconLeft,
            iconRight: rawCommand.iconRight,
            label: rawCommand.label,
            shortcut: '',
            commandExecutor: target,
            commandArguments: rawCommand.commandArguments
          });
        }

        return commands;
      }));
  }
}


interface OwnerTrackedPair<T> {
  ownerExtensionContext: ExtensionContextImpl;
  thing: T;
}


export class OwnerTrackingList<T> {

  private _things: OwnerTrackedPair<T>[] = [];

  add(ownerExtensionContext: ExtensionContextImpl, thing: T): ExtensionApi.Disposable {
    const pair = {ownerExtensionContext, thing};
    this._things.push(pair);
    return { dispose: () => this._remove(pair)};
  }

  private _remove(pair: OwnerTrackedPair<T>): void {
    const index = this._things.indexOf(pair);
    if (index !== -1) {
      this._things.splice(index, 1);
    }
  }

  removeAllByOwner(ownerExtensionContext: ExtensionContextImpl): void {
    this._things = this._things.filter(pair => pair.ownerExtensionContext !== ownerExtensionContext);
  }

  forEach(func: (t: T) => void): void {
    this._things.forEach(pair => func(pair.thing));
  }

  map<R>(func: (t: T) => R): R[] {
    return this._things.map<R>(pair => func(pair.thing));
  }

  mapWithOwner<R>(func: (owner: ExtensionContextImpl, t: T) => R): R[] {
    return this._things.map<R>(pair => func(pair.ownerExtensionContext, pair.thing));
  }
}


class OwnerTrackingEventListenerList<E> extends OwnerTrackingList<(e: E) => any> {
  emit(e: E): void {
    this.forEach(thing => thing(e));
  }
}


class ExtensionContextImpl implements ExtensionApi.ExtensionContext {

  workspace: WorkspaceImpl = null;

  constructor(private _extensionManager: ExtensionManager, public extensionMetadata: ExtensionMetadata) {
    this.workspace = new WorkspaceImpl(_extensionManager, this);
  }
}


export interface CommandRegistration<V> {
  commandLister: (viewer: V) => ExtensionApi.CommandEntry[];
  commandExecutor: (viewer: V, commandId: string, commandArguments?: object) => void;
}


class WorkspaceImpl implements ExtensionApi.Workspace {

  constructor(private _extensionManager: ExtensionManager, private _extensionContextImpl: ExtensionContextImpl) {
  }

  getTerminals(): TerminalImpl[] {
    return this._extensionManager.workspaceGetTerminals();
  }

  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._extensionManager.workspaceOnDidCreateTerminal.add(this._extensionContextImpl, listener);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._extensionManager.workspaceRegisterCommandsOnTextViewer.add(this._extensionContextImpl,
      {commandLister, commandExecutor});
  }
}


class TerminalImpl implements ExtensionApi.Terminal {

  write(text: string): void {

  }
}
