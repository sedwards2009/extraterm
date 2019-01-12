/*
 * Copyright 2017-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import {EtTerminal} from '../Terminal';
import {TextViewer} from'../viewers/TextAceViewer';
import {ViewerElement} from '../viewers/ViewerElement';
import * as ExtensionApi from 'extraterm-extension-api';
import { ExtensionMetadata, ExtensionPlatform } from '../../ExtensionMetadata';
import { EtViewerTab } from '../ViewerTab';
import { SupportsDialogStack } from '../SupportsDialogStack';
import { BoundCommand } from '../command/CommandTypes';

export interface ExtensionManager {
  startUp(): void;
  getWorkspaceTerminalCommands(terminal: EtTerminal): BoundCommand[];
  getWorkspaceTextViewerCommands(textViewer: TextViewer): BoundCommand[];

  findViewerElementTagByMimeType(mimeType: string): string;

  getAllSessionTypes(): { name: string, type: string }[];
  getSessionEditorTagForType(type: string): string;

  getAllTerminalThemeFormats(): { name: string, formatName: string }[];
  getAllSyntaxThemeFormats(): { name: string, formatName: string }[];
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
  getViewerProxy(viewer: ViewerElement): ExtensionApi.Viewer;
}

export interface ExtensionUiUtils {
  showNumberInput(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.NumberInputOptions): Promise<number | undefined>;
  showListPicker(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
}

export interface InternalWorkspace extends ExtensionApi.Workspace {
  getTerminalCommands(extensionName: string, terminal: ExtensionApi.Terminal): BoundCommand[];
  getTextViewerCommands(extensionName: string, terminal: ExtensionApi.TextViewer): BoundCommand[];
  findViewerElementTagByMimeType(mimeType: string): string;
  getSessionEditorTagForType(sessionType): string;
}

export interface InternalExtensionContext extends ExtensionApi.ExtensionContext {
  extensionUiUtils: ExtensionUiUtils;
  extensionMetadata: ExtensionMetadata;
  internalWorkspace: InternalWorkspace;
  proxyFactory: ProxyFactory;

  findViewerElementTagByMimeType(mimeType: string): string;
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
