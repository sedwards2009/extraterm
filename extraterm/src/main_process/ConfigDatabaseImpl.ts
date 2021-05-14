/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

import { Event, SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { Logger, getLogger } from "extraterm-logging";
import { DeepReadonly, freezeDeep } from 'extraterm-readonly-toolbox';

import { EventEmitter } from '../utils/EventEmitter';
import {ConfigDatabase, ConfigKey, UserStoredConfig, ConfigChangeEvent, GeneralConfig, CommandLineAction,
  SystemConfig,
  GENERAL_CONFIG,
  SESSION_CONFIG,
  COMMAND_LINE_ACTIONS_CONFIG,
  SYSTEM_CONFIG} from '../Config';

const MAIN_CONFIG = "extraterm.json";


export class ConfigDatabaseImpl implements ConfigDatabase {
  private _log: Logger;

  #configDirectory: string;
  #configDb = new Map<ConfigKey, any>();
  #onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;

  constructor(configDirectory: string) {
    this._log = getLogger("ConfigDatabaseImpl", this);
    this.#configDirectory = configDirectory;
    this.onChange = this.#onChangeEventEmitter.event;
  }

  init(): void {
    this._loadAllConfigs();
  }

  getAllConfigs(): {[key: string]: any; } {
    // Wildcard fetch all.
    const result = {};

    for (const [dbKey, value] of this.#configDb.entries()) {
      result[dbKey] = value;
    }
    freezeDeep(result);
    return result;
  }

  getConfig(key: ConfigKey): any {
    if (key === "*") {
      return this.getAllConfigs();
    } else {
      const result = this.#configDb.get(key);
      if (result == null) {
        this._log.warn("Unable to find config for key ", key);
      } else {
        return result;
      }
    }
  }

  getConfigCopy(key: ConfigKey): any {
    const data = this.getConfig(key);
    if (data == null) {
      return null;
    }
    return _.cloneDeep(data);
  }

  getGeneralConfig(): DeepReadonly<GeneralConfig> {
    return <DeepReadonly<GeneralConfig>> this.getConfig(GENERAL_CONFIG);
  }

  getSessionConfig(): DeepReadonly<SessionConfiguration[]> {
    return <DeepReadonly<SessionConfiguration[]>> this.getConfig(SESSION_CONFIG);
  }

  getCommandLineActionConfig(): DeepReadonly<CommandLineAction[]> {
    return <DeepReadonly<CommandLineAction[]>> this.getConfig(COMMAND_LINE_ACTIONS_CONFIG);
  }

  getSystemConfig(): DeepReadonly<SystemConfig> {
    return <DeepReadonly<SystemConfig>> this.getConfig(SYSTEM_CONFIG);
  }

  getGeneralConfigCopy(): GeneralConfig {
    return <GeneralConfig> this.getConfigCopy(GENERAL_CONFIG);
  }

  getSessionConfigCopy(): SessionConfiguration[] {
    return <SessionConfiguration[]> this.getConfigCopy(SESSION_CONFIG);
  }

  getCommandLineActionConfigCopy(): CommandLineAction[] {
    return <CommandLineAction[]> this.getConfigCopy(COMMAND_LINE_ACTIONS_CONFIG);
  }

  getSystemConfigCopy(): SystemConfig {
    return <SystemConfig> this.getConfigCopy(SYSTEM_CONFIG);
  }

  setGeneralConfig(newConfig: GeneralConfig | DeepReadonly<GeneralConfig>): void {
    this.setConfig(GENERAL_CONFIG, newConfig);
  }

  setSessionConfig(newConfig: SessionConfiguration[] | DeepReadonly<SessionConfiguration[]>): void {
    this.setConfig(SESSION_CONFIG, newConfig);
  }

  setCommandLineActionConfig(newConfig: CommandLineAction[] | DeepReadonly<CommandLineAction[]>): void {
    this.setConfig(COMMAND_LINE_ACTIONS_CONFIG, newConfig);
  }

  setSystemConfig(newConfig: SystemConfig | DeepReadonly<SystemConfig>): void {
    this.setConfig(SYSTEM_CONFIG, newConfig);
  }

  setConfigNoWrite(key: ConfigKey, newConfig: any): void {
    if (key === "*") {
      for (const objectKey of Object.getOwnPropertyNames(newConfig)) {
        this._setSingleConfigNoWrite(<ConfigKey> objectKey, newConfig[objectKey]);
      }
    } else {
      this._setSingleConfigNoWrite(key, newConfig);
    }
  }

  private _setSingleConfigNoWrite(key: ConfigKey, newConfig: any): void {
    const oldConfig = this.getConfig(key);
    if (_.isEqual(oldConfig, newConfig)) {
      return;
    }

    if (Object.isFrozen(newConfig)) {
      this.#configDb.set(key, newConfig);
    } else {
      this.#configDb.set(key, freezeDeep(_.cloneDeep(newConfig)));
    }

    this.#onChangeEventEmitter.fire({key, oldConfig, newConfig: this.getConfig(key)});
  }

  setConfig(key: ConfigKey, newConfig: any): void {
    if (newConfig == null) {
      this._log.warn("setConfig() newConfig is null for key ", key);
    }

    this.setConfigNoWrite(key, newConfig);
    if ([GENERAL_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, SESSION_CONFIG, "*"].indexOf(key) !== -1) {
      this._writeUserConfigFile();
    }
  }

  private _loadAllConfigs(): void {
    const userConfig = this._readUserConfigFile();

    const commandLineActions = userConfig.commandLineActions ?? [];
    const sessions = userConfig.sessions ?? [];
    userConfig.commandLineActions = null;
    userConfig.sessions = null;

    this.setConfigNoWrite(GENERAL_CONFIG, userConfig);
    this.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, commandLineActions);
    this.setConfigNoWrite(SESSION_CONFIG, sessions);
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
