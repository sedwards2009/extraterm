/*
 * Copyright 2020-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import * as _ from "lodash";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

import { Terminal, EXTRATERM_COOKIE_ENV } from "../../terminal/Terminal";
import { InternalExtensionContext } from "../../InternalTypes";
import { ExtensionMetadata } from "../ExtensionMetadata";
// import { ExtensionTerminalBorderContribution } from "../ExtensionMetadata";


export class TerminalImpl implements ExtensionApi.Terminal {
  private _log: Logger = null;
  viewerType: "terminal-output";
  // private _terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  // private _tabTitleWidgets = new Map<string, TabTitleWidgetInfo>(); // FIXME

  environment: TerminalEnvironmentImpl;
  screen: ExtensionApi.ScreenWithCursor;
  #sessionConfiguration: ExtensionApi.SessionConfiguration = null;
  #sessionConfigurationExtensions: Object = null;

  #internalExtensionContext: InternalExtensionContext;
  #extensionMetadata: ExtensionMetadata;
  #terminal: Terminal;

  #onDidAppendBlockEventEmitter = new EventEmitter<ExtensionApi.Block>();
  onDidAppendBlock: ExtensionApi.Event<ExtensionApi.Block>;

  onDidAppendScrollbackLines: ExtensionApi.Event<ExtensionApi.LineRangeChange>;
  _onDidAppendScrollbackLinesEventEmitter = new EventEmitter<ExtensionApi.LineRangeChange>();

  onDidScreenChange: ExtensionApi.Event<ExtensionApi.LineRangeChange>;
  _onDidScreenChangeEventEmitter = new EventEmitter<ExtensionApi.LineRangeChange>();

  constructor(internalExtensionContext: InternalExtensionContext, extensionMetadata: ExtensionMetadata,
      terminal: Terminal) {

    this._log = getLogger("TerminalProxy", this);

    this.#terminal = terminal;
    this.#internalExtensionContext = internalExtensionContext;
    this.#extensionMetadata = extensionMetadata;

    this.#terminal.onDispose(this.#handleTerminalDispose.bind(this));
    this.environment = new TerminalEnvironmentImpl(this.#terminal);
    this.screen = new ScreenProxy(this.#extensionMetadata, this.#terminal);
    this.onDidAppendBlock = this.#onDidAppendBlockEventEmitter.event;
    this.onDidAppendScrollbackLines = this._onDidAppendScrollbackLinesEventEmitter.event;
    this.onDidScreenChange = this._onDidScreenChangeEventEmitter.event;

    this.#sessionConfiguration = _.cloneDeep(this.#terminal.getSessionConfiguration());
    this.#sessionConfigurationExtensions = this.#sessionConfiguration.extensions ?? {};
    this.#sessionConfiguration.extensions = null;
  }

  showOnCursorListPicker(options: ExtensionApi.ListPickerOptions): Promise<number> {
    // this._checkIsAlive();
    // return this._internalExtensionContext._extensionManager.extensionUiUtils
    //   .showOnCursorListPicker(this._terminal, options);
    return null;
  }

  #handleTerminalDispose(): void {
    this.#terminal = null;
    this.environment.dispose();
  }

  #checkIsAlive(): void {
    if ( ! this.isAlive) {
      throw new Error("Terminal is no longer alive and cannot be used.");
    }
  }

  get isAlive(): boolean {
    return this.#terminal != null;
  }

  get tab(): ExtensionApi.Tab {
    // this._checkIsAlive();
    // return this._internalExtensionContext._proxyFactory.getTabProxy(this._terminal);
    return null;
  }

  type(text: string): void {
    this.#checkIsAlive();
    this.#terminal.sendToPty(text);
  }

  get blocks(): ExtensionApi.Block[] {
    // this._checkIsAlive();
    // return this._terminal.getViewerElements().map(
    //   viewer => this._internalExtensionContext._proxyFactory.getBlock(viewer));
    return [];
  }

  get extratermCookieValue(): string {
    this.#checkIsAlive();
    return this.#terminal.getExtratermCookieValue();
  }

  get extratermCookieName(): string {
    this.#checkIsAlive();
    return EXTRATERM_COOKIE_ENV;
  }

  get sessionConfiguration(): ExtensionApi.SessionConfiguration {
    return this.#sessionConfiguration;
  }

  getSessionSettings(name: string): Object {
    const settingsKey = `${this.#extensionMetadata.name}:${name}`;
    const settings = this.#sessionConfigurationExtensions[settingsKey];
    return settings == null ? null : settings;
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
    const pty = this.#terminal.getPty();
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


class TerminalEnvironmentImpl implements ExtensionApi.TerminalEnvironment {
  onChange: ExtensionApi.Event<string[]>;
  _onChangeEventEmitter = new EventEmitter<string[]>();
  #terminal: Terminal;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;
    this.onChange = this._onChangeEventEmitter.event;
  }

  #checkIsAlive(): void {
    if (this.#terminal == null) {
      throw new Error("Terminal environment is no longer alive and cannot be used.");
    }
  }

  dispose(): void {
    this.#terminal = null;
    this._onChangeEventEmitter.dispose();
  }

  get(key: string): string {
    this.#checkIsAlive();
    return this.#terminal.environment.get(key);
  }

  has(key: string): boolean {
    this.#checkIsAlive();
    return this.#terminal.environment.has(key);
  }

  set(key: string, value: string): void {
    this.#checkIsAlive();
    this.#terminal.environment.set(key, value);
  }

  setList(list: {key: string, value: string}[]): void {
    this.#checkIsAlive();
    this.#terminal.environment.setList(list);
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    this.#checkIsAlive();
    return this.entries();
  }

  entries(): IterableIterator<[string, string]> {
    this.#checkIsAlive();
    return this.#terminal.environment.entries();
  }
}


class ScreenProxy implements ExtensionApi.ScreenWithCursor {
  #terminal: Terminal;
  #extensionMetadata: ExtensionMetadata;

  constructor(extensionMetadata: ExtensionMetadata,
      terminal: Terminal) {

    this.#terminal = terminal;
    this.#extensionMetadata = extensionMetadata;
  }

  getLineText(line: number): string {
    const str = this.#terminal.getEmulator().getLineText(line);
    return str == null ? "" : str;
  }

  applyHyperlink(line: number, x: number, length: number, url: string): void {
    const emulator = this.#terminal.getEmulator();
    const termLine = emulator.lineAtRow(line);
    const startColumn = termLine.mapStringIndexToColumn(0, x);
    const endColumn = termLine.mapStringIndexToColumn(0, x + length);
    const extensionName = this.#extensionMetadata.name;
    emulator.applyHyperlink(line, startColumn, endColumn - startColumn, url, extensionName);
  }

  removeHyperlinks(line: number): void {
    const emulator = this.#terminal.getEmulator();
    const extensionName = this.#extensionMetadata.name;
    emulator.removeHyperlinks(line, extensionName);
  }

  get width(): number {
    return this.#terminal.getEmulator().size().columns;
  }

  get height(): number {
    return this.#terminal.getEmulator().size().rows;
  }

  get cursorLine(): number {
    return this.#terminal.getEmulator().getCursorRow();
  }

  get cursorX(): number {
    const cursorX = this.#terminal.getEmulator().getDimensions().cursorX;
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