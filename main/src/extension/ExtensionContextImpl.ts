/*
 * Copyright 2020-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";

import { Logger, getLogger, log } from "extraterm-logging";
import { Terminal } from "../terminal/Terminal";
import { ProxyFactoryImpl } from "./proxy/ProxyFactoryImpl";
import { ExtensionManager, InternalExtensionContext, InternalWindow, ProxyFactory } from "../InternalTypes";
import { WindowProxy } from "./proxy/WindowProxy";
import { ExtensionMetadata, ExtensionCommandContribution, ExtensionMenusContribution } from "./ExtensionMetadata";
import { CommandsRegistry } from "../CommandsRegistry";
import { CommonExtensionWindowState } from "./CommonExtensionState";
import { ApplicationImpl } from "./ApplicationImpl";
import { ConfigurationImpl } from "./ConfigurationImpl";
import { ConfigDatabase } from "../config/ConfigDatabase";
import { InternalBackend } from "./ExtensionManagerTypes";
import { BackendImpl } from "./BackendImpl";


export class ExtensionContextImpl implements InternalExtensionContext, ExtensionApi.Disposable {
  private _log: Logger = null;

  application: ApplicationImpl = null;
  commands: CommandsRegistry = null;
  configuration: ConfigurationImpl = null;
  window: ExtensionApi.Window = null;
  _internalWindow: InternalWindow = null;
  logger: ExtensionApi.Logger = null;

  _proxyFactory: ProxyFactory = null;
  _internalBackend: InternalBackend;

  extensionPath: string = null;

  _extensionManager: ExtensionManager;
  _extensionMetadata: ExtensionMetadata;

  #tabTitleWidgetFactoryMap = new Map<string, ExtensionApi.TabTitleWidgetFactory>();

  constructor(extensionManager: ExtensionManager, extensionMetadata: ExtensionMetadata, configDatabase: ConfigDatabase,
              commonExtensionState: CommonExtensionWindowState, applicationVersion: string) {

    this._log = getLogger("InternalExtensionContextImpl", this);

    this._extensionManager = extensionManager;
    this._extensionMetadata = extensionMetadata;
    this._proxyFactory = new ProxyFactoryImpl(this);
    this.application = new ApplicationImpl(applicationVersion);
    this.commands = new CommandsRegistry(this, extensionMetadata.name,
                                          extensionMetadata.contributes.commands, extensionMetadata.contributes.menus);
    this._internalWindow = new WindowProxy(this, commonExtensionState);
    this.window = this._internalWindow;

    this.extensionPath = this._extensionMetadata.path;
    this._internalBackend = new BackendImpl(this._extensionMetadata);
    this.configuration = new ConfigurationImpl(configDatabase, extensionMetadata.name);
    this.logger = getLogger(extensionMetadata.name);
  }

  dispose() {
    this.configuration.dispose();
  }

  get backend(): ExtensionApi.Backend {
    return this._internalBackend;
  }

  _findViewerElementTagByMimeType(mimeType: string): string {
    return this._internalWindow.findViewerElementTagByMimeType(mimeType);
  }

  _debugRegisteredCommands(): void {
    for (const command of this._extensionMetadata.contributes.commands) {
      if (this.commands.getCommandFunction(command.command) == null) {
        this._log.debug(`Command '${command.command}' from extension '${this._extensionMetadata.name}' has no function registered.`);
      }
    }
  }

  _registerCommandContribution(contribution: ExtensionCommandContribution): ExtensionApi.Disposable {
    this._extensionMetadata.contributes.commands.push(contribution);
    const commandDisposable = this.commands.registerCommandContribution(contribution);
    // this._extensionManager.commandRegistrationChanged();
    return {
      dispose: () => {
        // this._extensionManager.commandRegistrationChanged();
        commandDisposable.dispose();
        const index = this._extensionMetadata.contributes.commands.indexOf(contribution);
        this._extensionMetadata.contributes.commands.splice(index, 1);
      }
    };
  }

  _setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean): void {
    const entryList = this.commands._commandToMenuEntryMap.get(command);
    if (entryList == null) {
      return;
    }
    for (const entry of entryList) {
      entry[menuType] = on;
    }
  }

  _registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    const tabTitleWidgetMeta = this._extensionMetadata.contributes.tabTitleWidgets;
    for (const data of tabTitleWidgetMeta) {
      if (data.name === name) {
        this.#tabTitleWidgetFactoryMap.set(name, factory);
        return;
      }
    }

    this.logger.warn(
      `Unknown tab title widget '${name}' given to registerTabTitleWidget().`);
  }

  _createTabTitleWidgets(terminal: Terminal): HTMLElement[] {
/*
    const tabTitleWidgetsContrib = this._extensionMetadata.contributes.tabTitleWidgets;
    const result: HTMLElement[] = [];
    for (const contrib of tabTitleWidgetsContrib) {
      const factory = this.#tabTitleWidgetFactoryMap.get(contrib.name);
      if (factory != null) {
        const extensionContainerElement = <ExtensionContainerElement>
          document.createElement(ExtensionContainerElement.TAG_NAME);
        extensionContainerElement._setExtensionContext(this);
        extensionContainerElement._setExtensionCss(contrib.css);

        const tabTitleWidget = new TabTitleWidgetImpl(extensionContainerElement);
        const factoryResult = factory(this._proxyFactory.getTerminalProxy(terminal), tabTitleWidget);
// FIXME record this stuff somewhere, and also may be clean it up.
        result.push(extensionContainerElement);
      }
    }
    return result;
    */
    return [];
  }
}
/*
class TabTitleWidgetImpl implements InternalTabTitleWidget {

  constructor(private _extensionContainerElement: ExtensionContainerElement) {
  }

  getContainerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
  }
}
*/