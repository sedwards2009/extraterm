/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as os from 'os';
import { DeepReadonly } from 'extraterm-readonly-toolbox';

import { Disposable, Event, SessionConfiguration } from 'extraterm-extension-api';

export type ShowTipsStrEnum = 'always' | 'daily' | 'never';

export interface Config {
  blinkingCursor?: boolean;
  themeTerminal?: string;
  themeSyntax?: string;
  themeGUI?: string;
  terminalFont?: string;
  terminalFontSize?: number;  // px
  uiScalePercent?: number;

  commandLineActions?: CommandLineAction[];
  scrollbackMaxLines?: number;
  scrollbackMaxFrames?: number;
  keyBindingsFilename?: string;
  
  showTips?: ShowTipsStrEnum;
  tipCounter?: number;
  tipTimestamp?: number;
  showTitleBar?: boolean;

  windowConfiguration?: WindowConfiguration;

  sessions?: SessionConfiguration[];

  systemConfig: SystemConfig;
}

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
  keyBindingsContexts: Object;
  
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

export type ReadonlyConfig = DeepReadonly<Config>;

/**
 * Interface for distributing configuration changes.
 */
export interface ConfigDatabase {
  /**
   * Get the current config object.
   *
   * @return the current config.
   */
  getConfig(): ReadonlyConfig;

  getConfigCopy(): Config;

  /**
   * Register a listener to hear when the config has changed.
   *
   */
  onChange: Event<void>;
  
  /**
   * Set a new application wide config.
   *
   * Note that the full effects of this method are asynchronous with respect
   * to the parts of the application which run in different threads/processes.
   * @param newConfig the new config object.
   */
  setConfig(newConfig: Config | ReadonlyConfig): void;
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
