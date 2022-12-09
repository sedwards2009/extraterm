/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { TerminalSettingsImpl } from "./TerminalSettingsImpl.js";
import { InternalExtensionContext } from "../../InternalTypes.js";
import { ConfigDatabase } from "../../config/ConfigDatabase";
import { ThemeManager } from "../../theme/ThemeManager.js";


export class SettingsImpl implements ExtensionApi.Settings {
  #internalExtensionContext: InternalExtensionContext;
  #terminalSettings: ExtensionApi.TerminalSettings;

  constructor(internalExtensionContext: InternalExtensionContext, configDatabase: ConfigDatabase,
      themeManager: ThemeManager) {

    this.#internalExtensionContext = internalExtensionContext;
    this.#terminalSettings = new TerminalSettingsImpl(configDatabase, themeManager);
  }

  get terminal(): ExtensionApi.TerminalSettings {
    return this.#terminalSettings;
  }

  registerSettingsTab(name: string, factory: ExtensionApi.SettingsTabFactory): void {
    this.#internalExtensionContext.settingsTabRegistry.registerSettingsTab(name, factory);
  }
}
