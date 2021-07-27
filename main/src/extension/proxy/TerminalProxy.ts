/*
 * Copyright 2020-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

import { Terminal, EXTRATERM_COOKIE_ENV } from "../../terminal/Terminal";
import { InternalExtensionContext } from "../../InternalTypes";
// import { ExtensionTerminalBorderContribution } from "../ExtensionMetadata";



export class TerminalProxy implements ExtensionApi.Terminal {
  private _log: Logger = null;
  viewerType: "terminal-output";
  private _terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  private _tabTitleWidgets = new Map<string, TabTitleWidgetInfo>(); // FIXME

  environment: TerminalEnvironmentProxy;
  screen: ExtensionApi.ScreenWithCursor;
  private _sessionConfiguration: ExtensionApi.SessionConfiguration = null;
  private _sessionConfigurationExtensions: Object = null;

  _onDidAppendBlockEventEmitter = new EventEmitter<ExtensionApi.Block>();
  onDidAppendBlock: ExtensionApi.Event<ExtensionApi.Block>;

  onDidAppendScrollbackLines: ExtensionApi.Event<ExtensionApi.LineRangeChange>;
  _onDidAppendScrollbackLinesEventEmitter = new EventEmitter<ExtensionApi.LineRangeChange>();

  onDidScreenChange: ExtensionApi.Event<ExtensionApi.LineRangeChange>;
  _onDidScreenChangeEventEmitter = new EventEmitter<ExtensionApi.LineRangeChange>();

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: Terminal) {
    this._log = getLogger("TerminalProxy", this);
    this._terminal.onDispose(this._handleTerminalDispose.bind(this));
    this.environment = new TerminalEnvironmentProxy(this._terminal);
    this.screen = new ScreenProxy(this._internalExtensionContext, this._terminal);
    this.onDidAppendBlock = this._onDidAppendBlockEventEmitter.event;
    this.onDidAppendScrollbackLines = this._onDidAppendScrollbackLinesEventEmitter.event;
    this.onDidScreenChange = this._onDidScreenChangeEventEmitter.event;

    this._sessionConfiguration = _.cloneDeep(this._terminal.getSessionConfiguration());
    this._sessionConfigurationExtensions = this._sessionConfiguration.extensions ?? {};
    this._sessionConfiguration.extensions = null;
  }

  showOnCursorListPicker(options: ExtensionApi.ListPickerOptions): Promise<number> {
    // this._checkIsAlive();
    // return this._internalExtensionContext._extensionManager.extensionUiUtils
    //   .showOnCursorListPicker(this._terminal, options);
    return null;
  }

  private _handleTerminalDispose(): void {
    this._terminal = null;
    this.environment.dispose();
  }

  private _checkIsAlive(): void {
    if ( ! this.isAlive) {
      throw new Error("Terminal is no longer alive and cannot be used.");
    }
  }

  get isAlive(): boolean {
    return this._terminal != null;
  }

  get tab(): ExtensionApi.Tab {
    // this._checkIsAlive();
    // return this._internalExtensionContext._proxyFactory.getTabProxy(this._terminal);
    return null;
  }

  type(text: string): void {
    this._checkIsAlive();
    this._terminal.sendToPty(text);
  }

  get blocks(): ExtensionApi.Block[] {
    // this._checkIsAlive();
    // return this._terminal.getViewerElements().map(
    //   viewer => this._internalExtensionContext._proxyFactory.getBlock(viewer));
    return [];
  }

  get extratermCookieValue(): string {
    this._checkIsAlive();
    return this._terminal.getExtratermCookieValue();
  }

  get extratermCookieName(): string {
    this._checkIsAlive();
    return EXTRATERM_COOKIE_ENV;
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this._sessionConfiguration;
  }

  getSessionSettings(name: string): Object {
    // const settingsKey = `${this._internalExtensionContext._extensionMetadata.name}:${name}`;
    // const settings = this._sessionConfigurationExtensions[settingsKey];
    // return settings == null ? null : settings;
    return null;
  }

  openTerminalBorderWidget(name: string): any {
/*
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
    });
    const factoryResult = factory(this, terminalBorderWidget);
    this._terminalBorderWidgets.set(name, { extensionContainerElement: extensionContainerElement, terminalBorderWidget,
      factoryResult });
    terminalBorderWidget._handleOpen();
    return factoryResult;
*/
  }

  // private _findTerminalBorderWidgetMetadata(name: string): ExtensionTerminalBorderContribution {
  //   const borderWidgetMeta = this._internalExtensionContext._extensionMetadata.contributes.terminalBorderWidgets;
  //   for (const data of borderWidgetMeta) {
  //     if (data.name === name) {
  //       return data;
  //     }
  //   }
  //   return null;
  // }

  async getWorkingDirectory(): Promise<string | null> {
    const pty = this._terminal.getPty();
    if (pty == null) {
      return null;
    }
    return pty.getWorkingDirectory();
  }
}

interface TerminalBorderWidgetInfo {
  // extensionContainerElement: ExtensionContainerElement;
  // terminalBorderWidget: InternalTerminalBorderWidget;
  factoryResult: unknown;
}

interface TabTitleWidgetInfo {
  // extensionContainerElement: ExtensionContainerElement;
  // tabTitleWidget: InternalTabTitleWidget;
  factoryResult: unknown;
}


class TerminalEnvironmentProxy implements ExtensionApi.TerminalEnvironment {
  onChange: ExtensionApi.Event<string[]>;
  _onChangeEventEmitter = new EventEmitter<string[]>();

  constructor(private _terminal: Terminal) {
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


class ScreenProxy implements ExtensionApi.ScreenWithCursor {

  constructor(private _internalExtensionContext: InternalExtensionContext, private _terminal: Terminal) {
  }

  getLineText(line: number): string {
    const str = this._terminal.getEmulator().getLineText(line);
    return str == null ? "" : str;
  }

  applyHyperlink(line: number, x: number, length: number, url: string): void {
    // const emulator = this._terminal.getEmulator();
    // const termLine = emulator.lineAtRow(line);
    // const startColumn = termLine.mapStringIndexToColumn(0, x);
    // const endColumn = termLine.mapStringIndexToColumn(0, x + length);
    // const extensionName = this._internalExtensionContext._extensionMetadata.name;
    // emulator.applyHyperlink(line, startColumn, endColumn - startColumn, url, extensionName);
  }

  removeHyperlinks(line: number): void {
    // const emulator = this._terminal.getEmulator();
    // const extensionName = this._internalExtensionContext._extensionMetadata.name;
    // emulator.removeHyperlinks(line, extensionName);
  }

  get width(): number {
    return this._terminal.getEmulator().size().columns;
  }

  get height(): number {
    return this._terminal.getEmulator().size().rows;
  }

  get cursorLine(): number {
    return this._terminal.getEmulator().getCursorRow();
  }

  get cursorX(): number {
    const cursorX = this._terminal.getEmulator().getDimensions().cursorX;
    return cursorX;
  }
}

/*
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

  get containerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
  }

  get isOpen(): boolean {
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
*/