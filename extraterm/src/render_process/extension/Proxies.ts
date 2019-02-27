/*
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from 'extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';

import { EtTerminal, EXTRATERM_COOKIE_ENV } from '../Terminal';
import { InternalExtensionContext, InternalWindow, InternalTerminalBorderWidget } from './InternalTypes';
import { Logger, getLogger, log } from "extraterm-logging";
import { WorkspaceSessionEditorRegistry, ExtensionSessionEditorBaseImpl } from './WorkspaceSessionEditorRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';
import { EtViewerTab } from '../ViewerTab';
import { CommonExtensionWindowState } from './CommonExtensionState';
import { WidgetProxy } from './WidgetProxy';
import { ExtensionTerminalBorderContribution } from '../../ExtensionMetadata';
import { Viewer } from 'extraterm-extension-api';
import { ViewerElement } from '../viewers/ViewerElement';

export class WindowProxy implements InternalWindow {

  private _log: Logger = null;
  private _windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _windowViewerRegistry: WorkspaceViewerRegistry = null;
  private _terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();

  private _onDidCreateTerminalEventEmitter = new EventEmitter<ExtensionApi.Terminal>();
  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _commonExtensionState: CommonExtensionWindowState) {
    this._log = getLogger("WorkspaceProxy", this);
    this.onDidCreateTerminal = this._onDidCreateTerminalEventEmitter.event;
    this._windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._windowViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
    this._terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();
    this.extensionSessionEditorBaseConstructor = ExtensionSessionEditorBaseImpl;    
    this.extensionViewerBaseConstructor = ExtensionViewerBaseImpl;
  }

  newTerminalCreated(newTerminal): void {
    if (this._onDidCreateTerminalEventEmitter.hasListeners()) {
      const terminal = this._internalExtensionContext.proxyFactory.getTerminalProxy(newTerminal);
      this._onDidCreateTerminalEventEmitter.fire(terminal);
    }
  }

  terminalAppendedViewer(terminal: EtTerminal, viewer: ViewerElement): void {
    if (this._internalExtensionContext.proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this._internalExtensionContext.proxyFactory.getTerminalProxy(terminal);
      if (proxy._onDidAppendViewerEventEmitter.hasListeners()) {
        proxy._onDidAppendViewerEventEmitter.fire(this._internalExtensionContext.proxyFactory.getViewerProxy(viewer));
      }
    }
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
        return;
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

interface TerminalBorderWidgetInfo {
  htmlWidgetProxy: WidgetProxy;
  terminalBorderWidget: InternalTerminalBorderWidget;
  factoryResult: unknown;
}

export class TerminalProxy implements ExtensionApi.Terminal {
  
  viewerType: 'terminal-output';

  private _terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  _onDidAppendViewerEventEmitter = new EventEmitter<Viewer>();
  onDidAppendViewer: ExtensionApi.Event<Viewer>;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
    this.onDidAppendViewer = this._onDidAppendViewerEventEmitter.event;
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
      const { htmlWidgetProxy, terminalBorderWidget, factoryResult } = this._terminalBorderWidgets.get(name);
      const data = this._findTerminalBorderWidgetMetadata(name);
      this._terminal.appendElementToBorder(htmlWidgetProxy, data.border);
      terminalBorderWidget._handleOpen();
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
    const terminalBorderWidget = new TerminalBorderWidgetImpl(htmlWidgetProxy, () => {
      this._terminal.removeElementFromBorder(htmlWidgetProxy);
      terminalBorderWidget._handleClose();
      this._terminal.focus();
    });
    const factoryResult = factory(this, terminalBorderWidget);
    this._terminalBorderWidgets.set(name, { htmlWidgetProxy, terminalBorderWidget, factoryResult });
    terminalBorderWidget._handleOpen();
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

class TerminalBorderWidgetImpl implements InternalTerminalBorderWidget {
  
  private _open = false;
  private _onDidOpenEventEmitter = new EventEmitter<void>();
  onDidOpen: ExtensionApi.Event<void>;
  private _onDidCloseEventEmitter = new EventEmitter<void>();
  onDidClose: ExtensionApi.Event<void>;

  constructor(private _widgetProxy: WidgetProxy, private _close: () => void) {
    this.onDidOpen = this._onDidOpenEventEmitter.event;
    this.onDidClose = this._onDidCloseEventEmitter.event;
  }

  getContainerElement(): HTMLElement {
    return this._widgetProxy.getContainerElement();
  }

  isOpen(): boolean {
    return this._open;
  }

  _handleOpen(): void {
    this._open = true;
    this._onDidOpenEventEmitter.fire(undefined);
  }

  _handleClose(): void {
    this._open = false;
    this._onDidCloseEventEmitter.fire(undefined);
  }

  close(): void {
    this._close();
  }
}
