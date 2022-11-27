/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import { Logger, getLogger, log } from "extraterm-logging";
import { SessionBackend } from "@extraterm/extraterm-extension-api";

import { ExtensionManager, InternalExtensionContext } from "../InternalTypes.js";
import { ExtensionMetadata, ExtensionMenusContribution } from "./ExtensionMetadata.js";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import { ExtensionContextImpl } from "./api/ExtensionContextImpl.js";
import { LoadedSessionBackendContribution, LoadedTerminalThemeProviderContribution } from "./ExtensionManagerTypes.js";
import { LineRangeChange, Terminal } from "../terminal/Terminal.js";
import { CommandsRegistry } from "../CommandsRegistry.js";
import { WorkspaceSessionEditorRegistry } from "./WorkspaceSessionEditorRegistry.js";
import { TerminalImpl } from "./api/TerminalImpl.js";
import { BlockImpl } from "./api/BlockImpl.js";
import { BlockFrame } from "../terminal/BlockFrame.js";
import { TabImpl } from "./api/TabImpl.js";
import { Window } from "../Window.js";
import { WindowImpl } from "./api/WindowImpl.js";
import { Tab } from "../Tab.js";
import { WorkspaceSessionSettingsEditorRegistry } from "./WorkspaceSessionSettingsEditorRegistry.js";
import { TabTitleWidgetRegistry } from "./TabTitleWidgetRegistry.js";
import { BlockRegistry } from "./BlockRegistry.js";
import { ExtensionBlockImpl } from "./api/ExtensionBlockImpl.js";
import { SettingsTabRegistry } from "./SettingsTabRegistry.js";


export class InternalExtensionContextImpl implements InternalExtensionContext {
  private _log: Logger;

  #extensionContext: ExtensionContextImpl;
  #extensionManager: ExtensionManager;
  #configDatabase: ConfigDatabase;

  commands: CommandsRegistry;
  sessionEditorRegistry: WorkspaceSessionEditorRegistry;
  sessionSettingsEditorRegistry: WorkspaceSessionSettingsEditorRegistry;
  tabTitleWidgetRegistry: TabTitleWidgetRegistry;
  blockRegistry: BlockRegistry;
  settingsTabRegistry: SettingsTabRegistry;

  extensionMetadata: ExtensionMetadata;

  #sessionBackends: LoadedSessionBackendContribution[] = [];
  #terminalThemeProviders: LoadedTerminalThemeProviderContribution[] = [];

  #onDidCreateTerminalEventEmitter = new EventEmitter<ExtensionApi.Terminal>();
  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  constructor(extensionManager: ExtensionManager, extensionMetadata: ExtensionMetadata, configDatabase: ConfigDatabase,
      applicationVersion: string) {

    this._log = getLogger(`InternalExtensionContextImpl (${extensionMetadata.name})`);

    this.#configDatabase = configDatabase;
    this.#extensionManager = extensionManager;
    this.extensionMetadata = extensionMetadata;

    this.onDidCreateTerminal = this.#onDidCreateTerminalEventEmitter.event;

    this.commands = new CommandsRegistry(extensionManager, extensionMetadata.name,
      extensionMetadata.contributes.commands, extensionMetadata.contributes.menus);
    this.sessionEditorRegistry = new WorkspaceSessionEditorRegistry(extensionMetadata);
    this.sessionSettingsEditorRegistry = new WorkspaceSessionSettingsEditorRegistry(this.#configDatabase,
      extensionMetadata);
    this.tabTitleWidgetRegistry = new TabTitleWidgetRegistry(extensionMetadata);
    this.#extensionContext = new ExtensionContextImpl(extensionMetadata, this, configDatabase, applicationVersion);
    this.blockRegistry = new BlockRegistry(this, extensionMetadata);
    this.settingsTabRegistry = new SettingsTabRegistry(this, extensionMetadata);
  }

  getActiveBlock(): ExtensionApi.Block {
    return this.wrapBlock(this.#extensionManager.getActiveBlockFrame());
  }

  getActiveTerminal(): ExtensionApi.Terminal {
    return this.wrapTerminal(this.#extensionManager.getActiveTerminal());
  }

  getActiveHyperlinkURL(): string {
    return this.#extensionManager.getActiveHyperlinkURL();
  }

  getActiveWindow(): ExtensionApi.Window {
    return this.wrapWindow(this.#extensionManager.getActiveWindow());
  }

  newWindowCreated(window: Window, allWindows: Window[]): void {
    // throw new Error("Method not implemented.");
  }

  getAllTerminals(): ExtensionApi.Terminal[] {
    const allWindows = this.#extensionManager.getAllWindows();
    let allTerminals: Terminal[] = [];
    for (const window of allWindows) {
      allTerminals = [...allTerminals, ...window.getTerminals()];
    }

    return allTerminals.map(t => this.wrapTerminal(t));
  }

  getTerminalThemeProviders(): LoadedTerminalThemeProviderContribution[] {
    return this.#terminalThemeProviders;
  }

  getExtensionContext(): ExtensionApi.ExtensionContext {
    return this.#extensionContext;
  }

  getSessionBackends(): LoadedSessionBackendContribution[] {
    return this.#sessionBackends;
  }

  setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean) {
    const entryList = this.commands.getCommandToMenuEntryMap().get(command);
    if (entryList == null) {
      return;
    }
    for (const entry of entryList) {
      entry[menuType] = on;
    }
  }

  getWindowForTab(tab: Tab): ExtensionApi.Window {
    const window = this.#extensionManager.getWindowForTab(tab);
    return this.wrapWindow(window);
  }

  dispose(): void {
    this.#disposeAllExtensionBlocks();
    this.#disposeExtensionTerminals();
  }

  #disposeAllExtensionBlocks(): void {
    const allWindows = this.#extensionManager.getAllWindows();
    for (const window of allWindows) {
      for (const terminal of window.getTerminals()) {
        for (const blockFrame of terminal.getBlockFrames()) {
          const block = blockFrame.getBlock();
          if (block instanceof ExtensionBlockImpl &&
              block.getInternalExtensionContext() === this) {
            terminal.destroyFrame(blockFrame);
          }
        }
      }
    }
  }

  #disposeExtensionTerminals(): void {
    const allWindows = this.#extensionManager.getAllWindows();

    for (const window of allWindows) {
      for (const terminal of window.getTerminals()) {
        if (this.#terminalWrapMap.has(terminal)) {
          this.#terminalWrapMap.get(terminal).dispose();
        }
      }
    }
  }

  registerSessionBackend(name: string, backend: SessionBackend): void {
    for (const backendMeta of this.extensionMetadata.contributes.sessionBackends) {
      if (backendMeta.name === name) {
        this.#sessionBackends.push({
          metadata: this.extensionMetadata,
          sessionBackendMetadata: backendMeta,
          sessionBackend: backend
        });
        return;
      }
    }

    this._log.warn(`Unable to register session backend '${name}' for extension ` +
      `'${this.extensionMetadata.name}' because the session backend contribution data ` +
      `couldn't be found in the extension's package.json file.`);
  }

  registerTerminalThemeProvider(name: string, provider: ExtensionApi.TerminalThemeProvider): void {
    for (const backendMeta of this.extensionMetadata.contributes.terminalThemeProviders) {
      if (backendMeta.name === name) {
        this.#terminalThemeProviders.push({
          metadata: this.extensionMetadata,
          terminalThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register terminal theme provider '${name}' for extension ` +
      `'${this.extensionMetadata.name}' because the terminal theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  newTerminalCreated(window: Window, newTerminal: Terminal): void {
    if (this.#onDidCreateTerminalEventEmitter.hasListeners()) {
      const terminal = this.wrapTerminal(newTerminal);
      this.#onDidCreateTerminalEventEmitter.fire(terminal);
    }
  }

  async showListPicker(tab: Tab, options: ExtensionApi.ListPickerOptions): Promise<number> {
    return this.#extensionManager.showListPicker(tab, options);
  }

  async showOnCursorListPicker(terminal: Terminal, options: ExtensionApi.ListPickerOptions): Promise<number> {
    return this.#extensionManager.showOnCursorListPicker(terminal, options);
  }

  terminalEnvironmentChanged(terminal: Terminal, changeList: string[]): void {
    if (this.hasTerminalWrapper(terminal)) {
      const wrapper = this.wrapTerminal(terminal);
      if (wrapper.environment._onChangeEventEmitter.hasListeners()) {
        wrapper.environment._onChangeEventEmitter.fire(changeList);
      }
    }
  }

  terminalDidAppendScrollbackLines(terminal: Terminal, ev: LineRangeChange): void {
    if (this.hasTerminalWrapper(terminal)) {
      const wrapper = this.wrapTerminal(terminal);
      if (wrapper._onDidAppendScrollbackLinesEventEmitter.hasListeners()) {
        const block = this.wrapBlock(ev.blockFrame);
        wrapper._onDidAppendScrollbackLinesEventEmitter.fire({
          block,
          startLine: ev.startLine,
          endLine: ev.endLine
        });
      }
    }

  }

  terminalDidScreenChange(terminal: Terminal, ev: LineRangeChange): void {
    if (this.hasTerminalWrapper(terminal)) {
      const wrapper = this.wrapTerminal(terminal);
      if (wrapper._onDidScreenChangeEventEmitter.hasListeners()) {
        const block = this.wrapBlock(ev.blockFrame);
        if (ev.startLine !== -1 && ev.endLine !== -1) {
          wrapper._onDidScreenChangeEventEmitter.fire({
            block,
            startLine: ev.startLine,
            endLine: ev.endLine
          });
        }
      }
    }
  }

  #terminalWrapMap = new WeakMap<Terminal, TerminalImpl>();

  hasTerminalWrapper(terminal: Terminal): boolean {
    return this.#terminalWrapMap.has(terminal);
  }

  wrapTerminal(terminal: Terminal): TerminalImpl {
    if (terminal == null) {
      return null;
    }
    if (!this.#terminalWrapMap.has(terminal)) {
      const wrappedTerminal = new TerminalImpl(this, this.extensionMetadata, terminal);
      this.#terminalWrapMap.set(terminal, wrappedTerminal);
    }
    return this.#terminalWrapMap.get(terminal);
  }

  #blockWrapMap = new WeakMap<BlockFrame, BlockImpl>();

  hasBlockWrapper(block: BlockFrame): boolean {
    return this.#blockWrapMap.has(block);
  }

  wrapBlock(blockFrame: BlockFrame): BlockImpl {
    if (blockFrame == null) {
      return null;
    }
    if (!this.#blockWrapMap.has(blockFrame)) {
      const wrappedBlock = new BlockImpl(this, this.extensionMetadata, blockFrame);
      this.#blockWrapMap.set(blockFrame, wrappedBlock);
    }
    return this.#blockWrapMap.get(blockFrame);
  }

  #windowWrapMap = new WeakMap<Window, WindowImpl>();

  wrapWindow(window: Window): WindowImpl {
    if (window == null) {
      return null;
    }
    if (!this.#windowWrapMap.has(window)) {
      const wrappedWindow = new WindowImpl(this, this.extensionMetadata, window, this.#configDatabase);
      this.#windowWrapMap.set(window, wrappedWindow);
    }
    return this.#windowWrapMap.get(window);
  }

  #tabWrapMap = new WeakMap<Tab, TabImpl>();

  wrapTab(tab: Tab): TabImpl {
    if (tab == null) {
      return null;
    }
    if (!this.#tabWrapMap.has(tab)) {
      const wrappedTab = new TabImpl(this, tab);
      this.#tabWrapMap.set(tab, wrappedTab);
    }
    return this.#tabWrapMap.get(tab);
  }
}
