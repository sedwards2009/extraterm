/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { DeepReadonly } from 'extraterm-readonly-toolbox';
import { Event, SessionConfiguration } from 'extraterm-extension-api';
import { KeybindingsFile } from './keybindings/KeybindingsFile';

export type ConfigCursorStyle = "block" | "underscore" | "beam";
export type GpuDriverWorkaround = "none" | "no_blend";
export type ShowTipsStrEnum = "always" | "daily" | "never";
export type TitleBarStyle = "native" | "theme" | "compact";
export type TerminalMarginStyle = "none" | "thin" | "normal" | "thick";
export type WindowBackgroundMode = "opaque" | "blur";

export interface GeneralConfig {
  blinkingCursor?: boolean;
  cursorStyle?: ConfigCursorStyle;
  themeTerminal?: string;
  themeSyntax?: string;
  themeGUI?: string;
  terminalFont?: string;
  terminalFontSize?: number;  // px
  uiScalePercent?: number;
  terminalMarginStyle?: TerminalMarginStyle;

  windowBackgroundMode?: WindowBackgroundMode;
  windowBackgroundTransparencyPercent?: number;

  scrollbackMaxLines?: number;
  scrollbackMaxFrames?: number;
  keybindingsName?: string;

  showTips?: ShowTipsStrEnum;
  tipCounter?: number;
  tipTimestamp?: number;
  titleBarStyle?: TitleBarStyle;

  showTrayIcon?: boolean;
  minimizeToTray?: boolean;

  windowConfiguration?: WindowConfiguration;

  frameByDefault?: boolean;

  frameRule?: FrameRule;
  frameRuleLines?: number;

  autoCopySelectionToClipboard?: boolean;

  gpuDriverWorkaround?: GpuDriverWorkaround;
  isHardwareAccelerated?: boolean;
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


export type CommandLineActionMatchType = "name" | "regexp";

export type FrameRule = "always_frame" | "frame_if_lines" | "never_frame";

export interface CommandLineAction {
  match: string;
  matchType: CommandLineActionMatchType;
  frameRule: FrameRule;
  frameRuleLines: number;
}

export interface KeybindingsInfo {
  name: string;
  filename: string;
  readOnly: boolean;
  path: string;
}

export interface WindowConfiguration {
  [index: number]: SingleWindowConfiguration;
}

export interface SingleWindowConfiguration {
  readonly isMaximized?: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SystemConfig {
  homeDir: string;
  applicationVersion: string;
  keybindingsInfoList: KeybindingsInfo[];
  keybindingsFile: KeybindingsFile;
  
  availableFonts: FontInfo[];
  titleBarStyle: TitleBarStyle;

  userTerminalThemeDirectory: string;
  userSyntaxThemeDirectory: string;

  isHardwareAccelerated: boolean;
}

export interface FontInfo {
  path: string;
  name: string;
  postscriptName: string;
}

export type ConfigKey = "*" | "general" | "session" | "command_line_action" | "system";

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
   * Be sure to dispose of the registration once you are finished with it,
   * otherwise this connect may keep your listener object alive.
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
