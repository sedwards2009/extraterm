/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as _ from "lodash";

import { DeepReadonly } from "extraterm-readonly-toolbox";
import { Event, SessionConfiguration} from "@extraterm/extraterm-extension-api";

import { SESSION_CONFIG, SystemConfig, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, CommandLineAction,
  COMMAND_LINE_ACTIONS_CONFIG } from "./Config";
import {Logger, getLogger, log } from "extraterm-logging";
import { EventEmitter } from "extraterm-event-emitter";

import * as SharedMap from "../shared_map/SharedMap";

export interface ConfigChangeEvent {
  key: string;
  newConfig: any;
  oldConfig: any;
}

export type ConfigKey = string;

const SHARED_MAP_CONFIG_NAMESPACE = "extraterm";
const SHARED_MAP_EXTENSION_CONFIG_NAMESPACE = "extension_config";


export class ConfigDatabase {
  protected _log: Logger;

  #sharedMap: SharedMap.SharedMap = null;
  #onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;

  #onExtensionChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onExtensionChange: Event<ConfigChangeEvent>;

  constructor(sharedMap: SharedMap.SharedMap) {
    this._log = getLogger("ConfigDatabase", this);
    this.#sharedMap = sharedMap;
    this.onChange = this.#onChangeEventEmitter.event;
    this.onExtensionChange = this.#onExtensionChangeEventEmitter.event;
  }

  start(): void {
    this.#sharedMap.onChange((ev: SharedMap.ChangeEvent) => {
      this.#handleApplicationConfigChange(ev);
      this.#handleExtensionConfigChange(ev);
    });
  }

  #handleApplicationConfigChange(ev: SharedMap.ChangeEvent): void {
    if (ev.type !== SharedMap.ChangeType.CHANGED || ev.namespace !== SHARED_MAP_CONFIG_NAMESPACE) {
      return;
    }

    this.#onChangeEventEmitter.fire({
      key: ev.key,
      newConfig: ev.value,
      oldConfig: ev.oldValue,
    });
  }

  #handleExtensionConfigChange(ev: SharedMap.ChangeEvent): void {
    if (ev.namespace !== SHARED_MAP_EXTENSION_CONFIG_NAMESPACE) {
      return;
    }

    this.#onExtensionChangeEventEmitter.fire({
      key: ev.key,
      newConfig: ev.value,
      oldConfig: ev.oldValue,
    });
  }

  protected getConfig(key: ConfigKey): any {
    const result = this.#sharedMap.get(SHARED_MAP_CONFIG_NAMESPACE, key);
    if (result == null) {
      this._log.warn("Unable to find config for key ", key);
    } else {
      return result;
    }
  }

  protected getConfigCopy(key: ConfigKey): any {
    const data = this.getConfig(key);
    if (data == null) {
      return null;
    }
    return _.cloneDeep(data);
  }

  getExtensionConfig(extensionName: string): any {
    return this.#sharedMap.get(SHARED_MAP_EXTENSION_CONFIG_NAMESPACE, extensionName);
  }

  setExtensionConfig(extensionName: string, config: any): void {
    this.#sharedMap.set(SHARED_MAP_EXTENSION_CONFIG_NAMESPACE, extensionName, config);
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

  protected setConfig(key: ConfigKey, newConfig: any): void {
    const oldConfig = this.getConfig(key);
    if (_.isEqual(oldConfig, newConfig)) {
      return;
    }
    this.#sharedMap.set(SHARED_MAP_CONFIG_NAMESPACE, key, newConfig);
    this.#onChangeEventEmitter.fire({ key, oldConfig, newConfig });
  }
}
