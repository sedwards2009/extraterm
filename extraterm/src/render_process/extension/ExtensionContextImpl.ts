/*
 * Copyright 2020 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import * as Ace from "@extraterm/ace-ts";

import { Logger, getLogger, log } from "extraterm-logging";
import { EtTerminal } from "../Terminal";
import { ProxyFactoryImpl } from "./ProxyFactoryImpl";
import { ExtensionManager, InternalExtensionContext, InternalWindow, ProxyFactory, InternalTabTitleWidget
} from "./InternalTypes";
import { WindowProxy } from "./proxy/WindowProxy";
import { ExtensionMetadata, ExtensionCommandContribution, ExtensionMenusContribution } from "../../ExtensionMetadata";
import { CommandsRegistry } from "./CommandsRegistry";
import { CommonExtensionWindowState } from "./CommonExtensionState";
import { ExtensionContainerElement } from "./ExtensionContainerElement";


export class ExtensionContextImpl implements InternalExtensionContext {
  private _log: Logger = null;

  commands: CommandsRegistry = null;
  window: ExtensionApi.Window = null;
  internalWindow: InternalWindow = null;
  aceModule: typeof Ace = Ace;
  logger: ExtensionApi.Logger = null;
  isBackendProcess = false;

  proxyFactory: ProxyFactory = null;

  extensionPath: string = null;

  private _tabTitleWidgetFactoryMap = new Map<string, ExtensionApi.TabTitleWidgetFactory>();

  constructor(public extensionManager: ExtensionManager, public extensionMetadata: ExtensionMetadata,
              commonExtensionState: CommonExtensionWindowState) {

    this._log = getLogger("InternalExtensionContextImpl", this);
    this.proxyFactory = new ProxyFactoryImpl(this);
    this.commands = new CommandsRegistry(this, extensionMetadata.name,
                                          extensionMetadata.contributes.commands, extensionMetadata.contributes.menus);
    this.internalWindow = new WindowProxy(this, commonExtensionState);
    this.window = this.internalWindow;

    this.extensionPath = this.extensionMetadata.path;

    this.logger = getLogger(extensionMetadata.name);
  }

  get backend(): never {
    this.logger.warn("'ExtensionContext.backend' is not available from a render process.");
    throw Error("'ExtensionContext.backend' is not available from a render process.");
  }

  findViewerElementTagByMimeType(mimeType: string): string {
    return this.internalWindow.findViewerElementTagByMimeType(mimeType);
  }

  debugRegisteredCommands(): void {
    for (const command of this.extensionMetadata.contributes.commands) {
      if (this.commands.getCommandFunction(command.command) == null) {
        this._log.debug(`Command '${command.command}' from extension '${this.extensionMetadata.name}' has no function registered.`);
      }
    }
  }

  registerCommandContribution(contribution: ExtensionCommandContribution): ExtensionApi.Disposable {
    this.extensionMetadata.contributes.commands.push(contribution);
    const commandDisposable = this.commands.registerCommandContribution(contribution);
    this.extensionManager.commandRegistrationChanged();
    return {
      dispose: () => {
        this.extensionManager.commandRegistrationChanged();
        commandDisposable.dispose();
        const index = this.extensionMetadata.contributes.commands.indexOf(contribution);
        this.extensionMetadata.contributes.commands.splice(index, 1);
      }
    };
  }

  setCommandMenu(command: string, menuType: keyof ExtensionMenusContribution, on: boolean): void {
    const entryList = this.commands._commandToMenuEntryMap.get(command);
    if (entryList == null) {
      return;
    }
    for (const entry of entryList) {
      entry[menuType] = on;
    }
  }

  registerTabTitleWidget(name: string, factory: ExtensionApi.TabTitleWidgetFactory): void {
    const tabTitleWidgetMeta = this.extensionMetadata.contributes.tabTitleWidgets;
    for (const data of tabTitleWidgetMeta) {
      if (data.name === name) {
        this._tabTitleWidgetFactoryMap.set(name, factory);
        return;
      }
    }

    this.logger.warn(
      `Unknown tab title widget '${name}' given to registerTabTitleWidget().`);
  }

  _createTabTitleWidgets(terminal: EtTerminal): HTMLElement[] {
    const tabTitleWidgetsContrib = this.extensionMetadata.contributes.tabTitleWidgets;
    const result: HTMLElement[] = [];
    for (const contrib of tabTitleWidgetsContrib) {
      const factory = this._tabTitleWidgetFactoryMap.get(contrib.name);
      if (factory != null) {
        const extensionContainerElement = <ExtensionContainerElement>
          document.createElement(ExtensionContainerElement.TAG_NAME);
        extensionContainerElement._setExtensionContext(this);
        extensionContainerElement._setExtensionCss(contrib.css);

        const tabTitleWidget = new TabTitleWidgetImpl(extensionContainerElement);
        const factoryResult = factory(this.proxyFactory.getTerminalProxy(terminal), tabTitleWidget);
// FIXME record this stuff somewhere, and also may be clean it up.
        result.push(extensionContainerElement);
      }
    }
    return result;
  }
}

class TabTitleWidgetImpl implements InternalTabTitleWidget {

  constructor(private _extensionContainerElement: ExtensionContainerElement) {
  }

  getContainerElement(): HTMLElement {
    return this._extensionContainerElement.getContainerElement();
  }
}
