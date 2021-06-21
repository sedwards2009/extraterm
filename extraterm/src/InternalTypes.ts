/*
 * Copyright 2017-2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

// import { EtTerminal, LineRangeChange } from "../Terminal";
// import { ViewerElement } from "../viewers/ViewerElement";
import { ExtensionMetadata, ExtensionPlatform, Category, ExtensionCommandContribution, ExtensionMenusContribution } from "./extension/ExtensionMetadata";
import { Terminal } from "./terminal/Terminal";
// import { EtViewerTab } from "../ViewerTab";
// import { SupportsDialogStack } from "../SupportsDialogStack";
// import { CommandsRegistry } from "./CommandsRegistry";
// import { TextEditor } from "../viewers/TextEditorType";
// import { CommonExtensionWindowState } from "./CommonExtensionState";
// import { TabWidget } from "../gui/TabWidget";
// import { SessionConfiguration } from "@extraterm/extraterm-extension-api";
// import { ExtensionContainerElement } from "./ExtensionContainerElement";
// import { SplitLayout } from "../SplitLayout";

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
//   startUp(): void;

//   setSplitLayout(splitLayout: SplitLayout): void;
//   getAllExtensions(): ExtensionMetadata[];
//   onStateChanged: ExtensionApi.Event<void>;
//   isExtensionRunning(name: string):boolean;
//   enableExtension(name: string): void;
//   disableExtension(name: string): void;

//   extensionUiUtils: ExtensionUiUtils;

   getExtensionContextByName(name: string): InternalExtensionContext;

//   findViewerElementTagByMimeType(mimeType: string): string;

//   getAllSessionTypes(): { name: string, type: string }[];

//   getAllTerminalThemeFormats(): { name: string, formatName: string }[];
//   getAllSyntaxThemeFormats(): { name: string, formatName: string }[];

//   getActiveTab(): HTMLElement;
//   getActiveTerminal(): EtTerminal;
//   getActiveTabContent(): HTMLElement;
//   getActiveTabWidget(): TabWidget;
//   getActiveTextEditor(): TextEditor;
//   isInputFieldFocus(): boolean;

//   queryCommands(options: CommandQueryOptions): ExtensionCommandContribution[];
//   queryCommandsWithExtensionWindowState(options: CommandQueryOptions, context: CommonExtensionWindowState): ExtensionCommandContribution[];

  executeCommand(command: string, args?: any): any;
//   executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): any;

//   updateExtensionWindowStateFromEvent(ev: Event): void;
//   copyExtensionWindowState(): CommonExtensionWindowState;
//   getExtensionWindowStateFromEvent(ev: Event): CommonExtensionWindowState;
//   refocus(state: CommonExtensionWindowState): void;

//   newTerminalCreated(newTerminal: EtTerminal, allTerminals: EtTerminal[]): void;
//   terminalDestroyed(deadTerminal: EtTerminal, allTerminals: EtTerminal[]): void;

//   onCommandsChanged: ExtensionApi.Event<void>;
//   commandRegistrationChanged(): void;

//   createNewTerminalTabTitleWidgets(terminal: EtTerminal);
//   createSessionEditor(sessionType: string, sessionConfiguration: SessionConfiguration): InternalSessionEditor;
//   createSessionSettingsEditors(sessionType: string, sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[];

//   setViewerTabDisplay(viewerTabDisplay: ViewerTabDisplay): void;
//   getViewerTabDisplay(): ViewerTabDisplay;
}

// export interface AcceptsExtensionManager {
//   setExtensionManager(extensionManager: ExtensionManager): void;
// }

// export function injectExtensionManager(instance: any, extensionManager: ExtensionManager): void {
//   if (isAcceptsExtensionManager(instance)) {
//     instance.setExtensionManager(extensionManager);
//   }
// }

// export function isAcceptsExtensionManager(instance: any): instance is AcceptsExtensionManager {
//   return (<AcceptsExtensionManager> instance).setExtensionManager !== undefined;
// }

// /**
//  * Interface for something which can display ViewerElements in tabs.
//  */
// export interface ViewerTabDisplay {
//   openViewerTab(viewerElement: ViewerElement): void;
//   closeViewerTab(viewerElement: ViewerElement): void;
//   switchToTab(viewerElement: ViewerElement): void;
// }


export interface ProxyFactory {
//   getTabProxy(tabLike: EtTerminal | EtViewerTab): ExtensionApi.Tab;

  getTerminalProxy(terminal: Terminal): ExtensionApi.Terminal;
  hasTerminalProxy(terminal: Terminal): boolean;

//   getBlock(viewer: ViewerElement): ExtensionApi.Block;
// }

// export interface ExtensionUiUtils {
//   showNumberInput(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.NumberInputOptions): Promise<number | undefined>;
//   showListPicker(host: SupportsDialogStack & HTMLElement, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
//   showOnCursorListPicker(terminal: EtTerminal, options: ExtensionApi.ListPickerOptions): Promise<number | undefined>;
}

export interface InternalWindow extends ExtensionApi.Window {
  findViewerElementTagByMimeType(mimeType: string): string;
  // createSessionEditor(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionEditor;
  // createSessionSettingsEditors(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionSettingsEditor[];
  getTerminalBorderWidgetFactory(name: string): ExtensionApi.TerminalBorderWidgetFactory;

  newTerminalCreated(newTerminal: Terminal, allTerminals: Terminal[]): void;
  terminalDestroyed(deadTerminal: Terminal, allTerminals: Terminal[]): void;

  // terminalAppendedViewer(newTerminal: Terminal, viewer: ViewerElement): void;
  terminalEnvironmentChanged(terminal: Terminal, changeList: string[]): void;
  terminalDidAppendScrollbackLines(terminal: Terminal, ev: ExtensionApi.LineRangeChange): void;
  // terminalDidScreenChange(terminal: Terminal, ev: LineRangeChange): void;
}

/**
 * Holds internal accounting needed to support an Extension.
 *
 * It also provides methods for the core application to interact with an
 * Extension and all the different things it may have registered and
 * provided.
 */
export interface InternalExtensionContext extends ExtensionApi.ExtensionContext, ExtensionApi.Disposable {
   // Note: Most of these fields start with `_` to signal to any extension
   // developers that these fields are internal.

  _extensionManager: ExtensionManager;
  // commands: CommandsRegistry;
  // _extensionMetadata: ExtensionMetadata;
  // _internalWindow: InternalWindow;
  _proxyFactory: ProxyFactory;

  // _findViewerElementTagByMimeType(mimeType: string): string;
  _registerCommandContribution(contribution: ExtensionCommandContribution): ExtensionApi.Disposable;
  _setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean);
  // _debugRegisteredCommands(): void;

  // _registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void;
  // _createTabTitleWidgets(terminal: EtTerminal): HTMLElement[];
}

// export interface InternalTerminalBorderWidget extends ExtensionApi.TerminalBorderWidget {
//   _handleOpen(): void;
//   _handleClose(): void;
// }

// export interface InternalTabTitleWidget extends ExtensionApi.TabTitleWidget {

// }

// export interface SessionSettingsChange {
//   settingsConfigKey: string;
//   settings: Object;
// }

export interface InternalSessionSettingsEditor extends ExtensionApi.SessionSettingsEditorBase {
//   name: string;
//   onSettingsChanged: ExtensionApi.Event<SessionSettingsChange>;
//   _getExtensionContainerElement(): ExtensionContainerElement;
//   _init(): void;
}

// export interface SessionConfigurationChange {
//   sessionConfiguration: SessionConfiguration;
// }

export interface InternalSessionEditor extends ExtensionApi.SessionEditorBase {
//   onSessionConfigurationChanged: ExtensionApi.Event<SessionConfigurationChange>;
//   _getExtensionContainerElement(): ExtensionContainerElement;
//   _init(): void;
}

// export function isSupportedOnThisPlatform(metadata: ExtensionMetadata): boolean {
//   let included = metadata.includePlatform.length === 0;
//   for (const platform of metadata.includePlatform) {
//     included = included || _platformMatches(platform);
//   }

//   if ( ! included) {
//     return false;
//   }

//   if (metadata.excludePlatform.length === 0) {
//     return true;
//   }

//   for (const platform of metadata.excludePlatform) {
//     if (_platformMatches(platform)) {
//       return false;
//     }
//   }
//   return true;
// }

// function _platformMatches(platform: ExtensionPlatform): boolean {
//   if (platform.os == null && platform.arch == null) {
//     return false;
//   }
//   if (platform.os === process.platform && platform.arch == null) {
//     return true;
//   }
//   if (platform.arch === process.arch && platform.os == null) {
//     return true;
//   }
//   return platform.arch === process.arch && platform.os === process.platform;
// }
