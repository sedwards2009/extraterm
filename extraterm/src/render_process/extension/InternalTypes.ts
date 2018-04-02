/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EtTerminal} from '../Terminal';
import {TextViewer} from'../viewers/TextViewer';
import {ViewerElement} from '../viewers/ViewerElement';
import * as ExtensionApi from 'extraterm-extension-api';
import * as CommandPaletteRequestTypes from '../CommandPaletteRequestTypes';
import { ExtensionMetadata } from '../../ExtensionMetadata';

export interface ExtensionManager {
  startUp(): void;
  getWorkspaceTerminalCommands(terminal: EtTerminal): CommandPaletteRequestTypes.CommandEntry[];
  getWorkspaceTextViewerCommands(textViewer: TextViewer): CommandPaletteRequestTypes.CommandEntry[];

  findViewerElementTagByMimeType(mimeType: string): string;

  getAllSessionTypes(): { name: string, type: string }[];
  getSessionEditorTagForType(type: string): string;
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
  getTabProxy(terminal: EtTerminal): ExtensionApi.Tab;
  getTerminalProxy(terminal: EtTerminal): ExtensionApi.Terminal;
  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer;
}

export interface ExtensionUiUtils {
  showNumberInput(terminal: EtTerminal, options: ExtensionApi.NumberInputOptions): Promise<number | undefined>;
  showListPicker(terminal: EtTerminal, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
}

export interface InternalWorkspace extends ExtensionApi.Workspace {
  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): CommandPaletteRequestTypes.CommandEntry[];
  getTextViewerCommands(extensionName: string, terminal: ExtensionApi.TextViewer): CommandPaletteRequestTypes.CommandEntry[];
  findViewerElementTagByMimeType(mimeType: string): string;
}

export interface InternalExtensionContext extends ExtensionApi.ExtensionContext {
  extensionUiUtils: ExtensionUiUtils;
  extensionMetadata: ExtensionMetadata;
  internalWorkspace: InternalWorkspace;
  proxyFactory: ProxyFactory;

  findViewerElementTagByMimeType(mimeType: string): string;
}
