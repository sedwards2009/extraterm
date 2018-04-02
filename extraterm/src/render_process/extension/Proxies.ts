/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import {DisposableItemList} from '../../utils/DisposableUtils';
import {EtTerminal, EXTRATERM_COOKIE_ENV} from '../Terminal';
import {ExtensionUiUtils, InternalExtensionContext, InternalWorkspace, ProxyFactory} from './InternalTypes';
import {Logger, getLogger} from '../../logging/Logger';
import { ExtensionSessionEditorContribution } from '../../ExtensionMetadata';
import { ThemeableElementBase } from '../ThemeableElementBase';
import { WorkspaceCommandsRegistry } from './WorkspaceCommandsRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';


interface RegisteredSessionEditor {
  type: string;
  tag: string;
}


export class WorkspaceProxy implements InternalWorkspace {
  private _log: Logger = null;
  private _workspaceCommandsRegistry: WorkspaceCommandsRegistry = null;
  private _workspaceViewerRegistry: WorkspaceViewerRegistry = null;

  private _registeredSessionEditors: RegisteredSessionEditor[] = [];

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceProxy", this);
    this._workspaceCommandsRegistry = new WorkspaceCommandsRegistry();
    this._workspaceViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
    this.extensionSessionEditorBaseConstructor = ExtensionSessionEditorBaseImpl;    
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

  registerCommandsOnTerminal(
      commandLister: (terminal: ExtensionApi.Terminal) => ExtensionApi.CommandEntry[],
      commandExecutor: (terminal: ExtensionApi.Terminal, commandId: string, commandArguments?: object) => void
      ): ExtensionApi.Disposable {

    return this._workspaceCommandsRegistry.registerCommandsOnTerminal(commandLister, commandExecutor);
  }

  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): CommandPaletteRequestTypes.CommandEntry[] {
    return this._workspaceCommandsRegistry.getTerminalCommands(extensionName, terminal);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.CommandEntry[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {
      return this._workspaceCommandsRegistry.registerCommandsOnTextViewer(commandLister, commandExecutor);
  }

  getTextViewerCommands(extensionName: string, textViewer: ExtensionApi.TextViewer): CommandPaletteRequestTypes.CommandEntry[] {
    return this._workspaceCommandsRegistry.getTextViewerCommands(extensionName, textViewer);
  }

  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    this._workspaceViewerRegistry.registerViewer(name, viewerClass);
  }
   
  findViewerElementTagByMimeType(mimeType: string): string {
    return this._workspaceViewerRegistry.findViewerElementTagByMimeType(mimeType);
  }

  extensionSessionEditorBaseConstructor: ExtensionApi.ExtensionSessionEditorBaseConstructor;

  registerSessionEditor(type: string, sessionEditorClass: ExtensionApi.ExtensionSessionEditorBaseConstructor): void {
    let sessionEditorMetadata: ExtensionSessionEditorContribution = null;
    for (const semd of this._internalExtensionContext.extensionMetadata.contributions.sessionEditor) {
      if (semd.name === name) {
        sessionEditorMetadata = semd;
        break;
      }
    }

    if (sessionEditorMetadata == null) {
      this._log.warn(`Unable to register session editor '${name}' for extension ` +
        `'${this._internalExtensionContext.extensionMetadata.name}' because the session editor contribution data ` +
        `couldn't be found in the extension's package.json file.`);
      return;
    }

    const internalExtensionContext = this._internalExtensionContext;

    const sessionEditorProxyClass = class extends ExtensionSessionEditorProxy {
      protected _createExtensionSessionEditor(): ExtensionApi.ExtensionSessionEditorBase {
        return new sessionEditorClass(this);
      }

      protected _getExtensionContext(): InternalExtensionContext {
        return internalExtensionContext;
      }
    
      protected _getExtensionViewerContribution(): ExtensionSessionEditorContribution {
        return sessionEditorMetadata;
      }
    };
    
// FIXME
    const tag = this._internalExtensionContext.extensionMetadata.name + "-session-editor-" + kebabCase(name);
    this._log.info("Registering custom element ", tag);
    window.customElements.define(tag, sessionEditorProxyClass);

    this._registeredSessionEditors.push({
      type: sessionEditorMetadata.type, tag
    });
  }
  
}

function kebabCase(name: string): string {
  return name.split(/(?=[ABCDEFGHIJKLMNOPQRSTUVWXYZ])/g).map(s => s.toLowerCase()).join("-");
}


class ExtensionSessionEditorProxy extends ThemeableElementBase  {

}

class ExtensionSessionEditorBaseImpl implements ExtensionApi.ExtensionSessionEditorBase {
  created(): void {
  }

  getContainerElement(): HTMLElement {
    return null;  // FIXME implement
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
