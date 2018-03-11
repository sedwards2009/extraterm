/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';
import * as _ from 'lodash';

import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {DisposableItemList} from '../../utils/DisposableUtils';
import {EtTerminal, EXTRATERM_COOKIE_ENV} from '../Terminal';
import {ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalTypes';
import {Logger, getLogger} from '../../logging/Logger';
import { SimpleViewerElement } from '../viewers/SimpleViewerElement';
import { ViewerElement } from '../viewers/ViewerElement';
import { ExtensionViewerContribution } from '../../ExtensionMetadata';


interface RegisteredViewer {
  tag: string;
  mimeTypes: string[];
}

interface CommandRegistration<V> {
  commandLister: (viewer: V) => ExtensionApi.CommandEntry[];
  commandExecutor: (viewer: V, commandId: string, commandArguments?: object) => void;
}

export class WorkspaceProxy implements InternalWorkspace {
  private _log: Logger = null;
  private _registeredViewers: RegisteredViewer[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceProxy", this);
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  getTerminals(): ExtensionApi.Terminal[] {
    return []; // FIXME
    // return this._internalExtensionContext.extensionBridge.workspaceGetTerminals()
    //   .map(terminal => this._internalExtensionContext.getTerminalProxy(terminal));
  }

  private _onDidCreateTerminalListenerList = new DisposableItemList<(e: ExtensionApi.Terminal) => any>();
  onDidCreateTerminal(listener: (e: ExtensionApi.Terminal) => any): ExtensionApi.Disposable {
    return this._onDidCreateTerminalListenerList.add(listener);
  }

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

  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    let viewerMetadata: ExtensionViewerContribution = null;
    for (const vmd of this._internalExtensionContext.extensionMetadata.contributions.viewer) {
      if (vmd.name === name) {
        viewerMetadata = vmd;
        break;
      }
    }

    if (viewerMetadata == null) {
      this._log.warn(`Unable to register viewer '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the viewer contribution data couldn't ` +
        `be found in the extension's package.json file.`);
      return;
    }

    const viewerElementProxyClass = class extends ExtensionViewerProxy {
      protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
        return new viewerClass(this);
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, viewerElementProxyClass);

    this._registeredViewers.push({
      mimeTypes: viewerMetadata.mimeTypes, tag
    });
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (const registeredViewer of this._registeredViewers) {
      if (registeredViewer.mimeTypes.indexOf(mimeType) !== -1) {
        return registeredViewer.tag;
      }
    }
    return null;
  }
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionViewerProxy extends SimpleViewerElement {
  private _extensionViewer: ExtensionApi.ExtensionViewerBase = null;

  constructor() {
    super();
    this._extensionViewer = this._createExtensionViewer();
    this._extensionViewer.created();
  }

  protected _createExtensionViewer(): ExtensionApi.ExtensionViewerBase {
    return null;
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this._extensionViewer.getMetadata();
  }
  
  _metadataUpdated(): void {
    const event = new CustomEvent(ViewerElement.EVENT_METADATA_CHANGE, { bubbles: true });
    this.dispatchEvent(event);
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return this._extensionViewer.getBulkFileHandle();
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): void {
    this._extensionViewer.setBulkFileHandle(handle);
  }
}


class ExtensionViewerBaseImpl implements ExtensionApi.ExtensionViewerBase {

  private __ExtensionViewerBaseImpl_metadata: ExtensionApi.ViewerMetadata = null;

  constructor(private _viewerProxy: ExtensionViewerProxy, ..._: any[]) {
    this.__ExtensionViewerBaseImpl_metadata = {
      title: "ExtensionViewer",
      deleteable: true,
      moveable: true,
      icon: null,
      posture: ExtensionApi.ViewerPosture.NEUTRAL,
      toolTip: null
    };
  }

  created(): void {
  }

  getContainerElement(): HTMLElement {
    return this._viewerProxy.getContainerNode();
  }

  getMetadata(): ExtensionApi.ViewerMetadata {
    return this.__ExtensionViewerBaseImpl_metadata;
  }
  
  updateMetadata(changes: ExtensionApi.ViewerMetadataChange): void {
    let changed = false;
    for (const key of Object.getOwnPropertyNames(changes)) {
      if (this.__ExtensionViewerBaseImpl_metadata[key] !== changes[key]) {
        this.__ExtensionViewerBaseImpl_metadata[key] = changes[key];
        changed = true;
      }
    }

    if (changed) {
      this._viewerProxy._metadataUpdated();
    }
  }

  getBulkFileHandle(): ExtensionApi.BulkFileHandle {
    return null;
  }

  setBulkFileHandle(handle: ExtensionApi.BulkFileHandle): void {
  }
}

export class TerminalTabProxy implements ExtensionApi.Tab {

  constructor(private _internalExtensionContext: ProxyFactory, private _extensionUiUtils: ExtensionUiUtils,
    private _terminal: EtTerminal) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showListPicker(this._terminal, options);
  }
}


export class TerminalProxy implements ExtensionApi.Terminal {
  
  viewerType: 'terminal-output';

  constructor(private _proxyFactory: ProxyFactory, private _terminal: EtTerminal) {
  }

  getTab(): ExtensionApi.Tab {
    return this._proxyFactory.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  getViewers(): ExtensionApi.Viewer[] {
    return this._terminal.getViewerElements().map(viewer => this._proxyFactory.getViewerProxy(viewer));
  }

  getExtratermCookieValue(): string {
    return this._terminal.getExtratermCookieValue();
  }

  getExtratermCookieName(): string{
    return EXTRATERM_COOKIE_ENV;
  }
}
