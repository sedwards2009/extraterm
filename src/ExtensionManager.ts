/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import Logger from './Logger';
import {ExtensionLoader, ExtensionInfo} from './ExtensionLoader';
import * as ExtensionApi from './ExtensionApi/ExtensionContext';

interface ActiveExtension {
  extensionInfo: ExtensionInfo;
  extensionApi: any;
}


export class ExtensionManager {

  private _log: Logger = null;

  private _extensionLoader: ExtensionLoader = null;

  private _activeExtensions: ActiveExtension[] = [];

  private _extensionContext: ExtensionContextImpl = null;

  constructor() {
    this._log = new Logger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "test/extensions" )]); //"../extensions"
    this._extensionContext = new ExtensionContextImpl();
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      if (this._extensionLoader.load(extensionInfo)) {
        try {
          const extensionApi = (<ExtensionApi.ExtensionModule> extensionInfo.module).activate(this._extensionContext);
          this._activeExtensions.push({extensionInfo, extensionApi});
        } catch(ex) {
          this._log.warn(`Exception occurred while starting extensions ${extensionInfo.name}. ${ex}`);
        }
      }
    }
  }
}

class ExtensionContextImpl implements ExtensionApi.ExtensionContext {

  workspace: WorkspaceImpl = null;

  constructor() {
    this.workspace = new WorkspaceImpl();
  }
}

class WorkspaceImpl implements ExtensionApi.Workspace {

  private _terminals: TerminalImpl[] = [];

  getTerminals(): TerminalImpl[] {
    return this._terminals;
  }

  private _onDidCreateTerminal = new EventListenerList<ExtensionApi.Terminal>();

  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._onDidCreateTerminal.add(listener);
  }

}


class EventListenerList<E> {

  private _listeners: ((e: E) => any)[] = [];

  add(listener: (e: E) => any): ExtensionApi.Disposable {
    this._listeners.push(listener);
    return { dispose: () => this._remove(listener)};
  }

  private _remove(listener: (e: E) => any): void {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }

  emit(e: E): void {
    this._listeners.forEach(listener => listener(e));
  }
}

class TerminalImpl implements ExtensionApi.Terminal {

  write(text: string): void {

  }
}
