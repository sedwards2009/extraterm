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
import {Logger, getLogger} from "extraterm-logging";
import { WorkspaceCommandsRegistry } from './WorkspaceCommandsRegistry';
import { WorkspaceSessionEditorRegistry, ExtensionSessionEditorBaseImpl } from './WorkspaceSessionEditorRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';
import { EtViewerTab } from '../ViewerTab';
import { BoundCommand } from '../CommandTypes';


export class WorkspaceProxy implements InternalWorkspace {
  private _log: Logger = null;
  private _workspaceCommandsRegistry: WorkspaceCommandsRegistry = null;
  private _workspaceSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _workspaceViewerRegistry: WorkspaceViewerRegistry = null;

  constructor(private _internalExtensionContext: InternalExtensionContext) {
    this._log = getLogger("WorkspaceProxy", this);
    this._workspaceCommandsRegistry = new WorkspaceCommandsRegistry();
    this._workspaceSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._workspaceViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    
    this.extensionSessionEditorBaseConstructor = ExtensionSessionEditorBaseImpl;    
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

  registerCommandsOnTerminal(
      commandLister: (terminal: ExtensionApi.Terminal) => ExtensionApi.Command[],
      commandExecutor: (terminal: ExtensionApi.Terminal, commandId: string, commandArguments?: object) => void
      ): ExtensionApi.Disposable {

    return this._workspaceCommandsRegistry.registerCommandsOnTerminal(commandLister, commandExecutor);
  }

  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): BoundCommand[] {
    return this._workspaceCommandsRegistry.getTerminalCommands(extensionName, terminal);
  }

  registerCommandsOnTextViewer(
      commandLister: (textViewer: ExtensionApi.TextViewer) => ExtensionApi.Command[],
      commandExecutor: (textViewer: ExtensionApi.TextViewer, commandId: string, commandArguments?: object) => void
    ): ExtensionApi.Disposable {
      return this._workspaceCommandsRegistry.registerCommandsOnTextViewer(commandLister, commandExecutor);
  }

  getTextViewerCommands(extensionName: string, textViewer: ExtensionApi.TextViewer): BoundCommand[] {
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
    this._workspaceSessionEditorRegistry.registerSessionEditor(type, sessionEditorClass);
  }

  getSessionEditorTagForType(sessionType: string): string {
    return this._workspaceSessionEditorRegistry.getSessionEditorTagForType(sessionType);
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

export class ViewerTabProxy implements ExtensionApi.Tab {
  constructor(private _internalExtensionContext: ProxyFactory, private _extensionUiUtils: ExtensionUiUtils,
    private _viewerTab: EtViewerTab) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return null;
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showNumberInput(this._viewerTab, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._extensionUiUtils.showListPicker(this._viewerTab, options);
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
