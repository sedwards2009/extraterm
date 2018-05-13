/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as os from 'os';
import { DeepReadonly } from 'extraterm-readonly-toolbox';

import { Disposable, Event, SessionConfiguration } from 'extraterm-extension-api';

export type ShowTipsStrEnum = 'always' | 'daily' | 'never';

export interface GeneralConfig {
  blinkingCursor?: boolean;
  themeTerminal?: string;
  themeSyntax?: string;
  themeGUI?: string;
  terminalFont?: string;
  terminalFontSize?: number;  // px
  uiScalePercent?: number;

  scrollbackMaxLines?: number;
  scrollbackMaxFrames?: number;
  keyBindingsFilename?: string;
  
  showTips?: ShowTipsStrEnum;
  tipCounter?: number;
  tipTimestamp?: number;
  showTitleBar?: boolean;

  windowConfiguration?: WindowConfiguration;

  frameByDefault?: boolean;
}

// This is the format of the user config JSON file as stored on the filesystem.
// It is a little wierd due to backwards compat.
export interface UserStoredConfig extends GeneralConfig {
  commandLineActions?: CommandLineAction[];
  sessions?: SessionConfiguration[];
}

export const GENERAL_CONFIG = "general";
export const COMMAND_LINE_ACTIONS_CONFIG = "command_line_action";
export const SESSION_CONFIG = "session";
export const SYSTEM_CONFIG = "system";


export type CommandLineActionMatchType = 'name' | 'regexp';

export interface CommandLineAction {
  match: string;
  matchType: CommandLineActionMatchType;
  frame: boolean;
}

export interface KeyBindingInfo {
  name: string;
  filename: string;
}

export interface WindowConfiguration {
  [index: number]: SingleWindowConfiguration;
}

export interface SingleWindowConfiguration {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SystemConfig {
  homeDir: string;
  keyBindingsFiles: KeyBindingInfo[];
  keyBindingsContexts: object;
  
  availableFonts: FontInfo[];
  titleBarVisible: boolean;
  currentScaleFactor: number;
  originalScaleFactor: number;
}

export interface FontInfo {
  path: string;
  name: string;
  postscriptName: string;
}

export type ConfigKey = string;

export interface ConfigChangeEvent {
  key: ConfigKey;
  newConfig: any;
  oldConfig: any;
}


/**
 * Interface for distributing configuration changes.
 */
export interface ConfigDatabase {
  /**
   * Get the current config object.
   *
   * @return the current config.
   */
  getConfig(key: "general"): DeepReadonly<GeneralConfig>;
  getConfig(key: "session"): DeepReadonly<SessionConfiguration[]>;
  getConfig(key: "command_line_action"): DeepReadonly<CommandLineAction[]>;
  getConfig(key: "system"): DeepReadonly<SystemConfig>;
  getConfig(key: ConfigKey): any;

  getConfigCopy(key: "general"): GeneralConfig;
  getConfigCopy(key: "session"): SessionConfiguration[];
  getConfigCopy(key: "command_line_action"): CommandLineAction[];
  getConfigCopy(key: "system"): SystemConfig;
  getConfigCopy(key: ConfigKey): any;

  /**
   * Register a listener to hear when the config has changed.
   *
   */
  onChange: Event<ConfigChangeEvent>;
  
  /**
   * Set a new application wide config.
   *
   * Note that the full effects of this method are asynchronous with respect
   * to the parts of the application which run in different threads/processes.
   * @param newConfig the new config object.
   */
  setConfig(key: "general", newConfig: GeneralConfig | DeepReadonly<GeneralConfig>): void;
  setConfig(key: "session", newConfig: SessionConfiguration[] | DeepReadonly<SessionConfiguration[]>): void;
  setConfig(key: "command_line_action", newConfig: CommandLineAction[] | DeepReadonly<CommandLineAction[]>): void;
  setConfig(key: "system", newConfig: SystemConfig | DeepReadonly<SystemConfig>): void;
  setConfig(key: ConfigKey, newConfig: any): void;
}

export interface AcceptsConfigDatabase {
  setConfigDatabase(newConfigDatabase: ConfigDatabase): void;
}

export function isAcceptsConfigDatabase(instance: any): instance is AcceptsConfigDatabase {
  return (<AcceptsConfigDatabase> instance).setConfigDatabase !== undefined;
}

export function injectConfigDatabase(instance: any, configDatabase: ConfigDatabase): void {
  if (isAcceptsConfigDatabase(instance)) {
    instance.setConfigDatabase(configDatabase);
  }
}
