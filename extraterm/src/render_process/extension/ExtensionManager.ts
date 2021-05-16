/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import * as _ from "lodash";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";

import { Logger, getLogger, log } from "extraterm-logging";
import { EtTerminal, LineRangeChange } from "../Terminal";
import { TextViewer } from"../viewers/TextAceViewer";
import { ExtensionManager, ExtensionUiUtils, InternalExtensionContext,
  isMainProcessExtension, CommandQueryOptions, InternalSessionSettingsEditor, InternalSessionEditor, ViewerTabDisplay } from "./InternalTypes";
import { ExtensionUiUtilsImpl } from "./ExtensionUiUtilsImpl";
import { ExtensionMetadata, ExtensionCommandContribution, Category, WhenVariables, ExtensionDesiredState
} from "../../ExtensionMetadata";
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
import { SessionConfiguration } from "@extraterm/extraterm-extension-api";
import { SplitLayout } from "../SplitLayout";
import { ExtensionContextImpl } from "./ExtensionContextImpl";
import { focusElement } from "../DomUtils";
import { ConfigDatabase } from "../../ConfigDatabase";
import * as SharedMap from "../../shared_map/SharedMap";
import { ExtensionManagerIpc } from "../../ExtensionManagerIpc";

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

  #ipc: ExtensionManagerIpc = null;
  #activeExtensions: ActiveExtension[] = [];
  #extensionLocalState: ExtensionDesiredState;
  #splitLayout: SplitLayout = null;
  #viewerTabDisplay: ViewerTabDisplay = null;
  #configDatabase: ConfigDatabase = null;

  #onStateChangedEventEmitter = new EventEmitter<void>();
  onStateChanged: ExtensionApi.Event<void>;

  extensionUiUtils: ExtensionUiUtils = null;

  #commonExtensionWindowState: CommonExtensionWindowState = {
    activeTabContent: null,
    activeTerminal: null,
    activeTextEditor: null,
    activeTabsWidget: null,
    activeViewerElement: null,
    isInputFieldFocus: false,
    activeHyperlinkURL: null,
  };

  #onCommandsChangedEventEmitter = new EventEmitter<void>();
  onCommandsChanged: ExtensionApi.Event<void>;
  #commandsChangedLater: DebouncedDoLater = null;

  constructor(configDatabase: ConfigDatabase, sharedMap: SharedMap.SharedMap) {
    this._log = getLogger("ExtensionManager", this);
    this.#configDatabase = configDatabase;
    this.#ipc = new ExtensionManagerIpc(sharedMap);

    this.onStateChanged = this.#onStateChangedEventEmitter.event;
    this.onCommandsChanged = this.#onCommandsChangedEventEmitter.event;
    this.#commandsChangedLater = new DebouncedDoLater(() => this.#onCommandsChangedEventEmitter.fire(undefined));
    this.extensionUiUtils = new ExtensionUiUtilsImpl();
  }

  setSplitLayout(splitLayout: SplitLayout): void {
    this.#splitLayout = splitLayout;
  }

  setViewerTabDisplay(viewerTabDisplay: ViewerTabDisplay): void {
    this.#viewerTabDisplay = viewerTabDisplay;
  }

  getViewerTabDisplay(): ViewerTabDisplay {
    return this.#viewerTabDisplay;
  }

  startUp(): void {
    this.#extensionLocalState = {};

    this._goToNewDesiredState(this.#ipc.getDesiredState());
    this.#ipc.onDesiredStateChange(() => {
      this._goToNewDesiredState(this.#ipc.getDesiredState());
    });
  }

  private _goToNewDesiredState(newExtensionDesiredState: ExtensionDesiredState): void {
    const desiredKeys = Object.keys(this.#extensionLocalState).filter(key => this.#extensionLocalState[key]);
    const newDesiredKeys = Object.keys(newExtensionDesiredState).filter(key => newExtensionDesiredState[key]);

    const disableList = _.difference(desiredKeys, newDesiredKeys);
    const enableList = _.difference(newDesiredKeys, desiredKeys);

    for (const activeExtension of this._getActiveRenderExtensions()) {
      if (disableList.indexOf(activeExtension.metadata.name) !== -1) {
        this._stopExtension(activeExtension);
      }
    }

    for (const extensionInfo of this.#ipc.getExtensionMetadata()) {
      if (enableList.indexOf(extensionInfo.name) !== -1) {
        if ( ! isMainProcessExtension(extensionInfo)) {
          this._startExtension(extensionInfo);
        }
      }
    }

    this.#extensionLocalState = newExtensionDesiredState;
    this.#onStateChangedEventEmitter.fire();
  }

  private _startExtension(metadata: ExtensionMetadata): void {
    this._log.info(`Starting extension '${metadata.name}' in the render process.`);

    let module = null;
    let publicApi = null;
    let contextImpl: ExtensionContextImpl = null;

    if ( ! isMainProcessExtension(metadata)) {

      const applicationVersion = this.#configDatabase.getSystemConfig().applicationVersion;
      contextImpl = new ExtensionContextImpl(this, metadata, this.#commonExtensionWindowState, applicationVersion);
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

    this.#activeExtensions.push({metadata, publicApi, contextImpl, module});
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

    this.#activeExtensions = this.#activeExtensions.filter(ex => ex !== activeExtension);
  }

  private _getActiveRenderExtensions(): ActiveExtension[] {
    return this.#activeExtensions.filter(ae => ae.contextImpl != null);
  }

  getAllExtensions(): ExtensionMetadata[] {
    return [...this.#ipc.getExtensionMetadata()];
  }

  isExtensionRunning(name: string): boolean {
    return this.#extensionLocalState[name] === true;
  }

  enableExtension(name: string): void {
    this.#ipc.enableExtension(name);
  }

  disableExtension(name: string): void {
    this.#ipc.disableExtension(name);
  }

  getExtensionContextByName(name: string): InternalExtensionContext {
    for (const ext of this.#activeExtensions) {
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
    for (const metadata of this.#ipc.getExtensionMetadata()) {
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
    for (const metadata of this.#ipc.getExtensionMetadata()) {
      for (const provider of metadata.contributes.syntaxThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  getActiveTab(): HTMLElement {
    return this.#commonExtensionWindowState.activeTabContent;
  }

  getActiveTerminal(): EtTerminal {
    return this.#commonExtensionWindowState.activeTerminal;
  }

  getActiveTextEditor(): TextEditor {
    return this.#commonExtensionWindowState.activeTextEditor;
  }

  getActiveTabContent(): HTMLElement {
    return this.#commonExtensionWindowState.activeTabContent;
  }

  getActiveTabWidget(): TabWidget {
    return this.#commonExtensionWindowState.activeTabsWidget;
  }

  isInputFieldFocus(): boolean {
    return this.#commonExtensionWindowState.isInputFieldFocus;
  }

  queryCommands(options: CommandQueryOptions): ExtensionCommandContribution[] {
    return this.queryCommandsWithExtensionWindowState(options, this.#commonExtensionWindowState);
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
      isWindowSplit: this.#splitLayout.isSplit(),
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
    return { ...this.#commonExtensionWindowState };
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
      throw new Error(`Command '${command}' does have the right form. (Wrong numer of colons.)`);
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
          throw new Error(`Unable to find command '${commandName}' in extension '${extensionName}'.`);
        }
        return this._runCommandFunc(commandName, commandFunc, args);
      }
    }

    throw new Error(`Unable to find extension with name '${extensionName}' for command '${commandName}'.`);
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
    const state = this.#commonExtensionWindowState;

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
      this.#commonExtensionWindowState[key] = newState[key];
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
      focusElement(state.activeViewerElement, this._log);
      return;
    }

    if (state.activeTerminal != null) {
      focusElement(state.activeTerminal, this._log);
      return;
    }
  }

  newTerminalCreated(newTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
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

    newTerminal.onDidAppendScrollbackLines((ev: LineRangeChange) => {
      for (const extension of this._getActiveRenderExtensions()) {
        extension.contextImpl._internalWindow.terminalDidAppendScrollbackLines(newTerminal, ev);
      }
    });

    newTerminal.onDidScreenChange((ev: LineRangeChange) => {
      for (const extension of this._getActiveRenderExtensions()) {
        extension.contextImpl._internalWindow.terminalDidScreenChange(newTerminal, ev);
      }
    });

    for (const extension of this._getActiveRenderExtensions()) {
      extension.contextImpl._internalWindow.newTerminalCreated(newTerminal, allTerminals);
    }
  }

  terminalDestroyed(deadTerminal: EtTerminal, allTerminals: EtTerminal[]): void {
    for (const extension of this._getActiveRenderExtensions()) {
      extension.contextImpl._internalWindow.terminalDestroyed(deadTerminal, allTerminals);
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
    this.#commandsChangedLater.trigger();
  }
}
