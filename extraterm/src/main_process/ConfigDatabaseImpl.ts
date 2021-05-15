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
  SYSTEM_CONFIG,
  SHARED_MAP_CONFIG_NAMESPACE} from '../Config';
import * as SharedMap from '../shared_map/SharedMap';

const MAIN_CONFIG = "extraterm.json";


export class ConfigDatabaseImpl implements ConfigDatabase {
  private _log: Logger;
  #sharedMap: SharedMap.SharedMap = null;
  #onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;

  #configDirectory: string;

  constructor(configDirectory: string, sharedMap: SharedMap.SharedMap) {
    this._log = getLogger("ConfigDatabaseImpl", this);
    this.#sharedMap = sharedMap;
    this.onChange = this.#onChangeEventEmitter.event;

    this.#configDirectory = configDirectory;
  }

  init(): void {
    this._loadAllConfigs();

    this.#sharedMap.onChange((ev: SharedMap.ChangeEvent) => {
      if (ev.type !== SharedMap.ChangeType.CHANGED || ev.namespace !== SHARED_MAP_CONFIG_NAMESPACE) {
        return;
      }

      this.#onChangeEventEmitter.fire({
        key: ev.key,
        newConfig: ev.value,
        oldConfig: ev.oldValue,
      });
    });
  }

  private _getConfig(key: ConfigKey): any {
    const result = this.#sharedMap.get(SHARED_MAP_CONFIG_NAMESPACE, key);
    if (result == null) {
      this._log.warn("Unable to find config for key ", key);
    } else {
      return result;
    }
  }

  private _getConfigCopy(key: ConfigKey): any {
    const data = this._getConfig(key);
    if (data == null) {
      return null;
    }
    return _.cloneDeep(data);
  }

  getGeneralConfig(): DeepReadonly<GeneralConfig> {
    return <DeepReadonly<GeneralConfig>> this._getConfig(GENERAL_CONFIG);
  }

  getSessionConfig(): DeepReadonly<SessionConfiguration[]> {
    return <DeepReadonly<SessionConfiguration[]>> this._getConfig(SESSION_CONFIG);
  }

  getCommandLineActionConfig(): DeepReadonly<CommandLineAction[]> {
    return <DeepReadonly<CommandLineAction[]>> this._getConfig(COMMAND_LINE_ACTIONS_CONFIG);
  }

  getSystemConfig(): DeepReadonly<SystemConfig> {
    return <DeepReadonly<SystemConfig>> this._getConfig(SYSTEM_CONFIG);
  }

  getGeneralConfigCopy(): GeneralConfig {
    return <GeneralConfig> this._getConfigCopy(GENERAL_CONFIG);
  }

  getSessionConfigCopy(): SessionConfiguration[] {
    return <SessionConfiguration[]> this._getConfigCopy(SESSION_CONFIG);
  }

  getCommandLineActionConfigCopy(): CommandLineAction[] {
    return <CommandLineAction[]> this._getConfigCopy(COMMAND_LINE_ACTIONS_CONFIG);
  }

  getSystemConfigCopy(): SystemConfig {
    return <SystemConfig> this._getConfigCopy(SYSTEM_CONFIG);
  }

  setGeneralConfig(newConfig: GeneralConfig | DeepReadonly<GeneralConfig>): void {
    this._setConfig(GENERAL_CONFIG, newConfig);
  }

  setSessionConfig(newConfig: SessionConfiguration[] | DeepReadonly<SessionConfiguration[]>): void {
    this._setConfig(SESSION_CONFIG, newConfig);
  }

  setCommandLineActionConfig(newConfig: CommandLineAction[] | DeepReadonly<CommandLineAction[]>): void {
    this._setConfig(COMMAND_LINE_ACTIONS_CONFIG, newConfig);
  }

  setSystemConfig(newConfig: SystemConfig | DeepReadonly<SystemConfig>): void {
    this._setConfig(SYSTEM_CONFIG, newConfig);
  }

  private _setConfigNoWrite(key: ConfigKey, newConfig: any): void {
    const oldConfig = this._getConfig(key);
    if (_.isEqual(oldConfig, newConfig)) {
      return;
    }
    this.#sharedMap.set(SHARED_MAP_CONFIG_NAMESPACE, key, newConfig);
    this.#onChangeEventEmitter.fire({key, oldConfig, newConfig: this._getConfig(key)});
  }

  private _setConfig(key: ConfigKey, newConfig: any): void {
    if (newConfig == null) {
      this._log.warn("setConfig() newConfig is null for key ", key);
    }

    this._setConfigNoWrite(key, newConfig);
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

    this._setConfigNoWrite(GENERAL_CONFIG, userConfig);
    this._setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, commandLineActions);
    this._setConfigNoWrite(SESSION_CONFIG, sessions);
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
    const cleanConfig = <UserStoredConfig> this._getConfigCopy(GENERAL_CONFIG);
    cleanConfig.commandLineActions = this._getConfig(COMMAND_LINE_ACTIONS_CONFIG);
    cleanConfig.sessions = this._getConfig(SESSION_CONFIG);

    const formattedConfig = JSON.stringify(cleanConfig, null, "  ");
    fs.writeFileSync(this._getUserConfigFilename(), formattedConfig);
  }
}
