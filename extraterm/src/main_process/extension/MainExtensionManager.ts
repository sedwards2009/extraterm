/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from '@extraterm/extraterm-extension-api';
import { EventEmitter } from 'extraterm-event-emitter';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Logger, getLogger } from "extraterm-logging";
import { ExtensionMetadata, ExtensionSessionBackendContribution, ExtensionDesiredState } from "../../ExtensionMetadata";
import { parsePackageJsonString } from './PackageFileParser';
import { ExtensionContext, Event, Backend, SessionBackend, SyntaxThemeProvider, TerminalThemeProvider } from '@extraterm/extraterm-extension-api';
import { log } from "extraterm-logging";
import { isMainProcessExtension, isSupportedOnThisPlatform } from '../../render_process/extension/InternalTypes';
import { AcceptsConfigDatabase, ConfigDatabase, GENERAL_CONFIG } from '../../Config';


interface ActiveExtension {
  metadata: ExtensionMetadata;
  publicApi: any;
  contextImpl: ExtensionContextImpl;
  module: any;
}

export interface LoadedSessionBackendContribution {
  metadata: ExtensionMetadata;
  sessionBackendMetadata: ExtensionSessionBackendContribution;
  sessionBackend: SessionBackend;
}

export interface LoadedSyntaxThemeProviderContribution {
  metadata: ExtensionMetadata;
  syntaxThemeProvider: SyntaxThemeProvider;
}

export interface LoadedTerminalThemeProviderContribution {
  metadata: ExtensionMetadata;
  terminalThemeProvider: TerminalThemeProvider;
}


export class MainExtensionManager implements AcceptsConfigDatabase {

  private _log: Logger = null;
  private _configDatabase: ConfigDatabase = null;
  private _extensionMetadata: ExtensionMetadata[] = [];
  private _activeExtensions: ActiveExtension[] = [];
  private _extensionDesiredState: ExtensionDesiredState = {};
  private _desiredStateChangeEventEmitter = new EventEmitter<void>();
  onDesiredStateChanged: Event<void>;

  constructor(private extensionPaths: string[]) {
    this._log = getLogger("MainExtensionManager", this);
    this.onDesiredStateChanged = this._desiredStateChangeEventEmitter.event;
    this._extensionMetadata = this._scan(this.extensionPaths);
  }

  setConfigDatabase(newConfigDatabase: ConfigDatabase): void {
    this._configDatabase = newConfigDatabase;
  }

  startUpExtensions(activeExtensionsConfig: {[name: string]: boolean;}): void {
    for (const extensionInfo of this._extensionMetadata) {
      this._extensionDesiredState[extensionInfo.name] = isSupportedOnThisPlatform(extensionInfo);
    }

    // Merge in the explicitly enabled/disabled extensions from the config.
    if (activeExtensionsConfig != null) {
      for (const key of Object.keys(activeExtensionsConfig)) {
        if (this._getExtensionMetadataByName(key) != null) {
          this._extensionDesiredState[key] = activeExtensionsConfig[key];
        }
      }
    }

    for (const extensionName of Object.keys(this._extensionDesiredState)) {
      if (this._extensionDesiredState[extensionName]) {
        this._startExtension(this._getExtensionMetadataByName(extensionName));
      }
    }
  }

  private _scan(extensionPaths: string[]): ExtensionMetadata[] {
    return _.flatten(extensionPaths.map(p => this._scanPath(p)));
  }

  private _scanPath(extensionPath: string): ExtensionMetadata[] {
    this._log.info(`Scanning '${extensionPath}' for extensions.`);
    if (fs.existsSync(extensionPath)) {
      const result: ExtensionMetadata[] = [];
      const contents = fs.readdirSync(extensionPath);
      for (const item of contents) {
        const packageJsonPath = path.join(extensionPath, item, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          const extensionInfoPath = path.join(extensionPath, item);
          const extensionInfo = this._loadPackageJson(extensionInfoPath);
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

  private _loadPackageJson(extensionPath: string): ExtensionMetadata {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJsonString = fs.readFileSync(packageJsonPath, "UTF8");
    try {
      const result = parsePackageJsonString(packageJsonString, extensionPath);

      const jsonTree = JSON.parse(packageJsonString);
      result.readmePath = this._getExtensionReadmePath(jsonTree, extensionPath);

      return result;
    } catch(ex) {
      this._log.warn(`An error occurred while processing '${packageJsonPath}': ` + ex);
      return null;
    }
  }

  private _getExtensionReadmePath(packageJsonTree: any, extensionPath: string): string {
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

  private _getExtensionMetadataByName(name: string): ExtensionMetadata {
    for (const extensionInfo of this._extensionMetadata) {
      if (extensionInfo.name === name) {
        return extensionInfo;
      }
    }
    return null;
  }

  private _startExtension(metadata: ExtensionMetadata): ActiveExtension {
    let module = null;
    let publicApi = null;
    let contextImpl: ExtensionContextImpl = null;
    if (isMainProcessExtension(metadata)) {
      this._log.info(`Starting extension '${metadata.name}' in the main process.`);

      contextImpl = new ExtensionContextImpl(metadata);
      if (metadata.main != null) {
        module = this._loadExtensionModule(metadata);
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
    }
    const activeExtension: ActiveExtension = {metadata, publicApi, contextImpl, module};
    this._activeExtensions.push(activeExtension);
    return activeExtension;
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

  getExtensionMetadata(): ExtensionMetadata[] {
    return this._extensionMetadata;
  }

  getActiveExtensionMetadata(): ExtensionMetadata[] {
    return this._activeExtensions.map(ae => ae.metadata);
  }

  enableExtension(name: string): void {
    const metadata = this._getExtensionMetadataByName(name);
    if (metadata == null) {
      this._log.warn(`Unable to find extensions metadata for name '${name}'.`);
      return;
    }

    const activeExtension = this._getActiveExtension(name);
    if (activeExtension != null) {
      this._log.warn(`Tried to enable active extension '${name}'.`);
      return;
    }

    this._startExtension(metadata);
    this._extensionDesiredState[metadata.name] = true;

    const generalConfig = this._configDatabase.getConfigCopy(GENERAL_CONFIG);
    generalConfig.activeExtensions[metadata.name] = true;
    this._configDatabase.setConfig(GENERAL_CONFIG, generalConfig);

    this._desiredStateChangeEventEmitter.fire();
  }

  private _getActiveExtension(name: string): ActiveExtension {
    for (const extension of this._activeExtensions) {
      if (extension.metadata.name === name) {
        return extension;
      }
    }
    return null;
  }

  disableExtension(name: string): void {
    const metadata = this._getExtensionMetadataByName(name);
    if (metadata == null) {
      this._log.warn(`Unable to find extensions metadata for name '${name}'.`);
      return;
    }

    const activeExtension = this._getActiveExtension(name);
    if (activeExtension == null) {
      this._log.warn(`Tried to disable inactive extension '${name}'.`);
      return;
    }

    this._stopExtension(activeExtension);
    this._extensionDesiredState[metadata.name] = false;

    const generalConfig = this._configDatabase.getConfigCopy(GENERAL_CONFIG);
    generalConfig.activeExtensions[metadata.name] = false;
    this._configDatabase.setConfig(GENERAL_CONFIG, generalConfig);

    this._desiredStateChangeEventEmitter.fire();
  }

  getDesiredState(): ExtensionDesiredState {
    return this._extensionDesiredState;
  }

  private _getActiveBackendExtensions(): ActiveExtension[] {
    return this._activeExtensions.filter(ae => ae.contextImpl != null);
  }

  getSessionBackendContributions(): LoadedSessionBackendContribution[] {
    return _.flatten(this._getActiveBackendExtensions().map(
      ae => ae.contextImpl.backend.__BackendImpl__sessionBackends));
  }

  getSessionBackend(type: string): ExtensionApi.SessionBackend {
    for (const extension of this._getActiveBackendExtensions()) {
      for (const backend of extension.contextImpl.backend.__BackendImpl__sessionBackends) {
        if (backend.sessionBackendMetadata.type === type) {
          return backend.sessionBackend;
        }
      }
    }
    return null;
  }

  getSyntaxThemeProviderContributions(): LoadedSyntaxThemeProviderContribution[] {
    return _.flatten(this._getActiveBackendExtensions().map(
      ae => ae.contextImpl.backend.__BackendImpl__syntaxThemeProviders));
  }

  getTerminalThemeProviderContributions(): LoadedTerminalThemeProviderContribution[] {
    return _.flatten(this._getActiveBackendExtensions().map(
      ae => ae.contextImpl.backend.__BackendImpl__terminalThemeProviders));
  }
}

class ExtensionContextImpl implements ExtensionContext {
  get commands(): never {
    this.logger.warn("'ExtensionContext.commands' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.commands' is only available from a window process, not the main process.");
  }
  logger: ExtensionApi.Logger = null;
  isBackendProcess = true;
  backend: BackendImpl = null;

  constructor(public __extensionMetadata: ExtensionMetadata) {
    this.logger = getLogger("[Main]" + this.__extensionMetadata.name);
    this.backend = new BackendImpl(this.__extensionMetadata);
  }

  get window(): never {
    this.logger.warn("'ExtensionContext.window' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.window' is only available from a window process, not the main process.");
  }

  get aceModule(): never {
    this.logger.warn("'ExtensionContext.aceModule' is only available from a window process, not the main process.");
    throw Error("'ExtensionContext.aceModule' is only available from a window process, not the main process.");
  }
}

class BackendImpl implements Backend {
  private _log: Logger = null;
  __BackendImpl__sessionBackends: LoadedSessionBackendContribution[] = [];
  __BackendImpl__syntaxThemeProviders: LoadedSyntaxThemeProviderContribution[] = [];
  __BackendImpl__terminalThemeProviders: LoadedTerminalThemeProviderContribution[] = [];

  constructor(public __extensionMetadata: ExtensionMetadata) {
    this._log = getLogger("Backend (" + this.__extensionMetadata.name + ")", this);
  }

  registerSessionBackend(name: string, backend: SessionBackend): void {
    for (const backendMeta of this.__extensionMetadata.contributes.sessionBackends) {
      if (backendMeta.name === name) {
        this.__BackendImpl__sessionBackends.push({
          metadata: this.__extensionMetadata,
          sessionBackendMetadata: backendMeta,
          sessionBackend: backend
        });
        return;
      }
    }

    this._log.warn(`Unable to register session backend '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the session backend contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerSyntaxThemeProvider(name: string, provider: SyntaxThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.syntaxThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__syntaxThemeProviders.push({
          metadata: this.__extensionMetadata,
          syntaxThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register syntax theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the syntax theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }

  registerTerminalThemeProvider(name: string, provider: TerminalThemeProvider): void {
    for (const backendMeta of this.__extensionMetadata.contributes.terminalThemeProviders) {
      if (backendMeta.name === name) {
        this.__BackendImpl__terminalThemeProviders.push({
          metadata: this.__extensionMetadata,
          terminalThemeProvider: provider
        } );
        return;
      }
    }

    this._log.warn(`Unable to register terminal theme provider '${name}' for extension ` +
      `'${this.__extensionMetadata.name}' because the terminal theme provider contribution data ` +
      `couldn't be found in the extension's package.json file.`);
    return;
  }
}
