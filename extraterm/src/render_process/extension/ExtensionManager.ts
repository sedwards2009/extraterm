/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import * as _ from "lodash";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";

import { Logger, getLogger, log } from "extraterm-logging";
import { EtTerminal } from "../Terminal";
import { TextViewer } from"../viewers/TextAceViewer";
import { ExtensionManager, ExtensionUiUtils, InternalExtensionContext,
  isMainProcessExtension, CommandQueryOptions, InternalSessionSettingsEditor, InternalSessionEditor } from "./InternalTypes";
import { ExtensionUiUtilsImpl } from "./ExtensionUiUtilsImpl";
import { ExtensionMetadata, ExtensionCommandContribution, Category, WhenVariables, ExtensionDesiredState
} from "../../ExtensionMetadata";
import * as WebIpc from "../WebIpc";
import { CommandMenuEntry } from "./CommandsRegistry";
import { CommonExtensionWindowState } from "./CommonExtensionState";
import { Mode } from "../viewers/ViewerElementTypes";
import { TextEditor } from "../viewers/TextEditorType";
import { TerminalViewer } from "../viewers/TerminalAceViewer";
import { ViewerElement } from "../viewers/ViewerElement";
import { EmbeddedViewer } from "../viewers/EmbeddedViewer";
import { TabWidget } from "../gui/TabWidget";
import { EventEmitter } from "../../utils/EventEmitter";
import { DebouncedDoLater } from "extraterm-later";
import { MessageType, ExtensionDesiredStateMessage } from "../../WindowMessages";
import { SessionConfiguration } from "@extraterm/extraterm-extension-api";
import { SplitLayout } from "../SplitLayout";
import { ExtensionContextImpl } from "./ExtensionContextImpl";

interface ActiveExtension {
  metadata: ExtensionMetadata;
  contextImpl: InternalExtensionContext;
  publicApi: any;
  module: any;
}

const allCategories: Category[] = [
  "hyperlink",
  "textEditing",
  "terminalCursorMode",
  "terminal",
  "viewer",
  "window",
  "application",
  "global",
];

/**
 * Extension manager for the render process.
 *
 * This bridges the between the extensions and the core of the application.
 */
export class ExtensionManagerImpl implements ExtensionManager {
  private _log: Logger = null;
  private _extensionMetadata: ExtensionMetadata[] = [];
  private _activeExtensions: ActiveExtension[] = [];
  private _extensionDesiredState: ExtensionDesiredState;
  private _onStateChangedEventEmitter = new EventEmitter<void>();
  onStateChanged: ExtensionApi.Event<void>;

  extensionUiUtils: ExtensionUiUtils = null;

  private _splitLayout: SplitLayout = null;

  private _commonExtensionWindowState: CommonExtensionWindowState = {
    activeTabContent: null,
    activeTerminal: null,
    activeTextEditor: null,
    activeTabsWidget: null,
    activeViewerElement: null,
    isInputFieldFocus: false,
    activeHyperlinkURL: null,
  };

  private _onCommandsChangedEventEmitter = new EventEmitter<void>();
  onCommandsChanged: ExtensionApi.Event<void>;
  private _commandsChangedLater: DebouncedDoLater = null;

  constructor() {
    this._log = getLogger("ExtensionManager", this);
    this.onStateChanged = this._onStateChangedEventEmitter.event;
    this.onCommandsChanged = this._onCommandsChangedEventEmitter.event;
    this._commandsChangedLater = new DebouncedDoLater(() => this._onCommandsChangedEventEmitter.fire(undefined));
    this.extensionUiUtils = new ExtensionUiUtilsImpl();
  }

  setSplitLayout(splitLayout: SplitLayout): void {
    this._splitLayout = splitLayout;
  }

  startUp(): void {
    this._extensionMetadata = WebIpc.requestExtensionMetadataSync();

    this._extensionDesiredState = {};
    this._goToNewDesiredState(WebIpc.requestExtensionDesiredStateSync());

    WebIpc.registerDefaultHandler(MessageType.EXTENSION_DESIRED_STATE, (msg: ExtensionDesiredStateMessage) => {
      this._goToNewDesiredState(msg.desiredState);
    });
  }

  private _goToNewDesiredState(newExtensionDesiredState: ExtensionDesiredState): void {
    const desiredKeys = Object.keys(this._extensionDesiredState).filter(key => this._extensionDesiredState[key]);
    const newDesiredKeys = Object.keys(newExtensionDesiredState).filter(key => newExtensionDesiredState[key]);

    const disableList = _.difference(desiredKeys, newDesiredKeys);
    const enableList = _.difference(newDesiredKeys, desiredKeys);

    for (const activeExtension of this._getActiveRenderExtensions()) {
      if (disableList.indexOf(activeExtension.metadata.name) !== -1) {
        this._stopExtension(activeExtension);
      }
    }

    for (const extensionInfo of this._extensionMetadata) {
      if (enableList.indexOf(extensionInfo.name) !== -1) {
        if ( ! isMainProcessExtension(extensionInfo)) {
          this._startExtension(extensionInfo);
        }
      }
    }

    this._extensionDesiredState = newExtensionDesiredState;
    this._onStateChangedEventEmitter.fire();
  }

  private _startExtension(metadata: ExtensionMetadata): void {
    this._log.info(`Starting extension '${metadata.name}' in the render process.`);

    let module = null;
    let publicApi = null;
    let contextImpl: ExtensionContextImpl = null;

    if ( ! isMainProcessExtension(metadata)) {
      contextImpl = new ExtensionContextImpl(this, metadata, this._commonExtensionWindowState);
      if (metadata.main != null) {
        module = this._loadExtensionModule(metadata);
        if (module == null) {
          return;
        }

        try {
          publicApi = (<ExtensionApi.ExtensionModule> module).activate(contextImpl);
        } catch(ex) {
          this._log.warn(`Exception occurred while starting extensions ${metadata.name}. ${ex}`);
          return;
        }
      }
    }

    this._activeExtensions.push({metadata, publicApi, contextImpl, module});
  }

  private _loadExtensionModule(extension: ExtensionMetadata): any {
    const mainJsPath = path.join(extension.path, extension.main);
    try {
      const module = require(mainJsPath);
      return module;
    } catch(ex) {
      this._log.warn(`Unable to load ${mainJsPath}. ${ex}`);
      return null;
    }
  }

  private _stopExtension(activeExtension: ActiveExtension): void {
    this._log.info(`Stopping extension '${activeExtension.metadata.name}' in the render process.`);

    if (activeExtension.module != null) {
      try {
        const extratermModule = (<ExtensionApi.ExtensionModule> activeExtension.module);
        if (extratermModule.deactivate != null) {
          extratermModule.deactivate(true);
        }
      } catch(ex) {
        this._log.warn(`Exception occurred while deactivating extension ${activeExtension.metadata.name}. ${ex}`);
      }
    }

    this._activeExtensions = this._activeExtensions.filter(ex => ex !== activeExtension);
  }

  private _getActiveRenderExtensions(): ActiveExtension[] {
    return this._activeExtensions.filter(ae => ae.contextImpl != null);
  }

  getAllExtensions(): ExtensionMetadata[] {
    return [...this._extensionMetadata];
  }

  isExtensionRunning(name: string): boolean {
    return this._extensionDesiredState[name] === true;
  }

  enableExtension(name: string): void {
    WebIpc.enableExtension(name);
  }

  disableExtension(name: string): void {
    WebIpc.disableExtension(name);
  }

  getExtensionContextByName(name: string): InternalExtensionContext {
    for (const ext of this._activeExtensions) {
      if (ext.metadata.name === name) {
        return ext.contextImpl;
      }
    }
    return null;
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    for (const extension of this._getActiveRenderExtensions()) {
      const tag = extension.contextImpl._findViewerElementTagByMimeType(mimeType);
      if (tag !== null) {
        return tag;
      }
    }
    return null;
  }

  getAllSessionTypes(): { name: string, type: string }[] {
    return _.flatten(
      this._getActiveRenderExtensions().map(activeExtension => {
        if (activeExtension.metadata.contributes.sessionEditors != null) {
          return activeExtension.metadata.contributes.sessionEditors.map(se => ({name: se.name, type: se.type}));
        } else {
          return [];
        }
      })
    );
  }

  createSessionEditor(sessionType: string, sessionConfiguration: SessionConfiguration): InternalSessionEditor {
    const seExtensions = this._getActiveRenderExtensions().filter(ae => ae.metadata.contributes.sessionEditors != null);
    for (const extension of seExtensions) {
      const editor = extension.contextImpl._internalWindow.createSessionEditor(sessionType, sessionConfiguration);
      if (editor != null) {
        return editor;
      }
    }

    this._log.warn(`Unable to find SessionEditor for session type '${sessionType}'.`);
    return null;
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: SessionConfiguration): InternalSessionSettingsEditor[] {

    const ssExtensions = this._getActiveRenderExtensions().filter(ae => ae.metadata.contributes.sessionSettings != null);
    let settingsEditors: InternalSessionSettingsEditor[] = [];
    for (const extension of ssExtensions) {
      const newSettingsEditors = extension.contextImpl._internalWindow.createSessionSettingsEditors(sessionType,
        sessionConfiguration);
      if (newSettingsEditors != null) {
        settingsEditors = [...settingsEditors, ...newSettingsEditors];
      }
    }
    return settingsEditors;
  }

  getAllTerminalThemeFormats(): {name: string, formatName: string}[] {
    const results = [];
    for (const metadata of this._extensionMetadata) {
      for (const provider of metadata.contributes.terminalThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  getAllSyntaxThemeFormats(): {name: string, formatName: string}[] {
    const results = [];
    for (const metadata of this._extensionMetadata) {
      for (const provider of metadata.contributes.syntaxThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  getActiveTab(): HTMLElement {
    return this._commonExtensionWindowState.activeTabContent;
  }

  getActiveTerminal(): EtTerminal {
    return this._commonExtensionWindowState.activeTerminal;
  }

  getActiveTextEditor(): TextEditor {
    return this._commonExtensionWindowState.activeTextEditor;
  }

  getActiveTabContent(): HTMLElement {
    return this._commonExtensionWindowState.activeTabContent;
  }

  getActiveTabWidget(): TabWidget {
    return this._commonExtensionWindowState.activeTabsWidget;
  }

  isInputFieldFocus(): boolean {
    return this._commonExtensionWindowState.isInputFieldFocus;
  }

  queryCommands(options: CommandQueryOptions): ExtensionCommandContribution[] {
    return this.queryCommandsWithExtensionWindowState(options, this._commonExtensionWindowState);
  }

  queryCommandsWithExtensionWindowState(options: CommandQueryOptions, context: CommonExtensionWindowState): ExtensionCommandContribution[] {
    const truePredicate = (command: CommandMenuEntry): boolean => true;

    let commandPalettePredicate = truePredicate;
    if (options.commandPalette != null) {
      const commandPalette = options.commandPalette;
      commandPalettePredicate = commandEntry => commandEntry.commandPalette === commandPalette;
    }

    let contextMenuPredicate = truePredicate;
    if (options.contextMenu != null) {
      const contextMenu = options.contextMenu;
      contextMenuPredicate = command => command.contextMenu === contextMenu;
    }

    let emptyPaneMenuPredicate = truePredicate;
    if (options.emptyPaneMenu != null) {
      const emptyPaneMenu = options.emptyPaneMenu;
      emptyPaneMenuPredicate = commandEntry => commandEntry.emptyPane === emptyPaneMenu;
    }

    let newTerminalMenuPredicate = truePredicate;
    if (options.newTerminalMenu != null) {
      const newTerminalMenu = options.newTerminalMenu;
      newTerminalMenuPredicate = commandEntry => commandEntry.newTerminal === newTerminalMenu;
    }

    let terminalTabMenuPredicate = truePredicate;
    if (options.terminalTitleMenu != null) {
      const terminalTabMenu = options.terminalTitleMenu;
      terminalTabMenuPredicate = commandEntry => commandEntry.terminalTab === terminalTabMenu;
    }

    let windowMenuPredicate = truePredicate;
    if (options.windowMenu != null) {
      const windowMenu = options.windowMenu;
      windowMenuPredicate = commandEntry => commandEntry.windowMenu === windowMenu;
    }

    let categoryPredicate = truePredicate;
    if (options.categories != null) {
      const categories = options.categories;
      categoryPredicate = commandEntry => categories.indexOf(commandEntry.commandContribution.category) !== -1;
    }

    let commandPredicate = truePredicate;
    if (options.commands != null) {
      const commands = options.commands;
      commandPredicate = commandEntry => {
        return commands.indexOf(commandEntry.commandContribution.command) !== -1;
      };
    }

    const whenPredicate = options.when ? this._createWhenPredicate(context) : truePredicate;

    const entries: ExtensionCommandContribution[] = [];
    for (const activeExtension  of this._getActiveRenderExtensions()) {
      for (const [command, commandEntryList] of activeExtension.contextImpl.commands._commandToMenuEntryMap) {
        for (const commandEntry of commandEntryList) {
          if (commandPredicate(commandEntry) && commandPalettePredicate(commandEntry) &&
              contextMenuPredicate(commandEntry) && emptyPaneMenuPredicate(commandEntry) &&
              newTerminalMenuPredicate(commandEntry) && terminalTabMenuPredicate(commandEntry) &&
              windowMenuPredicate(commandEntry) && categoryPredicate(commandEntry) &&
              whenPredicate(commandEntry)) {

            const customizer = activeExtension.contextImpl.commands.getFunctionCustomizer(
                                commandEntry.commandContribution.command);
            if (customizer != null) {
              this._executeFuncWithExtensionWindowState(context, () => {
                entries.push( {...commandEntry.commandContribution, ...customizer() });
              });
            } else {
              entries.push(commandEntry.commandContribution);
            }
          }
        }
      }
    }
    this._sortCommandsInPlace(entries);
    return entries;
  }

  private _createWhenPredicate(state: CommonExtensionWindowState): (ecc: CommandMenuEntry) => boolean {
    const variables = this._createWhenVariables(state);
    const bee = new BooleanExpressionEvaluator(variables);
    return (ecc: CommandMenuEntry): boolean => {
      if (ecc.commandContribution.when === "") {
        return true;
      }
      return bee.evaluate(ecc.commandContribution.when);
    };
  }

  private _createWhenVariables(state: CommonExtensionWindowState): WhenVariables {
    const whenVariables: WhenVariables = {
      true: true,
      false: false,
      terminalFocus: false,
      isCursorMode: false,
      isNormalMode: false,
      textEditorFocus: false,
      isTextEditing: false,
      viewerFocus: false,
      isWindowSplit: this._splitLayout.isSplit(),
      isHyperlink: false,
      hyperlinkURL: null,
      hyperlinkProtocol: null,
      hyperlinkDomain: null,
      hyperlinkFileExtension: null,
    };

    if (state.activeTerminal != null) {
      whenVariables.terminalFocus = true;
      if (state.activeTerminal.getMode() === Mode.CURSOR) {
        whenVariables.isCursorMode = true;
      } else {
        whenVariables.isNormalMode = true;
      }
    } else {
      if (state.activeViewerElement) {
        whenVariables.viewerFocus = true;
      }
    }

    if (state.activeTextEditor != null) {
      if ( ! (whenVariables.terminalFocus && whenVariables.isNormalMode)) {
        whenVariables.textEditorFocus = true;
        if (state.activeTextEditor.getEditable()) {
          whenVariables.isTextEditing = true;
        }
      }
    }

    if (state.activeHyperlinkURL != null) {
      whenVariables.isHyperlink = true;
      whenVariables.hyperlinkURL = state.activeHyperlinkURL;
      try {
        const url = new URL(state.activeHyperlinkURL);
        whenVariables.hyperlinkProtocol = url.protocol;
        whenVariables.hyperlinkDomain = url.hostname;
        whenVariables.hyperlinkFileExtension = this._getExtensionFromPath(url.pathname);
      } catch (e) {
        whenVariables.hyperlinkProtocol = "";
        whenVariables.hyperlinkDomain = "";
        whenVariables.hyperlinkFileExtension = this._getExtensionFromPath(state.activeHyperlinkURL);
      }
    }
    return whenVariables;
  }

  private _getExtensionFromPath(path: string): string {
    const pathParts = path.split("/");
    const lastPathPart = pathParts[pathParts.length -1];
    if (lastPathPart.includes(".")) {
      return lastPathPart.substr(lastPathPart.lastIndexOf(".") + 1);
    }
    return "";
  }

  private _sortCommandsInPlace(entries: ExtensionCommandContribution[]): void {
    entries.sort(this._sortCompareFunc);
  }

  private _sortCompareFunc(a: ExtensionCommandContribution, b: ExtensionCommandContribution): number {
    const aIndex = allCategories.indexOf(a.category);
    const bIndex = allCategories.indexOf(b.category);
    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    }

    if (a.order !== b.order) {
      return a.order < b.order ? -1 : 1;
    }

    if (a.title !== b.title) {
      return a.title < b.title ? -1 : 1;
    }
    return 0;
  }

  /**
   * Execute a function with a different temporary extension context.
   */
  private _executeFuncWithExtensionWindowState<R>(tempState: CommonExtensionWindowState, func: () => R): R {
    const oldState = this.copyExtensionWindowState();
    this._setExtensionWindowState(tempState);
    const result = func();
    this._setExtensionWindowState(oldState);
    return result;
  }

  executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): any {
    return this._executeFuncWithExtensionWindowState(tempState, () => {
      return this.executeCommand(command, args);
    });
  }

  copyExtensionWindowState(): CommonExtensionWindowState {
    return { ...this._commonExtensionWindowState };
  }

  executeCommand(command: string, args?: any): any {
    let commandName = command;
    let argsString: string = null;

    const qIndex = command.indexOf("?");
    if (qIndex !== -1) {
      commandName = command.slice(0, qIndex);
      argsString = command.slice(qIndex+1);
    }

    const parts = commandName.split(":");
    if (parts.length !== 2) {
      this._log.warn(`Command '${command}' does have the right form. (Wrong numer of colons.)`);
      return null;
    }

    let extensionName = parts[0];
    if (extensionName === "extraterm") {
      extensionName = "internal-commands";
    }

    if (args === undefined) {
      if (argsString != null) {
        args = JSON.parse(decodeURIComponent(argsString));
      } else {
        args = {};
      }
    }

    for (const ext of this._getActiveRenderExtensions()) {
      if (ext.metadata.name === extensionName) {
        const commandFunc = ext.contextImpl.commands.getCommandFunction(commandName);
        if (commandFunc == null) {
          this._log.warn(`Unable to find command '${commandName}' in extension '${extensionName}'.`);
          return null;
        }
        return this._runCommandFunc(commandName, commandFunc, args);
      }
    }

    this._log.warn(`Unable to find extension with name '${extensionName}' for command '${commandName}'.`);
    return null;
  }

  private _runCommandFunc(name: string, commandFunc: (args: any) => any, args: any): any {
    try {
      return commandFunc(args);
    } catch(ex) {
      this._log.warn(`Command '${name}' threw an exception.`, ex);
    }
    return null;
  }

  updateExtensionWindowStateFromEvent(ev: Event): void {
    const newState = this.getExtensionWindowStateFromEvent(ev);
    this._mergeExtensionWindowState(newState);
  }

  private _mergeExtensionWindowState(newState: CommonExtensionWindowState): void {
    const state = this._commonExtensionWindowState;

    if (state.activeTabContent === newState.activeTabContent) {
      state.activeTerminal = newState.activeTerminal || state.activeTerminal;
      state.activeTextEditor = newState.activeTextEditor || state.activeTextEditor;
      state.activeViewerElement = newState.activeViewerElement || state.activeViewerElement;
    } else {
      state.activeTerminal = newState.activeTerminal;
      state.activeTextEditor = newState.activeTextEditor;
      state.activeViewerElement = newState.activeViewerElement;
    }

    state.activeTabsWidget = newState.activeTabsWidget;
    state.activeTabContent = newState.activeTabContent;
    state.isInputFieldFocus = newState.isInputFieldFocus;
    state.activeHyperlinkURL = newState.activeHyperlinkURL;
  }

  private _setExtensionWindowState(newState: CommonExtensionWindowState): void {
    for (const key in newState) {
      this._commonExtensionWindowState[key] = newState[key];
    }
  }

  getExtensionWindowStateFromEvent(ev: Event): CommonExtensionWindowState {
    const newState: CommonExtensionWindowState = {
      activeTabContent: null,
      activeTerminal: null,
      activeTextEditor: null,
      activeTabsWidget: null,
      activeViewerElement: null,
      isInputFieldFocus: false,
      activeHyperlinkURL: null,
    };

    const composedPath = ev.composedPath();
    for (const target of composedPath) {
      if (target instanceof EtTerminal) {
        newState.activeTerminal = target;
      }
      if (target instanceof TerminalViewer || target instanceof TextViewer) {
        newState.activeTextEditor = target;
      }
      if (target instanceof ViewerElement) {
        if (newState.activeViewerElement == null || newState.activeViewerElement instanceof EmbeddedViewer) {
          newState.activeViewerElement = target;
        }
      }
      if (target instanceof TabWidget) {
        newState.activeTabsWidget = target;
      }
      if (target.parentElement != null && target.parentElement.parentElement instanceof TabWidget) {
        newState.activeTabContent = <HTMLElement> target;
      }
      if (target instanceof HTMLInputElement) {
        newState.isInputFieldFocus = true;
      }
    }

    if (newState.activeViewerElement != null) {
      const extraState = newState.activeViewerElement.getPartialCommonExtensionWindowState();
      if (extraState != null && extraState.activeHyperlinkURL != null) {
        newState.activeHyperlinkURL = extraState.activeHyperlinkURL;
      }
    }

    return newState;
  }

  refocus(state: CommonExtensionWindowState): void {
    if (state.activeViewerElement != null) {
      state.activeViewerElement.focus();
      return;
    }

    if (state.activeTerminal != null) {
      state.activeTerminal.focus();
      return;
    }
  }

  newTerminalCreated(newTerminal: EtTerminal): void {
    newTerminal.addEventListener(EtTerminal.EVENT_APPENDED_VIEWER, (ev: CustomEvent) => {
      for (const extension of this._getActiveRenderExtensions()) {
        extension.contextImpl._internalWindow.terminalAppendedViewer(newTerminal, ev.detail.viewer);
      }
    });

    newTerminal.environment.onChange((changeList: string[]) => {
      for (const extension of this._getActiveRenderExtensions()) {
        extension.contextImpl._internalWindow.terminalEnvironmentChanged(newTerminal, changeList);
      }
    });

    for (const extension of this._getActiveRenderExtensions()) {
      extension.contextImpl._internalWindow.newTerminalCreated(newTerminal);
    }
  }

  createNewTerminalTabTitleWidgets(newTerminal: EtTerminal): HTMLElement[] {
    let result: HTMLElement[] = [];
    for (const extension of this._getActiveRenderExtensions()) {
      result = [...result, ...extension.contextImpl._createTabTitleWidgets(newTerminal)];
    }
    return result;
  }

  commandRegistrationChanged(): void {
    this._commandsChangedLater.trigger();
  }
}
