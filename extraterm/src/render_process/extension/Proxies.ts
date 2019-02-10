/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import {DisposableItemList} from '../../utils/DisposableUtils';
import {EtTerminal, EXTRATERM_COOKIE_ENV} from '../Terminal';
import {ExtensionUiUtils, InternalExtensionContext, InternalWindow, ProxyFactory} from './InternalTypes';
import {Logger, getLogger} from "extraterm-logging";
import { WorkspaceSessionEditorRegistry, ExtensionSessionEditorBaseImpl } from './WorkspaceSessionEditorRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';
import { EtViewerTab } from '../ViewerTab';
import { CommonExtensionWindowState } from './CommonExtensionState';

export class WindowProxy implements InternalWindow {

  private _log: Logger = null;
  private _windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _windowViewerRegistry: WorkspaceViewerRegistry = null;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _commonExtensionState: CommonExtensionWindowState) {
    this._log = getLogger("WorkspaceProxy", this);
    this._windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._windowViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    
    this.extensionSessionEditorBaseConstructor = ExtensionSessionEditorBaseImpl;    
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  get activeTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.proxyFactory.getTerminalProxy(this._commonExtensionState.activeTerminal);
  }
  
  get activeViewer(): ExtensionApi.Viewer {
    return this._internalExtensionContext.proxyFactory.getViewerProxy(this._commonExtensionState.activeViewerElement);
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

  extensionViewerBaseConstructor: ExtensionApi.ExtensionViewerBaseConstructor;

  registerViewer(name: string, viewerClass: ExtensionApi.ExtensionViewerBaseConstructor): void {
    this._windowViewerRegistry.registerViewer(name, viewerClass);
  }
   
  findViewerElementTagByMimeType(mimeType: string): string {
    return this._windowViewerRegistry.findViewerElementTagByMimeType(mimeType);
  }

  extensionSessionEditorBaseConstructor: ExtensionApi.ExtensionSessionEditorBaseConstructor;

  registerSessionEditor(type: string, sessionEditorClass: ExtensionApi.ExtensionSessionEditorBaseConstructor): void {
    this._windowSessionEditorRegistry.registerSessionEditor(type, sessionEditorClass);
  }

  getSessionEditorTagForType(sessionType: string): string {
    return this._windowSessionEditorRegistry.getSessionEditorTagForType(sessionType);
  }
}


export class TerminalTabProxy implements ExtensionApi.Tab {

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return this._internalExtensionContext.proxyFactory.getTerminalProxy(this._terminal);
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showNumberInput(this._terminal, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showListPicker(this._terminal, options);
  }
}

export class ViewerTabProxy implements ExtensionApi.Tab {
  constructor(private _internalExtensionContext: InternalExtensionContext, private _viewerTab: EtViewerTab) {
  }

  getTerminal(): ExtensionApi.Terminal {
    return null;
  }

  showNumberInput(options: ExtensionApi.NumberInputOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showNumberInput(this._viewerTab, options);
  }

  showListPicker(options: ExtensionApi.ListPickerOptions): Promise<number | undefined> {
    return this._internalExtensionContext.extensionManager.extensionUiUtils.showListPicker(this._viewerTab, options);
  }
}

export class TerminalProxy implements ExtensionApi.Terminal {
  
  viewerType: 'terminal-output';

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
  }

  getTab(): ExtensionApi.Tab {
    return this._internalExtensionContext.proxyFactory.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._terminal.send(text);
  }

  getViewers(): ExtensionApi.Viewer[] {
    return this._terminal.getViewerElements().map(viewer => this._internalExtensionContext.proxyFactory.getViewerProxy(viewer));
  }

  getExtratermCookieValue(): string {
    return this._terminal.getExtratermCookieValue();
  }

  getExtratermCookieName(): string {
    return EXTRATERM_COOKIE_ENV;
  }

  createTerminalBorderWidget(name: string): ExtensionApi.TerminalBorderWidget {
    return null;
  }
}
