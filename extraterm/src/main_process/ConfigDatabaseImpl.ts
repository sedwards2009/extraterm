/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";

import { getLogger } from "extraterm-logging";
import { ConfigDatabase, ConfigKey } from "../ConfigDatabase";
import * as SharedMap from "../shared_map/SharedMap";
import { COMMAND_LINE_ACTIONS_CONFIG, GENERAL_CONFIG, SESSION_CONFIG, UserStoredConfig } from "../Config";

const MAIN_CONFIG = "extraterm.json";


export class ConfigDatabaseImpl extends ConfigDatabase {
  #configDirectory: string;

  constructor(configDirectory: string, sharedMap: SharedMap.SharedMap) {
    super(sharedMap);
    this._log = getLogger("ConfigDatabaseImpl", this);
    this.#configDirectory = configDirectory;
  }

  start(): void {
    this._loadAllConfigs();
    super.start();
  }

  protected setConfig(key: ConfigKey, newConfig: any): void {
    super.setConfig(key, newConfig);
    if ([GENERAL_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, SESSION_CONFIG].indexOf(key) !== -1) {
      this._writeUserConfigFile();
    }
  }

  private _loadAllConfigs(): void {
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
}
