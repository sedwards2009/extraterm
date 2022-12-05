/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { Logger, getLogger, log } from "extraterm-logging";

import { ApplicationImpl } from "./ApplicationImpl.js";
import { CommandsImpl } from "./CommandsImpl.js";
import { ConfigurationImpl } from "./ConfigurationImpl.js";
import { ConfigDatabase } from "../../config/ConfigDatabase.js";
import { ExtensionMetadata } from "../ExtensionMetadata.js";
import { SessionsImpl } from "./SessionsImpl.js";
import { TerminalsImpl } from "./TerminalsImpl.js";
import { WindowsImpl } from "./WindowsImpl.js";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { SettingsImpl } from "./SettingsImpl.js";
import { ThemeManager } from "../../theme/ThemeManager.js";


export class ExtensionContextImpl implements ExtensionApi.ExtensionContext, ExtensionApi.Disposable {
  #extensionMetadata: ExtensionMetadata;
  #internalExtensionContext: InternalExtensionContext;

  #application: ExtensionApi.Application;
  #commands: ExtensionApi.Commands;
  #configuration: ExtensionApi.Configuration;
  #logger: ExtensionApi.Logger;
  #sessions: ExtensionApi.Sessions;
  #settings: ExtensionApi.Settings;
  #terminals: ExtensionApi.Terminals;
  #windows: ExtensionApi.Windows;

  constructor(extensionMetadata: ExtensionMetadata, internalExtensionContext: InternalExtensionContext,
      configDatabase: ConfigDatabase, themeManager: ThemeManager, applicationVersion: string) {

    this.#extensionMetadata = extensionMetadata;
    this.#internalExtensionContext = internalExtensionContext;

    this.#application = new ApplicationImpl(applicationVersion);
    this.#commands = new CommandsImpl(internalExtensionContext);
    this.#configuration = new ConfigurationImpl(configDatabase, extensionMetadata.name);
    this.#logger = getLogger(extensionMetadata.name);
    this.#sessions = new SessionsImpl(internalExtensionContext);
    this.#settings = new SettingsImpl(internalExtensionContext, configDatabase, themeManager);
    this.#terminals = new TerminalsImpl(internalExtensionContext);
    this.#windows = new WindowsImpl(internalExtensionContext);
  }

  dispose(): void {

  }

  get activeBlock(): ExtensionApi.Block {
    return this.#internalExtensionContext.getActiveBlock();
  }

  /**
   * The currently active/focussed terminal.
   *
   * This may be `null`.
   */
  get activeTerminal(): ExtensionApi.Terminal {
    return this.#internalExtensionContext.getActiveTerminal();
  }

  get activeHyperlinkURL(): string {
    return this.#internalExtensionContext.getActiveHyperlinkURL();
  }

  get activeWindow(): ExtensionApi.Window {
    return this.#internalExtensionContext.getActiveWindow();
  }

  get application(): ExtensionApi.Application {
    return this.#application;
  }

  get commands(): ExtensionApi.Commands {
    return this.#commands;
  }

  /**
   * Configuration object which the extension can use to store its own
   * configuration data.
   */
  get configuration(): ExtensionApi.Configuration {
    return this.#configuration;
  }

  /**
   * Absolute path to where this extension is located on the file system.
   */
  get extensionPath(): string {
    return this.#extensionMetadata.path;
  }

  /**
   * Logger object which the extension can use.
   */
  get logger(): ExtensionApi.Logger {
    return this.#logger;
  }

  get sessions(): ExtensionApi.Sessions {
    return this.#sessions;
  }

  get terminals(): ExtensionApi.Terminals {
    return this.#terminals;
  }

  get windows(): ExtensionApi.Windows {
    return this.#windows;
  }

  get settings(): ExtensionApi.Settings {
    return this.#settings;
  }
}
