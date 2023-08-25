/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import * as fs from "node:fs";
import * as _ from "lodash-es";
import * as path from "node:path";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";
import { Event } from "@extraterm/extraterm-extension-api";
import { log } from "extraterm-logging";
import { QLabel } from "@nodegui/nodegui";

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionDesiredState, ExtensionCommandContribution, WhenVariables, Category } from "./ExtensionMetadata.js";
import { parsePackageJsonString } from "./PackageFileParser.js";
import { LoadedSessionBackendContribution, LoadedTerminalThemeProviderContribution } from "./ExtensionManagerTypes";
import { ConfigDatabase } from "../config/ConfigDatabase.js";
import * as InternalTypes from "../InternalTypes.js";
import { CommonExtensionWindowState } from "./CommonExtensionState.js";
import { CommandMenuEntry } from "../CommandsRegistry.js";
import { Window, WindowManager } from "../Window.js";
import { LineRangeChange, Terminal } from "../terminal/Terminal.js";
import { InternalExtensionContext, InternalSessionEditor, InternalSessionSettingsEditor } from "../InternalTypes.js";
import { InternalExtensionContextImpl } from "./InternalExtensionContextImpl.js";
import { Tab } from "../Tab.js";
import { ListPickerPopOver } from "./ListPickerPopOver.js";
import { DialogPopOver } from "./DialogPopOver.js";
import { UiStyle } from "../ui/UiStyle.js";
import { BlockFrame } from "../terminal/BlockFrame.js";
import { TerminalBlock } from "../terminal/TerminalBlock.js";
import { Block } from "../terminal/Block.js";
import { BulkFile } from "../bulk_file_handling/BulkFile.js";
import { ExtensionBlockImpl } from "./api/ExtensionBlockImpl.js";
import { LoadedSettingsTabContribution } from "./SettingsTabRegistry.js";
import { ThemeManager } from "../theme/ThemeManager.js";


interface ActiveExtension {
  metadata: ExtensionMetadata;
  publicApi: any;
  internalExtensionContext: InternalExtensionContext;
  module: any;
}

const allCategories: Category[] = [
  "hyperlink",
  "terminal",
  "viewer",
  "window",
  "application",
  "global",
];


export class ExtensionManager implements InternalTypes.ExtensionManager {
  private _log: Logger = null;

  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #uiStyle: UiStyle = null;

  #windowManager: WindowManager = null;

  #extensionMetadata: ExtensionMetadata[] = [];
  #desiredState: ExtensionDesiredState = null;

  #activeExtensions: ActiveExtension[] = [];

  #onDesiredStateChangedEventEmitter = new EventEmitter<void>();
  onDesiredStateChanged: Event<void>;

  #onExtensionActivatedEventEmitter = new EventEmitter<ExtensionMetadata>();
  onExtensionActivated: Event<ExtensionMetadata>;

  #onExtensionDeactivatedEventEmitter = new EventEmitter<ExtensionMetadata>();
  onExtensionDeactivated: Event<ExtensionMetadata>;

  #applicationVersion = "";
  #extensionPaths: string[] = null;

  #commonExtensionWindowState: CommonExtensionWindowState = {
    activeWindow: null,
    activeTerminal: null,
    activeTab: null,
    activeBlockFrame: null,
    activeHyperlinkURL: null,
  };

  #listPickerPopOver: ListPickerPopOver = null;
  #dialogPopOver: DialogPopOver = null;

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager, uiStyle: UiStyle, extensionPaths: string[],
      applicationVersion: string) {

    this._log = getLogger("ExtensionManager", this);
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
    this.#uiStyle = uiStyle;

    this.#extensionPaths = extensionPaths;
    this.onDesiredStateChanged = this.#onDesiredStateChangedEventEmitter.event;
    this.onExtensionActivated = this.#onExtensionActivatedEventEmitter.event;
    this.onExtensionDeactivated = this.#onExtensionDeactivatedEventEmitter.event;

    this.#extensionMetadata = this.#scan(this.#extensionPaths);

    // Note: We are passing `applicationVersion` in instead of getting it from `ConfigDatabase` because
    // ConfigDatabase doesn't have a system config ready in time for us to read.
    this.#applicationVersion = applicationVersion;
  }

  setWindowManager(windowManager: WindowManager): void {
    this.#windowManager = windowManager;
  }

  async startUpExtensions(activeExtensionsConfig: {[name: string]: boolean;}, startByDefault: boolean=true): Promise<void> {
    const desiredState: ExtensionDesiredState = {};
    for (const extensionInfo of this.#extensionMetadata) {
      desiredState[extensionInfo.name] = startByDefault && InternalTypes.isSupportedOnThisPlatform(extensionInfo);;
    }

    // Merge in the explicitly enabled/disabled extensions from the config.
    if (activeExtensionsConfig != null) {
      for (const key of Object.keys(activeExtensionsConfig)) {
        if (this.#getExtensionMetadataByName(key) != null) {
          desiredState[key] = activeExtensionsConfig[key];
        }
      }
    }

    for (const extensionName of Object.keys(desiredState)) {
      if (desiredState[extensionName]) {
        await this.#startExtension(this.#getExtensionMetadataByName(extensionName));
      }
    }

    this.#desiredState = desiredState;
  }

  #scan(extensionPaths: string[]): ExtensionMetadata[] {
    return _.flatten(extensionPaths.map(p => this.#scanPath(p)));
  }

  #scanPath(extensionPath: string): ExtensionMetadata[] {
    this._log.info(`Scanning '${extensionPath}' for extensions.`);
    if (fs.existsSync(extensionPath)) {
      const result: ExtensionMetadata[] = [];
      const contents = fs.readdirSync(extensionPath);
      for (const item of contents) {
        const packageJsonPath = path.join(extensionPath, item, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          const extensionInfoPath = path.join(extensionPath, item);
          const extensionInfo = this.#loadPackageJson(extensionInfoPath);
          if (extensionInfo !== null) {
            result.push(extensionInfo);
            this._log.info(`Read extension metadata from '${extensionInfoPath}'.`);
          }
        } else {
          this._log.warn(`Unable to read ${packageJsonPath}, skipping`);
        }
      }
      return result;

    } else {
      this._log.warn(`Extension path ${extensionPath} doesn't exist.`);
      return [];
    }
  }

  #loadPackageJson(extensionPath: string): ExtensionMetadata {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJsonString = fs.readFileSync(packageJsonPath, "utf8");
    try {
      const result = parsePackageJsonString(packageJsonString, extensionPath);

      const jsonTree = JSON.parse(packageJsonString);
      const readmePath = this.#getExtensionReadmePath(jsonTree, extensionPath);

      return {...result, readmePath };
    } catch(ex) {
      this._log.warn(`An error occurred while processing '${packageJsonPath}': ` + ex);
      return null;
    }
  }

  #getExtensionReadmePath(packageJsonTree: any, extensionPath: string): string {
    if (packageJsonTree.extratermReadme != null) {
      return path.join(extensionPath, packageJsonTree.extratermReadme);
    } else {
      const entries = fs.readdirSync(extensionPath);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith("readme.")) {
          return path.join(extensionPath, entry);
        }
      }
      return null;
    }
  }

  #getExtensionMetadataByName(name: string): ExtensionMetadata {
    for (const extensionInfo of this.#extensionMetadata) {
      if (extensionInfo.name === name) {
        return extensionInfo;
      }
    }
    return null;
  }

  async #startExtension(metadata: ExtensionMetadata): Promise<ActiveExtension> {
    let module = null;
    let publicApi = null;

    this._log.info(`Starting extension '${metadata.name}'`);

    const internalExtensionContext = new InternalExtensionContextImpl(this, metadata, this.#configDatabase,
      this.#themeManager, this.#applicationVersion);

    if (metadata.exports != null) {
      module = await this.#loadExtensionModule(metadata);
      if (module == null) {
        return null;
      }
      try {
        publicApi = (<ExtensionApi.ExtensionModule> module).activate(internalExtensionContext.getExtensionContext());
      } catch(ex) {
        this._log.warn(`Exception occurred while activating extension ${metadata.name}. ${ex}`);
        return null;
      }
    }
    const activeExtension: ActiveExtension = {metadata, publicApi, internalExtensionContext, module};
    this.#activeExtensions.push(activeExtension);
    this.#onExtensionActivatedEventEmitter.fire(activeExtension.metadata);
    return activeExtension;
  }

  async #loadExtensionModule(extension: ExtensionMetadata): Promise<any> {
    const mainJsPath = path.join(extension.path, extension.exports);
    try {
      const module = await import("file://" + mainJsPath);
      return module;
    } catch(ex) {
      this._log.warn(`Unable to load ${mainJsPath}. ${ex}`);
      return null;
    }
  }

  #stopExtension(activeExtension: ActiveExtension): void {
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

    activeExtension.internalExtensionContext.dispose();
    this.#activeExtensions = this.#activeExtensions.filter(ex => ex !== activeExtension);
    this.#onExtensionDeactivatedEventEmitter.fire(activeExtension.metadata);
  }

  getAllExtensions(): ExtensionMetadata[] {
    return this.#extensionMetadata;
  }

  getActiveExtensions(): ExtensionMetadata[] {
    return this.#activeExtensions.map(ae => ae.metadata);
  }

  getExtensionContextByName(name: string): InternalTypes.InternalExtensionContext {
    const extension = this.#getActiveExtension(name);
    return extension != null ? extension.internalExtensionContext : null;
  }

  getExtensionContextByCommandName(commandName: string): InternalTypes.InternalExtensionContext {
    const parts = commandName.split(":");
    let extensionName = parts[0];
    if (extensionName === "extraterm") {
      extensionName = "internal-commands";
    }
    return this.getExtensionContextByName(extensionName);
  }

  async enableExtension(name: string): Promise<void> {
    const metadata = this.#getExtensionMetadataByName(name);
    if (metadata == null) {
      this._log.warn(`Unable to find extensions metadata for name '${name}'.`);
      return;
    }

    const activeExtension = this.#getActiveExtension(name);
    if (activeExtension != null) {
      this._log.warn(`Tried to enable active extension '${name}'.`);
      return;
    }

    await this.#startExtension(metadata);

    const generalConfig = this.#configDatabase.getGeneralConfigCopy();
    generalConfig.activeExtensions[metadata.name] = true;
    this.#configDatabase.setGeneralConfig(generalConfig);

    const desiredState = {...this.#desiredState};
    desiredState[metadata.name] = true;
    this.#desiredState = desiredState;

    this.#onDesiredStateChangedEventEmitter.fire();
  }

  #getActiveExtension(name: string): ActiveExtension {
    for (const extension of this.#activeExtensions) {
      if (extension.metadata.name === name) {
        return extension;
      }
    }
    return null;
  }

  async disableExtension(name: string): Promise<void> {
    const metadata = this.#getExtensionMetadataByName(name);
    if (metadata == null) {
      this._log.warn(`Unable to find extensions metadata for name '${name}'.`);
      return;
    }

    const activeExtension = this.#getActiveExtension(name);
    if (activeExtension == null) {
      this._log.warn(`Tried to disable inactive extension '${name}'.`);
      return;
    }

    this.#stopExtension(activeExtension);

    const desiredState = {...this.#desiredState};
    desiredState[metadata.name] = false;
    this.#desiredState = desiredState;

    const generalConfig = this.#configDatabase.getGeneralConfigCopy();
    generalConfig.activeExtensions[metadata.name] = false;
    this.#configDatabase.setGeneralConfig(generalConfig);

    this.#onDesiredStateChangedEventEmitter.fire();
  }

  isExtensionEnabled(name: string): boolean {
    return this.#getActiveExtension(name) != null;
  }

  getDesiredState(): ExtensionDesiredState {
    return this.#desiredState;
  }

  #getActiveBackendExtensions(): ActiveExtension[] {
    return this.#activeExtensions.filter(ae => ae.internalExtensionContext != null);
  }

  getSessionBackendContributions(): LoadedSessionBackendContribution[] {
    return _.flatten(this.#getActiveBackendExtensions().map(
      ae => ae.internalExtensionContext.getSessionBackends()));
  }

  getSessionBackend(type: string): ExtensionApi.SessionBackend {
    for (const extension of this.#getActiveBackendExtensions()) {
      for (const backend of extension.internalExtensionContext.getSessionBackends()) {
        if (backend.sessionBackendMetadata.type === type) {
          return backend.sessionBackend;
        }
      }
    }
    return null;
  }

  getAllSessionTypes(): { name: string, type: string }[] {
    return _.flatten(
      this.#activeExtensions.map(activeExtension => {
        if (activeExtension.metadata.contributes.sessionEditors != null) {
          return activeExtension.metadata.contributes.sessionEditors.map(se => ({name: se.name, type: se.type}));
        } else {
          return [];
        }
      })
    );
  }

  createExtensionBlockByName(terminal: Terminal, extensionName: string, blockName: string, args?: any): Block {
    for (const ae of this.#activeExtensions) {
      const blockMetadata = ae.metadata.contributes.blocks;
      if (blockMetadata.length === 0) {
        continue;
      }

      for (const blockContribution of blockMetadata) {
        if (blockContribution.name === blockName) {
          return ae.internalExtensionContext.blockRegistry.createExtensionBlock(terminal, blockContribution.name, null,
            args);
        }
      }
    }
    return null;
  }

  createExtensionBlockWithBulkFile(terminal: Terminal, fileMimeType: string, bulkFile: BulkFile): Block {
    const block = this.#createExtensionBlockByMimeType(terminal, fileMimeType, bulkFile);
    if (block != null) {
      return block;
    }
    return this.#createExtensionBlockByMimeType(terminal, "application/octet-stream", bulkFile);
  }

  #createExtensionBlockByMimeType(terminal: Terminal, fileMimeType: string, bulkFile: BulkFile): Block {
    for (const ae of this.#activeExtensions) {
      const blockMetadata = ae.metadata.contributes.blocks;
      if (blockMetadata.length === 0) {
        continue;
      }

      for (const blockContribution of blockMetadata) {
        for (const mimeType of blockContribution.mimeTypes) {
          if (fileMimeType === mimeType) {
            return ae.internalExtensionContext.blockRegistry.createExtensionBlock(terminal, blockContribution.name, bulkFile);
          }
        }
      }
    }
    return null;
  }

  createTabTitleWidgets(terminal: Terminal): QLabel[] {
    const ttExtensions = this.#activeExtensions.filter(ae => ae.metadata.contributes.tabTitleWidgets.length !== 0);
    let tabTitleWidgets: QLabel[] = [];
    for (const extension of ttExtensions) {
      const wrappedTerminal = extension.internalExtensionContext.wrapTerminal(terminal);
      const newTabTitleWidgets = extension.internalExtensionContext.tabTitleWidgetRegistry.createTabTitleWidgets(wrappedTerminal);
      if (newTabTitleWidgets != null) {
        tabTitleWidgets = [...tabTitleWidgets, ...newTabTitleWidgets];
      }
    }
    return tabTitleWidgets;
  }

  createSessionEditor(sessionType: string, sessionConfiguration: ExtensionApi.SessionConfiguration): InternalSessionEditor {
    const seExtensions = this.#activeExtensions.filter(ae => ae.metadata.contributes.sessionEditors.length !==0);
    for (const extension of seExtensions) {
      const editor = extension.internalExtensionContext.sessionEditorRegistry.createSessionEditor(sessionType, sessionConfiguration);
      if (editor != null) {
        return editor;
      }
    }

    this._log.warn(`Unable to find SessionEditor for session type '${sessionType}'.`);
    return null;
  }

  createSessionSettingsEditors(sessionType: string,
      sessionConfiguration: ExtensionApi.SessionConfiguration, window: Window): InternalSessionSettingsEditor[] {

    const ssExtensions = this.#activeExtensions.filter(ae => ae.metadata.contributes.sessionSettings != null);
    let settingsEditors: InternalSessionSettingsEditor[] = [];
    for (const extension of ssExtensions) {
      const newSettingsEditors = extension.internalExtensionContext.sessionSettingsEditorRegistry
        .createSessionSettingsEditors(sessionType, sessionConfiguration, window);
      if (newSettingsEditors != null) {
        settingsEditors = [...settingsEditors, ...newSettingsEditors];
      }
    }
    return settingsEditors;
  }

  getTerminalThemeProviderContributions(): LoadedTerminalThemeProviderContribution[] {
    return _.flatten(this.#getActiveBackendExtensions().map(
      ae => ae.internalExtensionContext.getTerminalThemeProviders()));
  }

  hasCommand(command: string): boolean {
    return this.#getCommand(command) != null;
  }

  #getExtensionNameFromCommand(command: string): string {
    const parts = command.split(":");
    if (parts.length !== 2) {
      this._log.warn(`Command '${command}' does have the right form. (Wrong numer of colons.)`);
      return null;
    }

    let extensionName = parts[0];
    if (extensionName === "extraterm") {
      extensionName = "internal-commands";
    }
    return extensionName;
  }

  #getCommand(command: string): (args: any) => Promise<any> {
    const extensionName = this.#getExtensionNameFromCommand(command);
    const ext = this.#getActiveExtension(extensionName);
    if (ext == null) {
      return null;
    }
    return ext.internalExtensionContext.commands.getCommandFunction(command);
  }

  setActiveWindow(window: Window): void {
    this.#commonExtensionWindowState.activeWindow = window;
  }

  getActiveWindow(): Window {
    return this.#commonExtensionWindowState.activeWindow;
  }

  setActiveTab(tab: Tab): void {
    this.#commonExtensionWindowState.activeTab = tab;
  }

  getActiveTab(): Tab {
    return this.#commonExtensionWindowState.activeTab;
  }

  setActiveTerminal(terminal: Terminal): void {
    this.#commonExtensionWindowState.activeTerminal = terminal;
  }

  getActiveTerminal(): Terminal {
    return this.#commonExtensionWindowState.activeTerminal;
  }

  setActiveBlockFrame(blockFrame: BlockFrame): void {
    this.#commonExtensionWindowState.activeBlockFrame = blockFrame;
  }

  getActiveBlockFrame(): BlockFrame {
    return this.#commonExtensionWindowState.activeBlockFrame;
  }

  getActiveHyperlinkURL(): string {
    return this.#commonExtensionWindowState.activeHyperlinkURL;
  }

  setActiveHyperlinkURL(url: string): void {
    this.#commonExtensionWindowState.activeHyperlinkURL = url;
  }

  getAllTerminalThemeFormats(): {name: string, formatName: string}[] {
    const results = [];
    for (const metadata of this.#extensionMetadata) {
      for (const provider of metadata.contributes.terminalThemeProviders) {
        for (const formatName of provider.humanFormatNames) {
          results.push( { name: provider.name, formatName } );
        }
      }
    }
    return results;
  }

  getWindowForTab(tab: Tab): Window {
    for (const window of this.#windowManager.getAllWindows()) {
      if (window.hasTab(tab)) {
        return window;
      }
    }
    return null;
  }

  copyExtensionWindowState(): CommonExtensionWindowState {
    return { ...this.#commonExtensionWindowState };
  }

  async executeCommand(command: string, args?: any): Promise<any> {
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

    const internalExtensionContext = this.getExtensionContextByName(extensionName);
    if (internalExtensionContext != null) {
      const commandFunc = internalExtensionContext.commands.getCommandFunction(commandName);
      if (commandFunc == null) {
        throw new Error(`Unable to find command '${commandName}' in extension '${extensionName}'.`);
      }

      if (args === undefined) {
        if (argsString != null) {
          args = JSON.parse(decodeURIComponent(argsString));
        } else {
          args = {};
        }
      }

      return await this.#runCommandFunc(commandName, commandFunc, args);
    }

    throw new Error(`Unable to find extension with name '${extensionName}' for command '${commandName}'.`);
  }

  executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): Promise<any> {
    const extensionContext: InternalExtensionContext = this.getExtensionContextByCommandName(command);

    let result: Promise<any> = undefined;
    this.#executeFuncWithExtensionWindowState(extensionContext, tempState, () => {
      result = this.executeCommand(command, args);
    });
    return result;
  }

  /**
   * Execute a function with a different temporary extension context.
   */
  #executeFuncWithExtensionWindowState(extensionContext: InternalExtensionContext, tempState: CommonExtensionWindowState, func: () => any): any {
    const oldOverride = extensionContext.getOverrideWindowState();
    extensionContext.setOverrideWindowState(tempState);
    try {
      return func();
    } finally {
      extensionContext.setOverrideWindowState(oldOverride);
    }
  }

  async #runCommandFunc(name: string, commandFunc: (args: any) => Promise<any>, args: any): Promise<any> {
    try {
      return await commandFunc(args);
    } catch(ex) {
      this._log.warn(`Command '${name}' threw an exception.`, ex);
      return ex;
    }
  }

  queryCommands(options: InternalTypes.CommandQueryOptions): ExtensionCommandContribution[] {
    return this.queryCommandsWithExtensionWindowState(options, this.#commonExtensionWindowState);
  }

  queryCommandsWithExtensionWindowState(options: InternalTypes.CommandQueryOptions, context: CommonExtensionWindowState): ExtensionCommandContribution[] {
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

    const whenPredicate = options.when ? this.#createWhenPredicate(context) : truePredicate;

    const entries: ExtensionCommandContribution[] = [];
    for (const activeExtension  of this.#activeExtensions) {
      for (const [command, commandEntryList] of activeExtension.internalExtensionContext.commands.getCommandToMenuEntryMap()) {
        for (const commandEntry of commandEntryList) {
          if (commandPredicate(commandEntry) && commandPalettePredicate(commandEntry) &&
              contextMenuPredicate(commandEntry) && newTerminalMenuPredicate(commandEntry) &&
              terminalTabMenuPredicate(commandEntry) && windowMenuPredicate(commandEntry) &&
              categoryPredicate(commandEntry) &&
              whenPredicate(commandEntry)) {

            const customizer = activeExtension.internalExtensionContext.commands.getFunctionCustomizer(
                                commandEntry.commandContribution.command);
            if (customizer != null) {
              this.#executeFuncWithExtensionWindowState(activeExtension.internalExtensionContext, context,
                () => {
                  entries.push({...commandEntry.commandContribution, ...customizer()});
                });
            } else {
              entries.push(commandEntry.commandContribution);
            }
          }
        }
      }
    }
    this.#sortCommandsInPlace(entries);
    return entries;
  }

  #createWhenPredicate(state: CommonExtensionWindowState): (ecc: CommandMenuEntry) => boolean {
    const variables = this.#createWhenVariables(state);
    const bee = new BooleanExpressionEvaluator(variables);
    return (ecc: CommandMenuEntry): boolean => {
      if (ecc.commandContribution.when === "") {
        return true;
      }
      return bee.evaluate(ecc.commandContribution.when);
    };
  }

  #createWhenVariables(state: CommonExtensionWindowState): WhenVariables {
    const whenVariables: WhenVariables = {
      true: true,
      false: false,
      tabFocus: false,
      terminalFocus: false,
      connectedTerminalFocus: false,
      blockFocus: false,
      blockType: null,
      isHyperlink: false,
      hyperlinkURL: null,
      hyperlinkProtocol: null,
      hyperlinkDomain: null,
      hyperlinkFileExtension: null,
    };

    whenVariables.tabFocus = state.activeTab != null;

    if (state.activeTerminal != null) {
      whenVariables.terminalFocus = true;
      whenVariables.connectedTerminalFocus = state.activeTerminal.getPty() != null;
    }

    if (state.activeBlockFrame != null) {
      whenVariables.blockFocus = true;
      const block = state.activeBlockFrame.getBlock();
      if (block instanceof TerminalBlock) {
        whenVariables.blockType = ExtensionApi.TerminalOutputType;
      } else if (block instanceof ExtensionBlockImpl) {
        whenVariables.blockType = block.getBlockTypeName();
      }
    }

    if (state.activeHyperlinkURL != null) {
      whenVariables.isHyperlink = true;
      whenVariables.hyperlinkURL = state.activeHyperlinkURL;
      try {
        const url = new URL(state.activeHyperlinkURL);
        whenVariables.hyperlinkProtocol = url.protocol;
        whenVariables.hyperlinkDomain = url.hostname;
        whenVariables.hyperlinkFileExtension = this.#getExtensionFromPath(url.pathname);
      } catch (e) {
        whenVariables.hyperlinkProtocol = "";
        whenVariables.hyperlinkDomain = "";
        whenVariables.hyperlinkFileExtension = this.#getExtensionFromPath(state.activeHyperlinkURL);
      }
    }
    return whenVariables;
  }

  #getExtensionFromPath(path: string): string {
    const pathParts = path.split("/");
    const lastPathPart = pathParts[pathParts.length -1];
    if (lastPathPart.includes(".")) {
      return lastPathPart.substr(lastPathPart.lastIndexOf(".") + 1);
    }
    return "";
  }

  #sortCommandsInPlace(entries: ExtensionCommandContribution[]): void {
    entries.sort(this.#sortCompareFunc);
  }

  #sortCompareFunc(a: ExtensionCommandContribution, b: ExtensionCommandContribution): number {
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

  newTerminalCreated(window: Window, newTerminal: Terminal): void {

    // newTerminal.addEventListener(EtTerminal.EVENT_APPENDED_VIEWER, (ev: CustomEvent) => {
    //   for (const extension of this._getActiveRenderExtensions()) {
    //     extension.contextImpl._internalWindow.terminalAppendedViewer(newTerminal, ev.detail.viewer);
    //   }
    // });

    newTerminal.environment.onChange((changeList: string[]) => {
      for (const extension of this.#activeExtensions) {
        extension.internalExtensionContext.terminalEnvironmentChanged(newTerminal, changeList);
      }
    });

    newTerminal.onDidAppendScrollbackLines((ev: LineRangeChange) => {
      for (const activeExtension of this.#activeExtensions) {
        activeExtension.internalExtensionContext.terminalDidAppendScrollbackLines(newTerminal, ev);
      }
    });

    newTerminal.onDidScreenChange((ev: LineRangeChange) => {
      for (const activeExtension of this.#activeExtensions) {
        activeExtension.internalExtensionContext.terminalDidScreenChange(newTerminal, ev);
      }
    });

    newTerminal.onDispose(() => {
      if (this.#commonExtensionWindowState.activeTerminal === newTerminal) {
        this.#commonExtensionWindowState.activeTerminal = null;
      }
    });

    for (const activeExtension of this.#activeExtensions) {
      activeExtension.internalExtensionContext.newTerminalCreated(window, newTerminal);
    }
  }

  newWindowCreated(window: Window): void {
    for (const activeExtension of this.#activeExtensions) {
      activeExtension.internalExtensionContext.newWindowCreated(window);
    }
  }

  getAllWindows(): Window[] {
    return this.#windowManager == null ? [] : this.#windowManager.getAllWindows();
  }

  async showDialog(tab: Tab, options: ExtensionApi.DialogOptions): Promise<number | undefined> {
    if (this.#dialogPopOver == null) {
      this.#dialogPopOver = new DialogPopOver(this.#uiStyle);
    }
    const win = this.getWindowForTab(tab);
    return this.#dialogPopOver.show(win, {...options, containingRect: win.getTabGlobalGeometry(tab)});
  }

  async showListPicker(tab: Tab, options: ExtensionApi.ListPickerOptions): Promise<number> {
    if (this.#listPickerPopOver == null) {
      this.#listPickerPopOver = new ListPickerPopOver(this.#uiStyle);
    }
    const win = this.getWindowForTab(tab);
    return this.#listPickerPopOver.show(win, {...options, containingRect: win.getTabGlobalGeometry(tab)});
  }

  async showOnCursorListPicker(terminal: Terminal, options: ExtensionApi.ListPickerOptions): Promise<number> {
    if (this.#listPickerPopOver == null) {
      this.#listPickerPopOver = new ListPickerPopOver(this.#uiStyle);
    }
    for (const win of this.#windowManager.getAllWindows()) {
      win.getTerminals().includes(terminal);
    }
    const win = this.getWindowForTab(terminal);

    const geo = terminal.getCursorGlobalGeometry();
    if (geo == null) {
      return Promise.reject();
    }
    return this.#listPickerPopOver.show(win, {...options, aroundRect: geo});
  }

  getSettingsTabContributions(): LoadedSettingsTabContribution[] {
    return _.flatten(
      this.#activeExtensions.map(activeExtension => {
        return activeExtension.internalExtensionContext.settingsTabRegistry.getSettingsTabContributions();
      })
    );
  }
}
