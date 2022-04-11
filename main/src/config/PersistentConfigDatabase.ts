/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "node:fs";
import * as _ from "lodash-es";
import * as path from "node:path";

import { getLogger, log } from "extraterm-logging";
import { DebouncedDoLater } from "extraterm-later";

import { ConfigChangeEvent, ConfigDatabase, ConfigKey } from "./ConfigDatabase.js";
import * as SharedMap from "../shared_map/SharedMap.js";
import { COMMAND_LINE_ACTIONS_CONFIG, GENERAL_CONFIG, SESSION_CONFIG, UserStoredConfig } from "./Config.js";

const MAIN_CONFIG = "extraterm.json";
const EXTENSION_CONFIG_DIR = "extension_config";

/**
 * Config database which also loads and stores some config information on disk.
 */
export class PersistentConfigDatabase extends ConfigDatabase {
  #configDirectory: string;

  #writeExtensionConfig: DebouncedDoLater = null;
  #queuedWriteExtensionConfig = new Set<string>();

  constructor(configDirectory: string, sharedMap: SharedMap.SharedMap) {
    super(sharedMap);
    this._log = getLogger("PersistentConfigDatabase", this);
    this.#configDirectory = configDirectory;
    this.#writeExtensionConfig = new DebouncedDoLater(this._writeQueuedExtensionConfigs.bind(this), 250);
  }

  start(): void {
    this._setUpDirectory();
    this._loadApplicationConfigs();
    this._loadExtensionConfigs();
    this.onExtensionChange((e: ConfigChangeEvent) => {
      this._queueWriteExtensionConfig(e.key);
    });
    super.start();
  }

  protected setConfig(key: ConfigKey, newConfig: any): void {
    super.setConfig(key, newConfig);
    if ([GENERAL_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, SESSION_CONFIG].indexOf(key) !== -1) {
      this._writeUserConfigFile();
    }
  }

  private _setUpDirectory(): void {
    const extConfigPath = this._getExtensionConfigDirectory();
    if ( ! fs.existsSync(extConfigPath)) {
      fs.mkdirSync(extConfigPath);
    }
  }

  private _loadApplicationConfigs(): void {
    const userConfig = this._readUserConfigFile();

    const commandLineActions = userConfig.commandLineActions ?? [];
    const sessions = userConfig.sessions ?? [];
    userConfig.commandLineActions = null;
    userConfig.sessions = null;

    super.setConfig(GENERAL_CONFIG, userConfig);
    super.setConfig(COMMAND_LINE_ACTIONS_CONFIG, commandLineActions);
    super.setConfig(SESSION_CONFIG, sessions);
  }

  private _readUserConfigFile(): UserStoredConfig {
    const filename = this._getUserConfigFilename();
    let config: UserStoredConfig = { };

    if (fs.existsSync(filename)) {
      this._log.info("Reading user configuration from " + filename);
      const configJson = fs.readFileSync(filename, {encoding: "utf8"});
      try {
        config = <UserStoredConfig>JSON.parse(configJson);
      } catch(ex) {
        this._log.warn("Unable to read " + filename, ex);
      }
    } else {
      this._log.info("Couldn't find user configuration file at " + filename);
    }
    return config;
  }

  private _getUserConfigFilename(): string {
    return path.join(this.#configDirectory, MAIN_CONFIG);
  }

  private _writeUserConfigFile(): void {
    const cleanConfig = <UserStoredConfig> this.getConfigCopy(GENERAL_CONFIG);
    cleanConfig.commandLineActions = this.getConfig(COMMAND_LINE_ACTIONS_CONFIG);
    cleanConfig.sessions = this.getConfig(SESSION_CONFIG);

    const formattedConfig = JSON.stringify(cleanConfig, null, "  ");
    fs.writeFileSync(this._getUserConfigFilename(), formattedConfig);
  }

  private _getExtensionConfigDirectory(): string {
    return path.join(this.#configDirectory, EXTENSION_CONFIG_DIR);
  }

  private _loadExtensionConfigs(): void {
    const extConfigDirectory = this._getExtensionConfigDirectory();
    for (const filename of fs.readdirSync(extConfigDirectory)) {
      if (filename.endsWith(".json")) {
        const extensionName = filename.slice(0, -5);
        const configJson = fs.readFileSync(path.join(extConfigDirectory, filename), {encoding: "utf8"});
        try {
          const config = JSON.parse(configJson);
          super.setExtensionConfig(extensionName, config);
        } catch(ex) {
          this._log.warn("Unable to read " + filename, ex);
        }
      }
    }
  }

  private _queueWriteExtensionConfig(extensionName: string): void {
    this.#queuedWriteExtensionConfig.add(extensionName);
    this.#writeExtensionConfig.trigger();
  }

  private _writeQueuedExtensionConfigs(): void {
    for (const extensionName of this.#queuedWriteExtensionConfig) {
      this._writeExtensionConfig(extensionName, this.getExtensionConfig(extensionName));
    }
    this.#queuedWriteExtensionConfig.clear();
  }

  private _writeExtensionConfig(extensionName: string, config: any): void {
    const formattedConfig = JSON.stringify(config, null, "  ");
    const extConfigFilename = path.join(this._getExtensionConfigDirectory(), `${extensionName}.json`);
    fs.writeFileSync(extConfigFilename, formattedConfig);
  }
}
