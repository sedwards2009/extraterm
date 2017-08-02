/*
 * Copyright 2017 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from 'path';
import * as _ from 'lodash';
import Logger from './Logger';
import * as DomUtils from './DomUtils';
import * as CodeMirror from 'codemirror';
import {ExtensionLoader, ExtensionMetadata} from './ExtensionLoader';
import * as CommandPaletteRequestTypes from './CommandPaletteRequestTypes';
import * as ExtensionApi from 'extraterm-extension-api';
import {EtTerminal} from './Terminal';
import {ViewerElement} from './ViewerElement';
import {TextViewer} from'./viewers/TextViewer';
import OwnerTrackingList from './utils/OwnerTrackingList';


interface ActiveExtension {
  extensionMetadata: ExtensionMetadata;
  extensionContextImpl: ExtensionContextImpl;
  extensionPublicApi: any;
}


export class ExtensionManager {

  private _log: Logger = null;

  private _extensionLoader: ExtensionLoader = null;

  private _activeExtensions: ActiveExtension[] = [];

  private _extensionBridge: ExtensionBridge = null;

  constructor() {
    this._log = new Logger("ExtensionManager", this);
    this._extensionLoader = new ExtensionLoader([path.join(__dirname, "../extensions" )]);
    this._extensionBridge = new ExtensionBridge();
  }

  startUp(): void {
    this._extensionLoader.scan();

    for (const extensionInfo of this._extensionLoader.getExtensions()) {
      this._startExtension(extensionInfo);
    }
  }

  getExtensionBridge(): ExtensionBridge {
    return this._extensionBridge;
  }

  private _startExtension(extensionMetadata: ExtensionMetadata): void {
    if (this._extensionLoader.load(extensionMetadata)) {
      try {
        const extensionContextImpl = this._extensionBridge.createExtensionSpecificContext(extensionMetadata);
        const extensionPublicApi = (<ExtensionApi.ExtensionModule> extensionMetadata.module).activate(extensionContextImpl);
        this._activeExtensions.push({extensionMetadata, extensionPublicApi, extensionContextImpl});
      } catch(ex) {
        this._log.warn(`Exception occurred while starting extensions ${extensionMetadata.name}. ${ex}`);
      }
    }
  }
}


export class ExtensionBridge {

  private _log: Logger = null;

  constructor() {
    this._log = new Logger("ExtensionBridge", this);
  }

  createExtensionSpecificContext(extensionMetadata: ExtensionMetadata): ExtensionContextImpl {
    return new ExtensionContextImpl(this, extensionMetadata);
  }

  workspaceGetTerminals(): EtTerminal[] {
return [];
  }

  workspaceOnDidCreateTerminal = new OwnerTrackingEventListenerList<ExtensionApi.Terminal>();

  workspaceRegisterCommandsOnTextViewer = new OwnerTrackingList<ExtensionContextImpl, CommandRegistration<ExtensionApi.TextViewer>>();

  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return _.flatten(this.workspaceRegisterCommandsOnTextViewer.mapWithOwner(
      (ownerExtensionContext, registration): CommandPaletteRequestTypes.CommandEntry[] => {
        const textViewerImpl = ownerExtensionContext.getTextViewerProxy(textViewer);
        const rawCommands = registration.commandLister(textViewerImpl);
        
        const target: CommandPaletteRequestTypes.CommandExecutor = {
          executeCommand(commandId: string, options?: object): void {
            const commandIdWithoutPrefix = commandId.slice(ownerExtensionContext.extensionMetadata.name.length+1);
            registration.commandExecutor(textViewerImpl, commandIdWithoutPrefix, options);
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


class OwnerTrackingEventListenerList<E> extends OwnerTrackingList<ExtensionContextImpl, (e: E) => any> {
  emit(e: E): void {
    this.forEach(thing => thing(e));
  }
}


class ExtensionContextImpl implements ExtensionApi.ExtensionContext {

  workspace: WorkspaceProxy = null;

  codeMirrorModule: typeof CodeMirror = CodeMirror;

  private _terminalProxyMap = new WeakMap<EtTerminal, ExtensionApi.Terminal>();
  
  private _textViewerProxyMap = new WeakMap<TextViewer, ExtensionApi.TextViewer>();

  constructor(public extensionBridge: ExtensionBridge, public extensionMetadata: ExtensionMetadata) {
    this.workspace = new WorkspaceProxy(this);
  }

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal {
    if ( ! this._terminalProxyMap.has(terminal)) {
      this._terminalProxyMap.set(terminal, new TerminalProxy(this, terminal));
    }
    return this._terminalProxyMap.get(terminal);
  }

  getTextViewerProxy(textViewer: TextViewer): ExtensionApi.TextViewer {
    if ( ! this._textViewerProxyMap.has(textViewer)) {
      this._textViewerProxyMap.set(textViewer, new TextViewerProxy(this, textViewer));
    }
    return this._textViewerProxyMap.get(textViewer);
  }
}


export interface CommandRegistration<V> {
  commandLister: (viewer: V) => ExtensionApi.CommandEntry[];
  commandExecutor: (viewer: V, commandId: string, commandArguments?: object) => void;
}


class WorkspaceProxy implements ExtensionApi.Workspace {

  constructor(private _extensionContextImpl: ExtensionContextImpl) {
  }

  getTerminals(): ExtensionApi.Terminal[] {
    return this._extensionContextImpl.extensionBridge.workspaceGetTerminals()
      .map(terminal => this._extensionContextImpl.getTerminalProxy(terminal));
  }

  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._extensionContextImpl.extensionBridge.workspaceOnDidCreateTerminal.add(this._extensionContextImpl, listener);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {

    return this._extensionContextImpl.extensionBridge.workspaceRegisterCommandsOnTextViewer.add(this._extensionContextImpl,
      {commandLister, commandExecutor});
  }
}


class TerminalProxy implements ExtensionApi.Terminal {

  constructor(private _extensionContextImpl: ExtensionContextImpl, private _terminal: EtTerminal) {
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
return null;
  }
}


class ViewerProxy implements ExtensionApi.Viewer {
  constructor(public _extensionContextImpl: ExtensionContextImpl, public _viewer: ViewerElement) {
  }

  getOwningTerminal(): ExtensionApi.Terminal {
    const path = DomUtils.nodePathToRoot(this._viewer);
    for (const node of path) {
      if (node instanceof EtTerminal) {
        return this._extensionContextImpl.getTerminalProxy(node);
      }
    }
    return null;
  }
}


class TextViewerProxy extends ViewerProxy implements ExtensionApi.TextViewer {
  constructor(_extensionContextImpl: ExtensionContextImpl, private _textViewer: TextViewer) {
    super(_extensionContextImpl, _textViewer);
  }
  
  getTabSize(): number {
    return this._textViewer.getTabSize();
  }

  setTabSize(size: number): void {
    this._textViewer.setTabSize(size);
  }
}
