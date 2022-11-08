/*
 * Copyright 2020-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

import { QWidget } from "@nodegui/nodegui";
import * as _ from "lodash-es";

import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { log, Logger, getLogger } from "extraterm-logging";

import { Terminal, EXTRATERM_COOKIE_ENV } from "../../terminal/Terminal.js";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { BorderDirection, ExtensionMetadata, ExtensionTerminalBorderContribution } from "../ExtensionMetadata.js";
import { LineImpl } from "term-api-lineimpl";
import { Layer } from "packages/term-api/dist/TermApi.js";

// import { ExtensionTerminalBorderContribution } from "../ExtensionMetadata";


export class TerminalImpl implements ExtensionApi.Terminal {
  private _log: Logger = null;
  viewerType: "terminal-output";
  #terminalBorderWidgets = new Map<string, TerminalBorderWidgetInfo>();
  // #tabTitleWidgets = new Map<string, ExtensionApi.TerminalBorderWidget>();

  environment: TerminalEnvironmentImpl;
  screen: ExtensionApi.ScreenWithCursor;
  viewport: ExtensionApi.Viewport;

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
    this.viewport = new ViewportProxy(this.#terminal);
    this.screen = new ScreenProxy(this.#extensionMetadata, this.#terminal);
    this.onDidAppendBlock = this.#onDidAppendBlockEventEmitter.event;
    this.onDidAppendScrollbackLines = this._onDidAppendScrollbackLinesEventEmitter.event;
    this.onDidScreenChange = this._onDidScreenChangeEventEmitter.event;

    this.#sessionConfiguration = _.cloneDeep(this.#terminal.getSessionConfiguration());
    this.#sessionConfigurationExtensions = this.#sessionConfiguration.extensions ?? {};
    this.#sessionConfiguration.extensions = null;
  }

  showOnCursorListPicker(options: ExtensionApi.ListPickerOptions): Promise<number> {
    this.#checkIsAlive();
    return this.#internalExtensionContext.showOnCursorListPicker(this.#terminal, options);
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
    this.#checkIsAlive();
    return this.#internalExtensionContext.wrapTab(this.#terminal);
  }

  type(text: string): void {
    this.#checkIsAlive();
    this.#terminal.sendToPty(text);
  }

  get blocks(): ExtensionApi.Block[] {
    return this.#terminal.getBlockFrames().map(bf =>
      this.#internalExtensionContext.wrapBlock(bf));
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

  createTerminalBorderWidget(name: string): ExtensionApi.TerminalBorderWidget {
    this.#checkIsAlive();
    // if (this.#terminalBorderWidgets.has(name)) {
    //   const terminalBorderWidget = this.#terminalBorderWidgets.get(name);
    //   const data = this.#findTerminalBorderWidgetMetadata(name);
    //   this.#terminal.appendWidgetToBorder(extensionContainerElement, data.border);
    //   terminalBorderWidget._handleOpen();
    //   return factoryResult;
    // }
    const data = this.#findTerminalBorderWidgetMetadata(name);

    const terminalBorderWidget = new TerminalBorderWidgetImpl(this.#terminal, data.border);
    return terminalBorderWidget;

    // this.#terminal.appendWidgetToBorder(extensionContainerElement, data.border);

    // const terminalBorderWidget = new TerminalBorderWidgetContainer(
    //   () => {
    //   this._terminal.removeElementFromBorder(extensionContainerElement);
    //   terminalBorderWidget._handleClose();
    // }
    // );
    // const factoryResult = factory(this, terminalBorderWidget);
    // this._terminalBorderWidgets.set(name, { extensionContainerElement: extensionContainerElement, terminalBorderWidget,
    //   factoryResult });
    // terminalBorderWidget._handleOpen();
    // return factoryResult;
  }

  #findTerminalBorderWidgetMetadata(name: string): ExtensionTerminalBorderContribution {
    const borderWidgetMeta = this.#extensionMetadata.contributes.terminalBorderWidgets;
    for (const data of borderWidgetMeta) {
      if (data.name === name) {
        return data;
      }
    }
    return null;
  }

  async getWorkingDirectory(): Promise<string | null> {
    const pty = this.#terminal.getPty();
    if (pty == null) {
      return null;
    }
    return pty.getWorkingDirectory();
  }

  get isConnected(): boolean {
    return this.#terminal.getPty() != null;
  }
}


interface TerminalBorderWidgetInfo {
  // extensionContainerElement: ExtensionContainerElement;
  // terminalBorderWidget: InternalTerminalBorderWidget;
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

  constructor(extensionMetadata: ExtensionMetadata, terminal: Terminal) {
    this.#terminal = terminal;
    this.#extensionMetadata = extensionMetadata;
  }

  getLineText(lineNumber: number): string {
    const str = this.#terminal.getEmulator().getLineText(lineNumber);
    return str == null ? "" : str;
  }

  isLineWrapped(lineNumber: number): boolean {
    const line = this.#terminal.getEmulator().lineAtRow(lineNumber);
    if (line == null) {
      return false;
    }
    return line.isWrapped;
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

  getBaseRow(rowNumber: number): ExtensionApi.Row {
    return this.#terminal.getEmulator().lineAtRow(rowNumber);
  }

  hasLayerRow(rowNumber: number, name: string): boolean {
    const line = this.#terminal.getEmulator().lineAtRow(rowNumber);
    if (line == null) {
      return false;
    }
    const key = `${this.#extensionMetadata.name}:${name}`;
    for (const layer of line.layers) {
      if (layer.name === key) {
        return true;
      }
    }
    return false;
  }

  getLayerRow(rowNumber: number, name: string): ExtensionApi.Row {
    const line = this.#terminal.getEmulator().lineAtRow(rowNumber);
    if (line == null) {
      return null;
    }
    const key = `${this.#extensionMetadata.name}:${name}`;
    for (const layer of line.layers) {
      if (layer.name === key) {
        return layer.line;
      }
    }
    const layer: Layer = {
      name: key,
      line: new LineImpl(line.width, line.palette, 0)
    };
    line.layers.push(layer);
    return layer.line;
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

  redraw(): void {
    this.#terminal.redrawScreen();
  }
}


class ViewportProxy implements ExtensionApi.Viewport {

  #terminal: Terminal;

  #onDidChangeEventEmitter = new EventEmitter<void>();
  onDidChange: ExtensionApi.Event<void>;

  constructor(terminal: Terminal) {
    this.#terminal = terminal;
    this.onDidChange = this.#onDidChangeEventEmitter.event;
    this.#terminal.scrollArea.onViewportChanged(() => {
      this.#onDidChangeEventEmitter.fire();
    });
  }

  get height(): number {
    return this.#terminal.scrollArea.getMaximumViewportHeight();
  }

  get position(): number {
    return this.#terminal.scrollArea.getScrollPosition();
  }

  set position(position: number) {
    this.#terminal.scrollArea.setScrollPosition(position);
  }

  get contentHeight(): number {
    return this.#terminal.scrollArea.getContentHeight();
  }
}


class TerminalBorderWidgetImpl implements ExtensionApi.TerminalBorderWidget {
  #terminal: Terminal = null;
  #border: BorderDirection = "north";

  #open = false;
  #contentWidget: QWidget = null;

  constructor(terminal: Terminal, border: BorderDirection) {
    this.#terminal = terminal;
    this.#border = border;
  }

  get contentWidget(): QWidget {
    return this.#contentWidget;
  }

  set contentWidget(widget: QWidget) {
    if (widget === this.#contentWidget) {
      return;
    }

    if (this.#open && this.#contentWidget != null) {
      this.#terminal.removeBorderWidget(this.#contentWidget, this.#border);
      this.#terminal.focus();
    }

    this.#contentWidget = widget;
    if (this.#open) {
      this.#terminal.appendBorderWidget(widget, this.#border);
    }
  }

  get isOpen(): boolean {
    return this.#open;
  }

  open(): void {
    if (this.#contentWidget == null || this.#open) {
      return;
    }

    this.#terminal.appendBorderWidget(this.#contentWidget, this.#border);
    this.#open = true;
  }

  close(): void {
    if (!this.#open || this.#contentWidget == null) {
      this.#open = false;
      return;
    }

    this.#terminal.removeBorderWidget(this.#contentWidget, this.#border);
    this.#open = false;
    this.#terminal.focus();
  }
}
