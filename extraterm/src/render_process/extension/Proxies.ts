/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';

import { EtTerminal, EXTRATERM_COOKIE_ENV } from '../Terminal';
import { InternalExtensionContext, InternalWindow, InternalTerminalBorderWidget, InternalTabTitleWidget, InternalSessionSettingsEditor } from './InternalTypes';
import { Logger, getLogger, log } from "extraterm-logging";
import { WorkspaceSessionEditorRegistry, ExtensionSessionEditorBaseImpl } from './WorkspaceSessionEditorRegistry';
import { WorkspaceViewerRegistry, ExtensionViewerBaseImpl } from './WorkspaceViewerRegistry';
import { EtViewerTab } from '../ViewerTab';
import { CommonExtensionWindowState } from './CommonExtensionState';
import { ExtensionContainerElement } from './ExtensionContainerElement';
import { ExtensionTerminalBorderContribution } from '../../ExtensionMetadata';
import { Viewer, SessionSettingsEditorFactory, SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { ViewerElement } from '../viewers/ViewerElement';
import { WorkspaceSessionSettingsRegistry } from './WorkspaceSessionSettingsRegistry';

/**
 * The implementation behind the `Window` object on the `ExtensionContext`
 * which is given to extensions when loading them.
 *
 * Each extension gets its own instance of this.
 */
export class WindowProxy implements InternalWindow {

  private _log: Logger = null;

  private _windowSessionEditorRegistry: WorkspaceSessionEditorRegistry = null;
  private _windowSessionSettingsRegistry: WorkspaceSessionSettingsRegistry = null;
  private _windowViewerRegistry: WorkspaceViewerRegistry = null;
  private _terminalBorderWidgetFactoryMap = new Map<string, ExtensionApi.TerminalBorderWidgetFactory>();

  private _onDidCreateTerminalEventEmitter = new EventEmitter<ExtensionApi.Terminal>();
  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _commonExtensionState: CommonExtensionWindowState) {
    this._log = getLogger("WorkspaceProxy", this);
    this.onDidCreateTerminal = this._onDidCreateTerminalEventEmitter.event;
    this._windowSessionEditorRegistry = new WorkspaceSessionEditorRegistry(this._internalExtensionContext);
    this._windowSessionSettingsRegistry = new WorkspaceSessionSettingsRegistry(this._internalExtensionContext);
    this._windowViewerRegistry = new WorkspaceViewerRegistry(this._internalExtensionContext);
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

  terminalEnvironmentChanged(terminal: EtTerminal, changeList: string[]): void {
    if (this._internalExtensionContext.proxyFactory.hasTerminalProxy(terminal)) {
      const proxy = <TerminalProxy> this._internalExtensionContext.proxyFactory.getTerminalProxy(terminal);
      if (proxy.environment._onChangeEventEmitter.hasListeners()) {
        proxy.environment._onChangeEventEmitter.fire(changeList);
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

  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    this._internalExtensionContext.registerTabTitleWidget(name, factory);
  }

  registerTerminalBorderWidget(name: string, factory: ExtensionApi.TerminalBorderWidgetFactory): void {
    const borderWidgetMeta = this._internalExtensionContext.extensionMetadata.contributes.terminalBorderWidgets;
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

  registerSessionSettingsEditor(name: string, factory: SessionSettingsEditorFactory): void {
    this._windowSessionSettingsRegistry.registerSessionSettingsEditor(name, factory);
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[] {

    return this._windowSessionSettingsRegistry.createSessionSettingsEditors(sessionType, sessionConfiguration);
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
  extensionContainerElement: ExtensionContainerElement;
  terminalBorderWidget: InternalTerminalBorderWidget;
  factoryResult: unknown;
}

interface TabTitleWidgetInfo {
  extensionContainerElement: ExtensionContainerElement;
  tabTitleWidget: InternalTabTitleWidget;
  factoryResult: unknown;
}

class ProxyTerminalEnvironment implements ExtensionApi.TerminalEnvironment {
  onChange: ExtensionApi.Event<string[]>;
  _onChangeEventEmitter = new EventEmitter<string[]>();

  constructor(private _terminal: EtTerminal) {
    this.onChange = this._onChangeEventEmitter.event;
  }

  get(key: string): string {
    return this._terminal.environment.get(key);
  }

  has(key: string): boolean {
    return this._terminal.environment.has(key);
  }

  set(key: string, value: string): void {
    this._terminal.environment.set(key, value);
  }

  setList(list: {key: string, value: string}[]): void {
    this._terminal.environment.setList(list);
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  entries(): IterableIterator<[string, string]> {
    return this._terminal.environment.entries();
  }
}

export class TerminalProxy implements ExtensionApi.Terminal {

  viewerType: 'terminal-output';

  private _terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  private _tabTitleWidgets = new Map<string, TabTitleWidgetInfo>(); // FIXME
  _onDidAppendViewerEventEmitter = new EventEmitter<Viewer>();
  onDidAppendViewer: ExtensionApi.Event<Viewer>;

  environment: ProxyTerminalEnvironment;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
    this.onDidAppendViewer = this._onDidAppendViewerEventEmitter.event;
    this.environment = new ProxyTerminalEnvironment(this._terminal);
  }

  getTab(): ExtensionApi.Tab {
    return this._internalExtensionContext.proxyFactory.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._terminal.sendToPty(text);
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
      const { extensionContainerElement, terminalBorderWidget, factoryResult } = this._terminalBorderWidgets.get(name);
      const data = this._findTerminalBorderWidgetMetadata(name);
      this._terminal.appendElementToBorder(extensionContainerElement, data.border);
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
    const extensionContainerElement = <ExtensionContainerElement> document.createElement(ExtensionContainerElement.TAG_NAME);
    extensionContainerElement._setExtensionContext(this._internalExtensionContext);
    extensionContainerElement._setExtensionCss(data.css);

    this._terminal.appendElementToBorder(extensionContainerElement, data.border);
    const terminalBorderWidget = new TerminalBorderWidgetImpl(extensionContainerElement, () => {
      this._terminal.removeElementFromBorder(extensionContainerElement);
      terminalBorderWidget._handleClose();
      this._terminal.focus();
    });
    const factoryResult = factory(this, terminalBorderWidget);
    this._terminalBorderWidgets.set(name, { extensionContainerElement: extensionContainerElement, terminalBorderWidget, factoryResult });
    terminalBorderWidget._handleOpen();
    return factoryResult;
  }

  private _findTerminalBorderWidgetMetadata(name: string): ExtensionTerminalBorderContribution {
    const borderWidgetMeta = this._internalExtensionContext.extensionMetadata.contributes.terminalBorderWidgets;
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

  constructor(private _extensionContainerElement: ExtensionContainerElement, private _close: () => void) {
    this.onDidOpen = this._onDidOpenEventEmitter.event;
    this.onDidClose = this._onDidCloseEventEmitter.event;
  }

  getContainerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
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
