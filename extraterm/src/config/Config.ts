/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { SessionConfiguration } from '@extraterm/extraterm-extension-api';
import { KeybindingsSet, LogicalKeybindingsName } from '../keybindings/KeybindingsTypes';

export type ConfigCursorStyle = "block" | "underscore" | "beam";
export type GpuDriverWorkaround = "none" | "no_blend";
export type MouseButtonAction = "none" | "context_menu" | "paste" | "paste_selection";
export type ShowTipsStrEnum = "always" | "daily" | "never";
export type TerminalMarginStyle = "none" | "thin" | "normal" | "thick";
export type TitleBarStyle = "native" | "theme" | "compact";
export type WindowBackgroundMode = "opaque" | "blur";


export interface GeneralConfig {
  blinkingCursor?: boolean;
  cursorStyle?: ConfigCursorStyle;
  themeTerminal?: string;
  terminalFont?: string;
  terminalFontSize?: number;  // px
  terminalDisplayLigatures?: boolean;
  uiScalePercent?: number;
  terminalMarginStyle?: TerminalMarginStyle;

  windowBackgroundMode?: WindowBackgroundMode;
  windowBackgroundTransparencyPercent?: number;

  scrollbackMaxLines?: number;
  scrollbackMaxFrames?: number;
  keybindingsName?: LogicalKeybindingsName;

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

  closeWindowWhenEmpty?: boolean;

  middleMouseButtonAction?: MouseButtonAction;
  middleMouseButtonShiftAction?: MouseButtonAction;
  middleMouseButtonControlAction?: MouseButtonAction;
  rightMouseButtonAction?: MouseButtonAction;
  rightMouseButtonShiftAction?: MouseButtonAction;
  rightMouseButtonControlAction?: MouseButtonAction;

  activeExtensions?: {[extensionName:string]: boolean;};
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

export interface KeybindingsFileInfo {
  name: LogicalKeybindingsName;
  filename: string;
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

  availableFonts: FontInfo[];
  titleBarStyle: TitleBarStyle;

  userTerminalThemeDirectory: string;
}

export interface FontInfo {
  name: string;
  family: string;
  style: string;
  id: string;
}
