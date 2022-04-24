/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as _ from "lodash-es";

import { createUuid } from "extraterm-uuid";
import { Logger, getLogger } from "extraterm-logging";
import { ThemeInfo, ThemeType, FALLBACK_TERMINAL_THEME } from "../theme/Theme.js";
import { FontInfo, ConfigCursorStyle, TerminalMarginStyle, FrameRule, TitleBarStyle,
  WindowBackgroundMode } from "./Config.js";
import envPaths from "env-paths";

import { LogicalKeybindingsName, AllLogicalKeybindingsNames } from "../keybindings/KeybindingsTypes.js";
import { PersistentConfigDatabase } from "./PersistentConfigDatabase.js";
import { ConfigDatabase } from "./ConfigDatabase.js";
import { ThemeManager } from "../theme/ThemeManager.js";

export const EXTRATERM_CONFIG_DIR = "extratermqt";
const PATHS_CONFIG_FILENAME = "application_paths.json";
const PATHS_USER_SETTINGS_KEY = "userSettingsPath";

const USER_KEYBINDINGS_DIR = "keybindings";
const USER_THEMES_DIR = "themes";
const USER_SYNTAX_THEMES_DIR = "syntax";
const USER_TERMINAL_THEMES_DIR = "terminal";

const DEFAULT_TERMINALFONT = "Liga DejaVu Sans Mono";

export const KEYBINDINGS_OSX: LogicalKeybindingsName = "macos-style";
export const KEYBINDINGS_PC: LogicalKeybindingsName = "pc-style";

const MAIN_CONFIG = "extraterm.json";
const EXTENSION_DIRECTORY = "extensions";

const LOG_FINE = false;

const _log = getLogger("MainConfig");

const paths = envPaths(EXTRATERM_CONFIG_DIR, {suffix: ""});


export function setupAppData(): void {
  const configDir = getUserSettingsDirectory();
  if ( ! fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, {recursive: true});
  } else {
    const statInfo = fs.statSync(configDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm configuration path " + configDir + " is not a directory!");
      return;
    }
  }

  const userKeybindingsDir = getUserKeybindingsDirectory();
  if ( ! fs.existsSync(userKeybindingsDir)) {
    fs.mkdirSync(userKeybindingsDir, {recursive: true});
  } else {
    const statInfo = fs.statSync(userKeybindingsDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user keybindings path " + userKeybindingsDir + " is not a directory!");
      return;
    }
  }

  const userThemesDir = getUserThemeDirectory();
  if ( ! fs.existsSync(userThemesDir)) {
    fs.mkdirSync(userThemesDir, {recursive: true});
  } else {
    const statInfo = fs.statSync(userThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user themes path " + userThemesDir + " is not a directory!");
      return;
    }
  }

  const userTerminalThemesDir = getUserTerminalThemeDirectory();
  if ( ! fs.existsSync(userTerminalThemesDir)) {
    fs.mkdirSync(userTerminalThemesDir, {recursive: true});
  } else {
    const statInfo = fs.statSync(userTerminalThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user terminal themes path " + userTerminalThemesDir + " is not a directory!");
      return;
    }
  }
}


let userSettingsPath: string = null;

export function getUserSettingsDirectory(): string {
  if (userSettingsPath == null) {
    const overridePath = getUserSettingsDirectoryFromPathsConfig();
    if (overridePath != null) {
      userSettingsPath = overridePath;
    } else {
      userSettingsPath = paths.config;
    }
  }
  return userSettingsPath;
}

function getUserSettingsDirectoryFromPathsConfig(): string {
  // FIXME

  // const exeDir = path.dirname(app.getPath("exe"));
  // const pathsConfigFilename = path.join(exeDir, PATHS_CONFIG_FILENAME);
  // _log.info(`Looking for ${PATHS_CONFIG_FILENAME} at '${pathsConfigFilename}'`);
  // if (fs.existsSync(pathsConfigFilename)) {
  //   try {
  //     const pathsConfigString = fs.readFileSync(pathsConfigFilename, {encoding: "utf8"});
  //     const pathsConfig = JSON.parse(pathsConfigString);
  //     const value = pathsConfig[PATHS_USER_SETTINGS_KEY];
  //     if (value != null) {
  //       if (typeof value !== "string") {
  //         _log.warn(`Value of key ${PATHS_USER_SETTINGS_KEY} in file ${pathsConfigFilename} isn't a string.`);
  //       } else {
  //         if (value === "") {
  //           _log.info(`Using default location for user settings because ${PATHS_USER_SETTINGS_KEY} in file ${pathsConfigFilename} is empty.`);
  //           return null;
  //         }
  //         const userSettingsPath = path.join(exeDir, value);
  //         _log.info(`Using '${userSettingsPath}' for storing user settings.`);
  //         return userSettingsPath;
  //       }
  //     }
  //   } catch(ex) {
  //     _log.warn(`Unable to parse json file '${pathsConfigFilename}',`, ex);
  //   }
  // }
  return null;
}

function getUserThemeDirectory(): string {
  return path.join(getUserSettingsDirectory(), USER_THEMES_DIR);
}

export function getUserTerminalThemeDirectory(): string {
  return path.join(getUserThemeDirectory(), USER_TERMINAL_THEMES_DIR);
}

export function getUserSyntaxThemeDirectory(): string {
  return path.join(getUserThemeDirectory(), USER_SYNTAX_THEMES_DIR);
}

export function getUserKeybindingsDirectory(): string {
  return path.join(getUserSettingsDirectory(), USER_KEYBINDINGS_DIR);
}

export function getConfigurationFilename(): string {
  return path.join(getUserSettingsDirectory(), MAIN_CONFIG);
}

export function getUserExtensionDirectory(): string {
  return path.join(getUserSettingsDirectory(), EXTENSION_DIRECTORY);
}

export function isThemeType(themeInfo: ThemeInfo, themeType: ThemeType): boolean {
  if (themeInfo === null) {
    return false;
  }
  return themeInfo.type === themeType;
}

export function sanitizeAndInitializeConfigs(configDatabase: PersistentConfigDatabase, themeManager: ThemeManager,
    availableFonts: FontInfo[]): void {

  sanitizeGeneralConfig(configDatabase, themeManager, availableFonts);
  sanitizeSessionConfig(configDatabase);
  sanitizeCommandLineActionsConfig(configDatabase);
}

const frameRules: FrameRule[] = ["always_frame", "frame_if_lines", "never_frame"];

function sanitizeGeneralConfig(configDatabase: ConfigDatabase, themeManager: ThemeManager,
    availableFonts: FontInfo[]): void {

  const generalConfig = configDatabase.getGeneralConfigCopy() ?? {};

  const configCursorStyles: ConfigCursorStyle[] = ["block", "underscore", "beam"];

  sanitizeField(generalConfig, "autoCopySelectionToClipboard", true);
  sanitizeField(generalConfig, "blinkingCursor", false);

  sanitizeStringEnumField(generalConfig, "cursorStyle", configCursorStyles, "block");
  sanitizeStringEnumField(generalConfig, "frameRule", frameRules, "frame_if_lines");
  sanitizeField(generalConfig, "frameRuleLines", 10);

  sanitizeField(generalConfig, "keybindingsName", process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC);
  if ( ! AllLogicalKeybindingsNames.includes(generalConfig.keybindingsName)) {
    generalConfig.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  sanitizeField(generalConfig, "minimizeToTray", false);
  sanitizeField(generalConfig, "scrollbackMaxFrames", 100);
  sanitizeField(generalConfig, "scrollbackMaxLines", 500000);

  sanitizeStringEnumField(generalConfig, "showTips", ["always", "daily", "never"], "always");
  sanitizeField(generalConfig, "showTrayIcon", false);

  sanitizeField(generalConfig, "terminalFont", DEFAULT_TERMINALFONT);
  if ( ! availableFonts.some( (font) => font.id === generalConfig.terminalFont)) {
    generalConfig.terminalFont = DEFAULT_TERMINALFONT;
  }

  sanitizeField(generalConfig, "terminalFontSize", 13);
  generalConfig.terminalFontSize = Math.max(Math.min(1024, generalConfig.terminalFontSize), 4);

  sanitizeField(generalConfig, "terminalDisplayLigatures", true);

  const marginStyles: TerminalMarginStyle[] = ["normal", "none", "thick", "thin"];
  sanitizeStringEnumField(generalConfig, "terminalMarginStyle", marginStyles, "normal");

  sanitizeField(generalConfig, "tipCounter", 0);
  sanitizeField(generalConfig, "tipTimestamp", 0);

  const titleBarStyles: TitleBarStyle[] = ["compact", "native", "theme"];
  sanitizeStringEnumField(generalConfig, "titleBarStyle", titleBarStyles, "native");

  sanitizeField(generalConfig, "uiScalePercent", 100);
  generalConfig.uiScalePercent = Math.min(500, Math.max(5, generalConfig.uiScalePercent || 100));

  const windowBackgroundModes: WindowBackgroundMode[] = ["opaque", "blur"];
  sanitizeStringEnumField(generalConfig, "windowBackgroundMode", windowBackgroundModes, "opaque");

  sanitizeField(generalConfig, "windowBackgroundTransparencyPercent", 50);
  generalConfig.windowBackgroundTransparencyPercent = Math.max(Math.min(100,
    generalConfig.windowBackgroundTransparencyPercent), 0);

  sanitizeField(generalConfig, "closeWindowWhenEmpty", true);

  sanitizeField(generalConfig, "middleMouseButtonAction", "paste");
  sanitizeField(generalConfig, "middleMouseButtonShiftAction", "paste");
  sanitizeField(generalConfig, "middleMouseButtonControlAction", "paste");
  sanitizeField(generalConfig, "rightMouseButtonAction", "context_menu");
  sanitizeField(generalConfig, "rightMouseButtonShiftAction", "context_menu");
  sanitizeField(generalConfig, "rightMouseButtonControlAction", "context_menu");

  sanitizeField(generalConfig, "activeExtensions", {});

  sanitizeField(generalConfig, "themeTerminal", FALLBACK_TERMINAL_THEME);
  if ( ! isThemeType(themeManager.getTheme(generalConfig.themeTerminal), "terminal")) {
    generalConfig.themeTerminal = FALLBACK_TERMINAL_THEME;
  }

  configDatabase.setGeneralConfig(generalConfig);
}

function sanitizeSessionConfig(configDatabase: ConfigDatabase): void {
  let sessionConfigs = configDatabase.getSessionConfigCopy();
  if (sessionConfigs == null || ! Array.isArray(sessionConfigs)) {
    sessionConfigs = [];
  }

  // Ensure that when reading a config file where args is not defined, we define it as an empty string
  for (const sessionConfiguration of sessionConfigs) {
    sanitizeField(sessionConfiguration, "name", "");
    sanitizeField(sessionConfiguration, "uuid", createUuid());

    if (typeof sessionConfiguration.type !== "string") {
      sessionConfiguration.type = "";
    }

    if (sessionConfiguration.initialDirectory == null || typeof sessionConfiguration.initialDirectory !== "string") {
      sessionConfiguration.initialDirectory = null;
    }

    sanitizeField(sessionConfiguration, "args", "");
  }

  configDatabase.setSessionConfig(sessionConfigs);
}

function sanitizeCommandLineActionsConfig(configDatabase: ConfigDatabase): void {
  let commandLineActions = configDatabase.getCommandLineActionConfigCopy();
  if ( ! Array.isArray(commandLineActions)) {
    commandLineActions = [
      { frameRule: "never_frame", frameRuleLines: 5, match: "show", matchType: "name" }
    ];
  } else {
    for (const action of commandLineActions) {
      sanitizeStringEnumField(action, "frameRule", frameRules, "never_frame");
      sanitizeField(action, "frameRuleLines", 5);
      sanitizeField(action, "match", "");
      sanitizeStringEnumField(action, "matchType", ["name", "regexp"], "name");
    }
  }

  configDatabase.setCommandLineActionConfig(commandLineActions);
}

function sanitizeField<T, K extends keyof T>(object: T, key: K, defaultValue: T[K]): void {
  if (object[key] == null || typeof object[key] !== typeof defaultValue) {
    object[key] = defaultValue;
  }
}

function sanitizeStringEnumField<T, K extends keyof T>(object: T, key: K, availableValues: (T[K])[],
    defaultValue: T[K]): void {
  if (object[key] == null) {
    object[key] = defaultValue;
  } else if ( ! availableValues.includes(object[key])) {
    object[key] = defaultValue;
  }
}
