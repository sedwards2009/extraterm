/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as ExtensionApi from "@extraterm/extraterm-extension-api";
import { ConfigDatabase } from "../../config/ConfigDatabase";
import { ThemeManager } from "../../theme/ThemeManager.js";


export class TerminalSettingsImpl implements ExtensionApi.TerminalSettings {
  #configDatabase: ConfigDatabase;
  #themeManager: ThemeManager;

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager) {
    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
  }

  get currentTheme(): ExtensionApi.TerminalTheme {
    const config = this.#configDatabase.getGeneralConfig();
    return this.#themeManager.getTerminalTheme(config.themeTerminal)
  }
}
