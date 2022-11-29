/*
 * Copyright 2017-2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { QWidget } from "@nodegui/nodegui";

import { CommandsRegistry } from "./CommandsRegistry.js";
import { LoadedSessionBackendContribution, LoadedTerminalThemeProviderContribution } from "./extension/ExtensionManagerTypes.js";
import { ExtensionMetadata, ExtensionPlatform, Category, ExtensionCommandContribution, ExtensionMenusContribution } from "./extension/ExtensionMetadata.js";
import { WorkspaceSessionEditorRegistry } from "./extension/WorkspaceSessionEditorRegistry.js";
import { WorkspaceSessionSettingsEditorRegistry } from "./extension/WorkspaceSessionSettingsEditorRegistry.js";
import { TabTitleWidgetRegistry } from "./extension/TabTitleWidgetRegistry.js";
import { Tab } from "./Tab.js";
import { BlockFrame } from "./terminal/BlockFrame.js";
import { LineRangeChange, Terminal } from "./terminal/Terminal.js";
import { Window } from "./Window.js";
import { CommonExtensionWindowState } from "./extension/CommonExtensionState.js";
import { BulkFile } from "./bulk_file_handling/BulkFile.js";
import { Block } from "./terminal/Block.js";
import { BlockRegistry } from "./extension/BlockRegistry.js";
import { LoadedSettingsTabContribution, SettingsTabRegistry } from "./extension/SettingsTabRegistry.js";


export interface CommandQueryOptions {
  categories?: Category[];
  commandPalette?: boolean;
  contextMenu?: boolean;
  emptyPaneMenu?: boolean;
  newTerminalMenu?: boolean;
  terminalTitleMenu?: boolean;
  windowMenu?: boolean;
  when?: boolean;
  commands?: string[];
}

export interface ExtensionManager {
  getActiveWindow(): Window;
  getActiveTerminal(): Terminal;
  getActiveHyperlinkURL(): string;
  getActiveBlockFrame(): BlockFrame;
  getAllExtensions(): ExtensionMetadata[];
  getAllWindows(): Window[];
  getWindowForTab(tab: Tab): Window;

  onDesiredStateChanged: ExtensionApi.Event<void>;

  enableExtension(name: string): void;
  disableExtension(name: string): void;
  isExtensionEnabled(name: string): boolean;

  getExtensionContextByName(name: string): InternalExtensionContext;

  getAllSessionTypes(): { name: string, type: string }[];
  getAllTerminalThemeFormats(): { name: string, formatName: string }[];

  queryCommands(options: CommandQueryOptions): ExtensionCommandContribution[];
  queryCommandsWithExtensionWindowState(options: CommandQueryOptions, context: CommonExtensionWindowState): ExtensionCommandContribution[];

  executeCommand(command: string, args?: any): any;
  executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): any;

  copyExtensionWindowState(): CommonExtensionWindowState;
  createExtensionBlockWithBulkFile(terminal: Terminal, mimeType: string, bulkFile: BulkFile): Block;

  createTabTitleWidgets(terminal: Terminal): QWidget[];
  createSessionEditor(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionEditor;
  createSessionSettingsEditors(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration,
    window: Window): InternalSessionSettingsEditor[];
  showListPicker(tab: Tab, options: ExtensionApi.ListPickerOptions): Promise<number>;
  showOnCursorListPicker(terminal: Terminal, options: ExtensionApi.ListPickerOptions): Promise<number>;
  getSettingsTabContributions(): LoadedSettingsTabContribution[];
}

export interface ProxyFactory {
  getTerminalProxy(terminal: Terminal): ExtensionApi.Terminal;
  hasTerminalProxy(terminal: Terminal): boolean;

  getBlock(blockFrame: BlockFrame): ExtensionApi.Block;
}

/**
 * Holds internal accounting needed to support an Extension.
 *
 * It also provides methods for the core application to interact with an
 * Extension and all the different things it may have registered and
 * provided.
 */
export interface InternalExtensionContext extends ExtensionApi.Disposable {
  extensionMetadata: ExtensionMetadata;

  commands: CommandsRegistry;
  sessionEditorRegistry: WorkspaceSessionEditorRegistry;
  sessionSettingsEditorRegistry: WorkspaceSessionSettingsEditorRegistry;
  tabTitleWidgetRegistry: TabTitleWidgetRegistry;
  blockRegistry: BlockRegistry;
  settingsTabRegistry: SettingsTabRegistry;

  getActiveBlock(): ExtensionApi.Block;
  getActiveTerminal(): ExtensionApi.Terminal;
  getActiveHyperlinkURL(): string;
  getActiveWindow(): ExtensionApi.Window;
  getAllTerminals(): ExtensionApi.Terminal[];
  getExtensionContext(): ExtensionApi.ExtensionContext;
  getSessionBackends(): LoadedSessionBackendContribution[];
  getTerminalThemeProviders(): LoadedTerminalThemeProviderContribution[];
  getWindowForTab(tab: Tab): ExtensionApi.Window;

  onDidCreateTerminal: ExtensionApi.Event<ExtensionApi.Terminal>;

  registerSessionBackend(name: string, backend: ExtensionApi.SessionBackend): void;
  registerTerminalThemeProvider(name: string, provider: ExtensionApi.TerminalThemeProvider): void;

  setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean): void;

  newTerminalCreated(window: Window, newTerminal: Terminal): void;
  newWindowCreated(window: Window, allWindows: Window[]): void;

  showListPicker(tab: Tab, options: ExtensionApi.ListPickerOptions): Promise<number>;
  showOnCursorListPicker(terminal: Terminal, options: ExtensionApi.ListPickerOptions): Promise<number>;

  terminalEnvironmentChanged(terminal: Terminal, changeList: string[]): void;
  terminalDidAppendScrollbackLines(terminal: Terminal, ev: LineRangeChange): void;
  terminalDidScreenChange(terminal: Terminal, ev: LineRangeChange): void;
  wrapTab(tab: Tab): ExtensionApi.Tab;
  wrapTerminal(terminal: Terminal): ExtensionApi.Terminal;
  hasBlockWrapper(blockFrame: BlockFrame): boolean;
  wrapBlock(blockFrame: BlockFrame): ExtensionApi.Block;
}

export interface SessionSettingsChange {
  settingsConfigKey: string;
  settings: Object;
}

export interface InternalSessionSettingsEditor extends ExtensionApi.SessionSettingsEditorBase {
   name: string;
   onSettingsChanged: ExtensionApi.Event<SessionSettingsChange>;
  _getWidget(): QWidget;
}

export interface SessionConfigurationChange {
  sessionConfiguration: ExtensionApi.SessionConfiguration;
}

export interface InternalSessionEditor extends ExtensionApi.SessionEditorBase {
   onSessionConfigurationChanged: ExtensionApi.Event<SessionConfigurationChange>;
   _getWidget(): QWidget;
}

export function isSupportedOnThisPlatform(metadata: ExtensionMetadata): boolean {
  let included = metadata.includePlatform.length === 0;
  for (const platform of metadata.includePlatform) {
    included = included || _platformMatches(platform);
  }

  if ( ! included) {
    return false;
  }

  if (metadata.excludePlatform.length === 0) {
    return true;
  }

  for (const platform of metadata.excludePlatform) {
    if (_platformMatches(platform)) {
      return false;
    }
  }
  return true;
}

function _platformMatches(platform: ExtensionPlatform): boolean {
  if (platform.os == null && platform.arch == null) {
    return false;
  }
  if (platform.os === process.platform && platform.arch == null) {
    return true;
  }
  if (platform.arch === process.arch && platform.os == null) {
    return true;
  }
  return platform.arch === process.arch && platform.os === process.platform;
}
