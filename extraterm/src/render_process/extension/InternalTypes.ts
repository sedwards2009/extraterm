/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { EtTerminal } from '../Terminal';
import { TextViewer } from'../viewers/TextAceViewer';
import { ViewerElement } from '../viewers/ViewerElement';
import * as ExtensionApi from 'extraterm-extension-api';
import { ExtensionMetadata, ExtensionPlatform, Category, ExtensionCommandContribution, ExtensionMenusContribution } from '../../ExtensionMetadata';
import { EtViewerTab } from '../ViewerTab';
import { SupportsDialogStack } from '../SupportsDialogStack';
import { CommandsRegistry } from './CommandsRegistry';
import { TextEditor } from '../viewers/TextEditorType';
import { CommonExtensionWindowState } from './CommonExtensionState';
import { EventEmitter } from 'extraterm-event-emitter';
import { TabWidget } from '../gui/TabWidget';

export interface CommandQueryOptions {
  categories?: Category[];
  commandPalette?: boolean;
  contextMenu?: boolean;
  emptyPaneMenu?: boolean;
  newTerminalMenu?: boolean;
  terminalTitleMenu?: boolean;
  when?: boolean;
  commandsWithCategories?: {command: string, category: Category}[];
}

export interface ExtensionManager {
  startUp(): void;

  extensionUiUtils: ExtensionUiUtils;
  
  getExtensionContextByName(name: string): InternalExtensionContext;

  findViewerElementTagByMimeType(mimeType: string): string;

  getAllSessionTypes(): { name: string, type: string }[];
  getSessionEditorTagForType(type: string): string;

  getAllTerminalThemeFormats(): { name: string, formatName: string }[];
  getAllSyntaxThemeFormats(): { name: string, formatName: string }[];

  getActiveTab(): HTMLElement;
  getActiveTerminal(): EtTerminal;
  getActiveTabContent(): HTMLElement;
  getActiveTabWidget(): TabWidget;
  getActiveTextEditor(): TextEditor;
  isInputFieldFocus(): boolean;

  queryCommands(options: CommandQueryOptions): ExtensionCommandContribution[];
  queryCommandsWithExtensionWindowState(options: CommandQueryOptions, context: CommonExtensionWindowState): ExtensionCommandContribution[];
  
  executeCommand(command: string, args?: any): any;
  executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): any;

  updateExtensionWindowStateFromEvent(ev: Event): void;
  copyExtensionWindowState(): CommonExtensionWindowState;
  getExtensionWindowStateFromEvent(ev: Event): CommonExtensionWindowState;
  refocus(state: CommonExtensionWindowState): void;

  newTerminalCreated(newTerminal: EtTerminal): void;

  onCommandsChanged: ExtensionApi.Event<void>;
  commandRegistrationChanged(): void;
}

export interface AcceptsExtensionManager {
  setExtensionManager(extensionManager: ExtensionManager): void;
}

export function injectExtensionManager(instance: any, extensionManager: ExtensionManager): void {
  if (isAcceptsExtensionManager(instance)) {
    instance.setExtensionManager(extensionManager);
  }
}

export function isAcceptsExtensionManager(instance: any): instance is AcceptsExtensionManager {
  return (<AcceptsExtensionManager> instance).setExtensionManager !== undefined;
}

export interface ProxyFactory {
  getTabProxy(tabLike: EtTerminal | EtViewerTab): ExtensionApi.Tab;

  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal;
  hasTerminalProxy(terminal: EtTerminal): boolean;

  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer;
}

export interface ExtensionUiUtils {
  showNumberInput(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.NumberInputOptions): Promise<number | undefined>;
  showListPicker(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
}

export interface InternalWindow extends ExtensionApi.Window {
  findViewerElementTagByMimeType(mimeType: string): string;
  getSessionEditorTagForType(sessionType): string;
  getTerminalBorderWidgetFactory(name: string): ExtensionApi.TerminalBorderWidgetFactory;

  newTerminalCreated(newTerminal: EtTerminal): void;
  terminalAppendedViewer(newTerminal: EtTerminal, viewer: ViewerElement): void;
  terminalEnvironmentChanged(terminal: EtTerminal, changeList: string[]): void;
}

export interface InternalExtensionContext extends ExtensionApi.ExtensionContext {
  extensionManager: ExtensionManager;
  commands: CommandsRegistry;
  extensionMetadata: ExtensionMetadata;
  internalWindow: InternalWindow;
  proxyFactory: ProxyFactory;

  findViewerElementTagByMimeType(mimeType: string): string;
  registerCommandContribution(contribution: ExtensionCommandContribution): ExtensionApi.Disposable;
  setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean);
  debugRegisteredCommands(): void;
}

export interface InternalTerminalBorderWidget extends ExtensionApi.TerminalBorderWidget {
  _handleOpen(): void;
  _handleClose(): void;
}

export function isMainProcessExtension(metadata: ExtensionMetadata): boolean {
  return metadata.contributes.sessionBackends.length !== 0 ||
    metadata.contributes.syntaxThemeProviders.length !== 0 ||
    metadata.contributes.syntaxThemes.length !== 0 ||
    metadata.contributes.terminalThemeProviders.length !== 0 ||
    metadata.contributes.terminalThemes.length !== 0;
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
  if (platform.os == process.platform && platform.arch == null) {
    return true;
  }
  if (platform.arch == process.arch && platform.os == null) {
    return true;
  }
  return platform.arch == process.arch && platform.os == process.platform;
}
