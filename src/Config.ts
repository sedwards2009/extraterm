/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as os from 'os';
import * as _ from 'lodash';

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
  scrollbackLines?: number;
  keyBindingsFilename?: string;
  
  showTips?: ShowTipsStrEnum;
  tipCounter?: number;
  tipTimestamp?: number;
  showTitleBar?: boolean;

  sessionProfiles?: SessionProfile[]; // User configurable list of sessions.
  expandedProfiles: SessionProfile[]; // 'cooked' or expanded list of sessions where missing information is filled in.
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

export const SESSION_TYPE_UNIX = "unix";
export const SESSION_TYPE_CYGWIN = "cygwin";
export const SESSION_TYPE_BABUN = "babun";

export interface SessionProfile {
  name: string;             // Human readable name for the profile.
  type?: string;            // type - "cygwin", "babun" or "native" ("" means "native")
  command?: string;         // the command to execute in the terminal
  arguments?: string[];     // the arguments for said command
  extraEnv?: Object;        // extra entries to add to the environment before running the command.
  cygwinDir?: string;       // The directory holding the 'system'. Used by babun and cygwin.
}

export function envContext(systemConfig: SystemConfig): Map<string, string> {
  const context = new Map<string, string>();
  context.set("HOME_DIR", systemConfig.homeDir);
  return context;
}

export function expandEnvVariables(extraEnv: Object, context: Map<string, string>): Object {
  const expandedEnv = {};
  if (extraEnv !== null && extraEnv !== undefined) {
    let prop: string;
    for (prop in extraEnv) {
      expandedEnv[prop] = expandEnvVariable(extraEnv[prop], context);
    }
  }

  return expandedEnv;
}

export function expandEnvVariable(value: string, context: Map<string, string>): string {
  let result = value;
  let prop: string;
  context.forEach( (value, prop) => {
    const re = new RegExp("\\$\\{" + prop + "\\}", "g");
    result = result.replace(re, value);
  });
  return result;
}

/**
 * Interface for distributing configuration changes.
 */
export interface ConfigDistributor {
  /**
   * Get the current config object.
   *
   * @return the current config.
   */
  getConfig(): Config;
  
  /**
   * Register a listener to hear when the config has changed.
   *
   * @param key an opaque object which is used to identify this registration.
   * @param onChange the function to call when the config changes.
   */
  registerChangeListener(key: any, onChange: () => void): void;
  
  /**
   * Unregister a listener.
   *
   * @param key the same opaque object which was used during registerChangeListener().
   */
  unregisterChangeListener(key: any): void;
  
  /**
   * Set a new application wide config.
   *
   * Note that this method is asynchronous in the sense that the config doesn't take effect until later.
   * @param newConfig the new config object.
   */
  setConfig(newConfig: Config): void;
}

export interface AcceptsConfigDistributor {
  setConfigDistributor(newConfigDistributor: ConfigDistributor): void;
}

export function isAcceptsConfigManager(instance: any): instance is AcceptsConfigDistributor {
  return (<AcceptsConfigDistributor> instance).setConfigDistributor !== undefined;
}

export function injectConfigDistributor(instance: any, configDistributor: ConfigDistributor): void {
  if (isAcceptsConfigManager(instance)) {
    instance.setConfigDistributor(configDistributor);
  }
}
