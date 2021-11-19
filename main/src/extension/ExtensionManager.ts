/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { EventEmitter } from "extraterm-event-emitter";
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import { BooleanExpressionEvaluator } from "extraterm-boolean-expression-evaluator";

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionDesiredState, ExtensionCommandContribution, WhenVariables, Category } from "./ExtensionMetadata";
import { parsePackageJsonString } from "./PackageFileParser";
import { Event } from "@extraterm/extraterm-extension-api";
import { log } from "extraterm-logging";
import { ExtensionContextImpl } from "./ExtensionContextImpl";
import { LoadedSessionBackendContribution, LoadedTerminalThemeProviderContribution } from "./ExtensionManagerTypes";
import { ConfigDatabase } from "../config/ConfigDatabase";
import * as InternalTypes from "../InternalTypes";
import { CommonExtensionWindowState } from "./CommonExtensionState";
import { CommandMenuEntry } from "../CommandsRegistry";
import { Window } from "../Window";
import { LineRangeChange, Terminal } from "../terminal/Terminal";


interface ActiveExtension {
  metadata: ExtensionMetadata;
  publicApi: any;
  contextImpl: ExtensionContextImpl;
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

  #extensionMetadata: ExtensionMetadata[] = [];
  #desiredState: ExtensionDesiredState = null;

  #activeExtensions: ActiveExtension[] = [];
  #desiredStateChangeEventEmitter = new EventEmitter<void>();
  #applicationVersion = "";
  onDesiredStateChanged: Event<void>;
  #extensionPaths: string[] = null;

  #commonExtensionWindowState: CommonExtensionWindowState = {
    // activeTabContent: null,
    activeWindow: null,
    activeTerminal: null,
    // activeTabsWidget: null,
    // activeViewerElement: null,
    // isInputFieldFocus: false,
    activeHyperlinkURL: null,
  };

  constructor(configDatabase: ConfigDatabase, extensionPaths: string[],
      applicationVersion: string) {

    this._log = getLogger("ExtensionManager", this);
    this.#configDatabase = configDatabase;

    this.#extensionPaths = extensionPaths;
    this.onDesiredStateChanged = this.#desiredStateChangeEventEmitter.event;

    this.#extensionMetadata = this.#scan(this.#extensionPaths);

    // Note: We are passing `applicationVersion` in instead of getting it from `ConfigDatabase` because
    // ConfigDatabase doesn't have a system config ready in time for us to read.
    this.#applicationVersion = applicationVersion;
  }

  startUpExtensions(activeExtensionsConfig: {[name: string]: boolean;}, startByDefault: boolean=true): void {
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
        this.#startExtension(this.#getExtensionMetadataByName(extensionName));
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

  #startExtension(metadata: ExtensionMetadata): ActiveExtension {
    let module = null;
    let publicApi = null;
    let contextImpl: ExtensionContextImpl = null;

    this._log.info(`Starting extension '${metadata.name}'`);

    contextImpl = new ExtensionContextImpl(this, metadata, this.#configDatabase, this.#commonExtensionWindowState,
      this.#applicationVersion);
    if (metadata.main != null) {
      module = this.#loadExtensionModule(metadata);
      if (module == null) {
        return null;
      }
      try {
        publicApi = (<ExtensionApi.ExtensionModule> module).activate(contextImpl);
      } catch(ex) {
        this._log.warn(`Exception occurred while activating extension ${metadata.name}. ${ex}`);
        return null;
      }
    }
    const activeExtension: ActiveExtension = {metadata, publicApi, contextImpl, module};
    this.#activeExtensions.push(activeExtension);
    return activeExtension;
  }

  #loadExtensionModule(extension: ExtensionMetadata): any {
    const mainJsPath = path.join(extension.path, extension.main);
    try {
      const module = require(mainJsPath);
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

    activeExtension.contextImpl.dispose();
    this.#activeExtensions = this.#activeExtensions.filter(ex => ex !== activeExtension);
  }

  getAllExtensions(): ExtensionMetadata[] {
    return this.#extensionMetadata;
  }

  getActiveExtensions(): ExtensionMetadata[] {
    return this.#activeExtensions.map(ae => ae.metadata);
  }

  getExtensionContextByName(name: string): InternalTypes.InternalExtensionContext {
    const extension = this.#getActiveExtension(name);
    return extension != null ? extension.contextImpl : null;
  }

  enableExtension(name: string): void {
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

    this.#startExtension(metadata);

    const generalConfig = this.#configDatabase.getGeneralConfigCopy();
    generalConfig.activeExtensions[metadata.name] = true;
    this.#configDatabase.setGeneralConfig(generalConfig);

    const desiredState = {...this.#desiredState};
    desiredState[metadata.name] = true;
    this.#desiredState = desiredState;

    this.#desiredStateChangeEventEmitter.fire();
  }

  #getActiveExtension(name: string): ActiveExtension {
    for (const extension of this.#activeExtensions) {
      if (extension.metadata.name === name) {
        return extension;
      }
    }
    return null;
  }

  disableExtension(name: string): void {
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

    this.#desiredStateChangeEventEmitter.fire();
  }

  isExtensionEnabled(name: string): boolean {
    return this.#getActiveExtension(name) != null;
  }

  getDesiredState(): ExtensionDesiredState {
    return this.#desiredState;
  }

  #getActiveBackendExtensions(): ActiveExtension[] {
    return this.#activeExtensions.filter(ae => ae.contextImpl != null);
  }

  getSessionBackendContributions(): LoadedSessionBackendContribution[] {
    return _.flatten(this.#getActiveBackendExtensions().map(
      ae => ae.contextImpl._internalBackend._sessionBackends));
  }

  getSessionBackend(type: string): ExtensionApi.SessionBackend {
    for (const extension of this.#getActiveBackendExtensions()) {
      for (const backend of extension.contextImpl._internalBackend._sessionBackends) {
        if (backend.sessionBackendMetadata.type === type) {
          return backend.sessionBackend;
        }
      }
    }
    return null;
  }

  getTerminalThemeProviderContributions(): LoadedTerminalThemeProviderContribution[] {
    return _.flatten(this.#getActiveBackendExtensions().map(
      ae => ae.contextImpl._internalBackend._terminalThemeProviders));
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

  #getCommand(command: string) {
    const extensionName = this.#getExtensionNameFromCommand(command);
    const ext = this.#getActiveExtension(extensionName);
    if (ext == null) {
      return null;
    }
    return ext.contextImpl.commands.getCommandFunction(command);
  }

  setActiveWindow(window: Window): void {
    this.#commonExtensionWindowState.activeWindow = window;
  }

  getActiveWindow(): Window {
    return this.#commonExtensionWindowState.activeWindow;
  }

  setActiveTerminal(terminal: Terminal):void {
    this.#commonExtensionWindowState.activeTerminal = terminal;
  }

  getActiveTerminal(): Terminal {
    return this.#commonExtensionWindowState.activeTerminal;
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

    for (const ext of this.#activeExtensions) {
      if (ext.metadata.name === extensionName) {
        const commandFunc = ext.contextImpl.commands.getCommandFunction(commandName);
        if (commandFunc == null) {
          throw new Error(`Unable to find command '${commandName}' in extension '${extensionName}'.`);
        }
        return this.#runCommandFunc(commandName, commandFunc, args);
      }
    }

    throw new Error(`Unable to find extension with name '${extensionName}' for command '${commandName}'.`);
  }

  executeCommandWithExtensionWindowState(tempState: CommonExtensionWindowState, command: string, args?: any): any {
    let result: any = undefined;
    this.#executeFuncWithExtensionWindowState(tempState, () => {
      result = this.executeCommand(command, args);
    });
    return result;
  }

  /**
   * Execute a function with a different temporary extension context.
   */
  #executeFuncWithExtensionWindowState(tempState: CommonExtensionWindowState, func: () => void,): any {
    const oldState = this.copyExtensionWindowState();
    this.#setExtensionWindowState(tempState);
    func();
    this.#setExtensionWindowState(oldState);
  }

  #runCommandFunc(name: string, commandFunc: (args: any) => any, args: any): any {
    try {
      return commandFunc(args);
    } catch(ex) {
      this._log.warn(`Command '${name}' threw an exception.`, ex);
      return ex;
    }
  }

  #setExtensionWindowState(newState: CommonExtensionWindowState): void {
    for (const key in newState) {
      this.#commonExtensionWindowState[key] = newState[key];
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
      for (const [command, commandEntryList] of activeExtension.contextImpl.commands._commandToMenuEntryMap) {
        for (const commandEntry of commandEntryList) {
          if (commandPredicate(commandEntry) && commandPalettePredicate(commandEntry) &&
              contextMenuPredicate(commandEntry) && newTerminalMenuPredicate(commandEntry) &&
              terminalTabMenuPredicate(commandEntry) && windowMenuPredicate(commandEntry) &&
              categoryPredicate(commandEntry) &&
              whenPredicate(commandEntry)) {

            const customizer = activeExtension.contextImpl.commands.getFunctionCustomizer(
                                commandEntry.commandContribution.command);
            if (customizer != null) {
              this.#executeFuncWithExtensionWindowState(context,
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
      terminalFocus: false,
      viewerFocus: false,
      isHyperlink: false,
      hyperlinkURL: null,
      hyperlinkProtocol: null,
      hyperlinkDomain: null,
      hyperlinkFileExtension: null,
    };

    if (state.activeTerminal != null) {
      whenVariables.terminalFocus = true;
    } else {
      // if (state.activeViewerElement) {
      //   whenVariables.viewerFocus = true;
      // }
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

  newTerminalCreated(newTerminal: Terminal, allTerminals: Terminal[]): void {

    // newTerminal.addEventListener(EtTerminal.EVENT_APPENDED_VIEWER, (ev: CustomEvent) => {
    //   for (const extension of this._getActiveRenderExtensions()) {
    //     extension.contextImpl._internalWindow.terminalAppendedViewer(newTerminal, ev.detail.viewer);
    //   }
    // });

    newTerminal.environment.onChange((changeList: string[]) => {
      for (const extension of this.#activeExtensions) {
        extension.contextImpl._internalWindow.terminalEnvironmentChanged(newTerminal, changeList);
      }
    });

    newTerminal.onDidAppendScrollbackLines((ev: LineRangeChange) => {
      for (const activeExtension of this.#activeExtensions) {
        activeExtension.contextImpl._internalWindow.terminalDidAppendScrollbackLines(newTerminal, ev);
      }
    });

    newTerminal.onDidScreenChange((ev: LineRangeChange) => {
      for (const activeExtension of this.#activeExtensions) {
        activeExtension.contextImpl._internalWindow.terminalDidScreenChange(newTerminal, ev);
      }
    });

    for (const activeExtension of this.#activeExtensions) {
      activeExtension.contextImpl._internalWindow.newTerminalCreated(newTerminal, allTerminals);
    }
  }
}
