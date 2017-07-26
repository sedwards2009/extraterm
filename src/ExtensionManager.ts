/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import Logger from './Logger';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as ExtensionApi from 'extraterm-extension-api';

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
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "test/extensions" )]); //"../extensions"
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
        const extensionContextImpl = new ExtensionContextImpl(this);
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

}


interface EventListenerOwnerPair<E> {
  ownerExtensionContext: ExtensionContextImpl;
  listener: (e: E) => any;
}


class OwnerTrackingEventListenerList<E> {

  private _listeners: EventListenerOwnerPair<E>[] = [];

  add(ownerExtensionContext: ExtensionContextImpl, listener: (e: E) => any): ExtensionApi.Disposable {
    const pair = {ownerExtensionContext, listener};
    this._listeners.push(pair);
    return { dispose: () => this._remove(pair)};
  }

  private _remove(pair: EventListenerOwnerPair<E>): void {
    const index = this._listeners.indexOf(pair);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  removeAllByOwner(ownerExtensionContext: ExtensionContextImpl): void {
    this._listeners = this._listeners.filter(pair => pair.ownerExtensionContext !== ownerExtensionContext);
  }

  emit(e: E): void {
    this._listeners.forEach(pair => pair.listener(e));
  }
}


class ExtensionContextImpl implements ExtensionApi.ExtensionContext {

  workspace: WorkspaceImpl = null;

  constructor(private _extensionManager: ExtensionManager) {
    this.workspace = new WorkspaceImpl(_extensionManager, this);
  }
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
}


class TerminalImpl implements ExtensionApi.Terminal {

  write(text: string): void {

  }
}
