/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

import { EtTerminal, EXTRATERM_COOKIE_ENV } from "../../Terminal";
import { InternalExtensionContext, InternalTerminalBorderWidget, InternalTabTitleWidget } from "../InternalTypes";
import { ExtensionContainerElement } from "../ExtensionContainerElement";
import { ExtensionTerminalBorderContribution } from "../../../ExtensionMetadata";


export class TerminalProxy implements ExtensionApi.Terminal {
  private _log: Logger = null;
  viewerType: "terminal-output";
  private _terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  private _tabTitleWidgets = new Map<string, TabTitleWidgetInfo>(); // FIXME

  environment: TerminalEnvironmentProxy;
  private _sessionConfiguration: ExtensionApi.SessionConfiguration = null;
  private _sessionConfigurationExtensions: Object = null;

  _onDidAppendBlockEventEmitter = new EventEmitter<ExtensionApi.Block>();
  onDidAppendBlock: ExtensionApi.Event<ExtensionApi.Block>;

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: EtTerminal) {
    this._log = getLogger("TerminalProxy", this);
    this._terminal.onDispose(this._handleTerminalDispose.bind(this));
    this.environment = new TerminalEnvironmentProxy(this._terminal);
    this.onDidAppendBlock = this._onDidAppendBlockEventEmitter.event;

    this._sessionConfiguration = _.cloneDeep(this._terminal.getSessionConfiguration());
    this._sessionConfigurationExtensions = this._sessionConfiguration.extensions ?? {};
    this._sessionConfiguration.extensions = null;
  }

  private _handleTerminalDispose(): void {
    this._terminal = null;
    this.environment.dispose();
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive()) {
      throw new Error("Terminal is no longer alive and cannot be used.");
    }
  }

  isAlive(): boolean {
    return this._terminal != null;
  }

  getTab(): ExtensionApi.Tab {
    this._checkIsAlive();
    return this._internalExtensionContext._proxyFactory.getTabProxy(this._terminal);
  }

  type(text: string): void {
    this._checkIsAlive();
    this._terminal.sendToPty(text);
  }

  getBlocks(): ExtensionApi.Block[] {
    this._checkIsAlive();
    return this._terminal.getViewerElements().map(
      viewer => this._internalExtensionContext._proxyFactory.getBlock(viewer));
  }

  getExtratermCookieValue(): string {
    this._checkIsAlive();
    return this._terminal.getExtratermCookieValue();
  }

  getExtratermCookieName(): string {
    this._checkIsAlive();
    return EXTRATERM_COOKIE_ENV;
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this._sessionConfiguration;
  }

  getSessionSettings(name: string): Object {
    const settingsKey = `${this._internalExtensionContext._extensionMetadata.name}:${name}`;
    const settings = this._sessionConfigurationExtensions[settingsKey];
    return settings == null ? null : settings;
  }

  openTerminalBorderWidget(name: string): any {
    this._checkIsAlive();
    if (this._terminalBorderWidgets.has(name)) {
      const { extensionContainerElement, terminalBorderWidget, factoryResult } = this._terminalBorderWidgets.get(name);
      const data = this._findTerminalBorderWidgetMetadata(name);
      this._terminal.appendElementToBorder(extensionContainerElement, data.border);
      terminalBorderWidget._handleOpen();
      return factoryResult;
    }

    const factory = this._internalExtensionContext._internalWindow.getTerminalBorderWidgetFactory(name);
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
    this._terminalBorderWidgets.set(name, { extensionContainerElement: extensionContainerElement, terminalBorderWidget,
      factoryResult });
    terminalBorderWidget._handleOpen();
    return factoryResult;
  }

  private _findTerminalBorderWidgetMetadata(name: string): ExtensionTerminalBorderContribution {
    const borderWidgetMeta = this._internalExtensionContext._extensionMetadata.contributes.terminalBorderWidgets;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        return data;
      }
    }
    return null;
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

class TerminalEnvironmentProxy implements ExtensionApi.TerminalEnvironment {
  onChange: ExtensionApi.Event<string[]>;
  _onChangeEventEmitter = new EventEmitter<string[]>();

  constructor(private _terminal: EtTerminal) {
    this.onChange = this._onChangeEventEmitter.event;
  }

  private _checkIsAlive(): void {
    if (this._terminal == null) {
      throw new Error("Terminal environment is no longer alive and cannot be used.");
    }
  }

  dispose(): void {
    this._terminal = null;
    this._onChangeEventEmitter.dispose();
  }

  get(key: string): string {
    this._checkIsAlive();
    return this._terminal.environment.get(key);
  }

  has(key: string): boolean {
    this._checkIsAlive();
    return this._terminal.environment.has(key);
  }

  set(key: string, value: string): void {
    this._checkIsAlive();
    this._terminal.environment.set(key, value);
  }

  setList(list: {key: string, value: string}[]): void {
    this._checkIsAlive();
    this._terminal.environment.setList(list);
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    this._checkIsAlive();
    return this.entries();
  }

  entries(): IterableIterator<[string, string]> {
    this._checkIsAlive();
    return this._terminal.environment.entries();
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
