/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';

import { DisposableItemList } from '../../utils/DisposableUtils';
import { EtTerminal, EXTRATERM_COOKIE_ENV } from '../Terminal';
import { InternalExtensionContext, InternalWindow } from './InternalTypes';
import { Logger, getLogger } from "extraterm-logging";
import { WorkspaceSessionEditorRegistry, ExtensionSessionEditorBaseImpl } from './WorkspaceSessionEditorRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';
import { EtViewerTab } from '../ViewerTab';
import { CommonExtensionWindowState } from './CommonExtensionState';
import { WidgetProxy } from './WidgetProxy';
import { ExtensionTerminalBorderContribution } from '../../ExtensionMetadata';

export class WindowProxy implements InternalWindow {

  private _log: Logger = null;
  private _windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _windowViewerRegistry: WorkspaceViewerRegistry = null;
  private _terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();

  constructor(private _internalExtensionContext: InternalExtensionContext, private _commonExtensionState: CommonExtensionWindowState) {
    this._log = getLogger("WorkspaceProxy", this);
    this._windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._windowViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    this._terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();
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

  registerTerminalBorderWidget(name: string, factory: ExtensionApi.TerminalBorderWidgetFactory): void {
    const borderWidgetMeta = this._internalExtensionContext.extensionMetadata.contributes.terminalBorderWidget;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        this._terminalBorderWidgetFactoryMap.set(name, factory);
      }
    }

    this._internalExtensionContext.logger.warn(
      `Unknown terminal border widget '${name}' given to registerTerminalBorderWidget().`);
  }  

  getTerminalBorderWidgetFactory(name: string): ExtensionApi.TerminalBorderWidgetFactory {
    return this._terminalBorderWidgetFactoryMap.get(name);
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

  private _terminalBorderWidgets = new Map<string, {htmlWidgetProxy: WidgetProxy, factoryResult: unknown}>();

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

  openTerminalBorderWidget(name: string): any {
    if (this._terminalBorderWidgets.has(name)) {
      const { htmlWidgetProxy, factoryResult } = this._terminalBorderWidgets.get(name);
      const data = this._findTerminalBorderWidgetMetadata(name);
      this._terminal.appendElementToBorder(htmlWidgetProxy, data.border);
      return factoryResult;
    }

    const factory = this._internalExtensionContext.internalWindow.getTerminalBorderWidgetFactory(name);
    if (factory == null) {
      this._internalExtensionContext.logger.warn(
        `Unknown terminal border widget '${name}' given to createTerminalBorderWidget().`);  
      return null;
    }

    const data = this._findTerminalBorderWidgetMetadata(name);
    const htmlWidgetProxy = <WidgetProxy> document.createElement(WidgetProxy.TAG_NAME);
    htmlWidgetProxy._setExtensionContext(this._internalExtensionContext);
    htmlWidgetProxy._setExtensionCss(data.css);

    this._terminal.appendElementToBorder(htmlWidgetProxy, data.border);
    const extensionWidget = new TerminalBorderWidgetImpl(htmlWidgetProxy, () => {
      this._terminal.removeElementFromBorder(htmlWidgetProxy);
      this._terminal.focus();
    });
    const factoryResult = factory(this, extensionWidget);
    this._terminalBorderWidgets.set(name, { htmlWidgetProxy, factoryResult });
    return factoryResult;
  }

  private _findTerminalBorderWidgetMetadata(name: string): ExtensionTerminalBorderContribution {
    const borderWidgetMeta = this._internalExtensionContext.extensionMetadata.contributes.terminalBorderWidget;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        return data;
      }
    }
    return null;
  }
}

class TerminalBorderWidgetImpl implements ExtensionApi.TerminalBorderWidget {
  constructor(private _widgetProxy: WidgetProxy, private _close: () => void) {
  }

  getContainerElement(): HTMLElement {
    return this._widgetProxy.getContainerElement();
  }

  close(): void {
    this._close();
  }
}
