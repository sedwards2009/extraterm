/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import {app, BrowserWindow } from 'electron';
import { createUuid } from 'extraterm-uuid';

import { Event } from 'extraterm-extension-api';
import { Logger, getLogger } from "extraterm-logging";
import { freezeDeep } from 'extraterm-readonly-toolbox';

import { ThemeInfo, ThemeType, FALLBACK_TERMINAL_THEME, FALLBACK_SYNTAX_THEME } from '../theme/Theme';
import { EventEmitter } from '../utils/EventEmitter';
import {CommandLineAction, SystemConfig, ConfigDatabase, ConfigKey, UserStoredConfig, GENERAL_CONFIG,
  SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, ConfigChangeEvent, FontInfo,
  ConfigCursorStyle, TerminalMarginStyle, FrameRule, TitleBarStyle, WindowBackgroundMode } from '../Config';
import * as Messages from '../WindowMessages';
import { ThemeManager } from '../theme/ThemeManager';
import { KeybindingsIOManager } from './KeybindingsIOManager';

export const EXTRATERM_CONFIG_DIR = "extraterm";
const PATHS_CONFIG_FILENAME = "application_paths.json";
const PATHS_USER_SETTINGS_KEY = "userSettingsPath";

const USER_KEYBINDINGS_DIR = "keybindings";
const USER_THEMES_DIR = "themes"
const USER_SYNTAX_THEMES_DIR = "syntax";
const USER_TERMINAL_THEMES_DIR = "terminal";

const DEFAULT_TERMINALFONT = "DejaVuSansMono";

export const KEYBINDINGS_OSX = "Mac OS X bindings";
export const KEYBINDINGS_PC = "PC style bindings";

const MAIN_CONFIG = "extraterm.json";

const LOG_FINE = false;

const _log = getLogger("MainConfig");


export function setupAppData(): void {
  const configDir = getUserSettingsDirectory();
  if ( ! fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  } else {
    const statInfo = fs.statSync(configDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm configuration path " + configDir + " is not a directory!");
      return;
    }
  }

  const userKeybindingsDir = getUserKeybindingsDirectory();
  if ( ! fs.existsSync(userKeybindingsDir)) {
    fs.mkdirSync(userKeybindingsDir);
  } else {
    const statInfo = fs.statSync(userKeybindingsDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user keybindings path " + userKeybindingsDir + " is not a directory!");
      return;
    }
  }
  
  const userThemesDir = getUserThemeDirectory();
  if ( ! fs.existsSync(userThemesDir)) {
    fs.mkdirSync(userThemesDir);
  } else {
    const statInfo = fs.statSync(userThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user themes path " + userThemesDir + " is not a directory!");
      return;
    }
  }

  const userSyntaxThemesDir = getUserSyntaxThemeDirectory();
  if ( ! fs.existsSync(userSyntaxThemesDir)) {
    fs.mkdirSync(userSyntaxThemesDir);
  } else {
    const statInfo = fs.statSync(userSyntaxThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user syntax themes path " + userSyntaxThemesDir + " is not a directory!");
      return;
    }
  }

  const userTerminalThemesDir = getUserTerminalThemeDirectory();
  if ( ! fs.existsSync(userTerminalThemesDir)) {
    fs.mkdirSync(userTerminalThemesDir);
  } else {
    const statInfo = fs.statSync(userTerminalThemesDir);
    if ( ! statInfo.isDirectory()) {
      _log.warn("Extraterm user terminal themes path " + userTerminalThemesDir + " is not a directory!");
      return;
    }
  }
}


let userSettingsPath: string = null;

function getUserSettingsDirectory(): string {
  if (userSettingsPath == null) {
    const overridePath = getUserSettingsDirectoryFromPathsConfig();
    if (overridePath != null) {
      userSettingsPath = overridePath;
    } else {
      userSettingsPath = path.join(app.getPath("appData"), EXTRATERM_CONFIG_DIR)    
    }
  }
  return userSettingsPath;
}

function getUserSettingsDirectoryFromPathsConfig(): string {
  const exeDir = path.dirname(app.getPath("exe"));
  const pathsConfigFilename = path.join(exeDir, PATHS_CONFIG_FILENAME);
  _log.info(`Looking for ${PATHS_CONFIG_FILENAME} at '${pathsConfigFilename}'`);
  if (fs.existsSync(pathsConfigFilename)) {
    try {
      const pathsConfigString = fs.readFileSync(pathsConfigFilename, {encoding: "utf8"});
      const pathsConfig = JSON.parse(pathsConfigString);
      const value = pathsConfig[PATHS_USER_SETTINGS_KEY];
      if (value != null) {
        if (typeof value !== "string") {
          _log.warn(`Value of key ${PATHS_USER_SETTINGS_KEY} in file ${pathsConfigFilename} isn't a string.`);
        } else {
          if (value === "") {
            _log.info(`Using default location for user settings because ${PATHS_USER_SETTINGS_KEY} in file ${pathsConfigFilename} is empty.`);
            return null;
          }
          const userSettingsPath = path.join(exeDir, value);
          _log.info(`Using '${userSettingsPath}' for storing user settings.`);
          return userSettingsPath;
        }
      }
    } catch(ex) {
      _log.warn(`Unable to parse json file '${pathsConfigFilename}',`, ex);
    }
  }
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

function getConfigurationFilename(): string {
  return path.join(getUserSettingsDirectory(), MAIN_CONFIG);
}


export function isThemeType(themeInfo: ThemeInfo, themeType: ThemeType): boolean {
  if (themeInfo === null) {
    return false;
  }
  return themeInfo.type === themeType;
}

export function readAndInitializeConfigs(themeManager: ThemeManager, configDatabase: ConfigDatabaseImpl,
    keybindingsIOManager: KeybindingsIOManager, availableFonts: FontInfo[]): UserStoredConfig {

  const userStoredConfig = readUserStoredConfigFile();
  sanitizeUserStoredConfig(userStoredConfig, themeManager, availableFonts);
  distributeUserStoredConfig(userStoredConfig, configDatabase, keybindingsIOManager);
  return userStoredConfig;
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readUserStoredConfigFile(): UserStoredConfig {
  const filename = getConfigurationFilename();
  let config: UserStoredConfig = { };

  if (fs.existsSync(filename)) {
    _log.info("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    try {
      config = <UserStoredConfig>JSON.parse(configJson);
    } catch(ex) {
      _log.warn("Unable to read " + filename, ex);
    }
  } else {
    _log.info("Couldn't find user configuration file at " + filename);
  }
  return config;
}

function sanitizeUserStoredConfig(userStoredConfig: UserStoredConfig, themeManager: ThemeManager,
    availableFonts: FontInfo[]): void {

  const configCursorStyles: ConfigCursorStyle[] = ["block", "underscore", "beam"];
  const frameRules: FrameRule[] = ["always_frame", "frame_if_lines", "never_frame"];

  sanitizeField(userStoredConfig, "autoCopySelectionToClipboard", true);
  sanitizeField(userStoredConfig, "blinkingCursor", false);

  if (userStoredConfig.commandLineActions == null) {
    const defaultCLA: CommandLineAction[] = [
      { frameRule: "never_frame", frameRuleLines: 5, match: "show", matchType: "name" }
    ];
    userStoredConfig.commandLineActions = defaultCLA;
  } else {
    for (let action of userStoredConfig.commandLineActions) {
      sanitizeStringEnumField(action, "frameRule", frameRules, "never_frame");
      sanitizeField(action, "frameRuleLines", 5);
      sanitizeField(action, "match", "");
      sanitizeStringEnumField(action, "matchType", ["name", "regexp"], "name");
    }
  }

  sanitizeStringEnumField(userStoredConfig, "cursorStyle", configCursorStyles, "block");
  sanitizeField(userStoredConfig, "frameByDefault", true);
  sanitizeStringEnumField(userStoredConfig, "frameRule", frameRules, "frame_if_lines");
  sanitizeField(userStoredConfig, "frameRuleLines", 10);
  sanitizeStringEnumField(userStoredConfig, "gpuDriverWorkaround", ["none", "no_blend"], "none");
  sanitizeField(userStoredConfig, "isHardwareAccelerated", true);
  sanitizeField(userStoredConfig, "keybindingsName", process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC);
  sanitizeField(userStoredConfig, "minimizeToTray", false);
  sanitizeField(userStoredConfig, "scrollbackMaxFrames", 100);
  sanitizeField(userStoredConfig, "scrollbackMaxLines", 500000);

  sanitizeField(userStoredConfig, "sessions", []);
  // Ensure that when reading a config file where args is not defined, we define it as an empty string
  for (let sessionConfiguration of userStoredConfig.sessions) {
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

  sanitizeStringEnumField(userStoredConfig, "showTips", ["always", "daily", "never"], "always");
  sanitizeField(userStoredConfig, "showTrayIcon", false);

  sanitizeField(userStoredConfig, "terminalFont", DEFAULT_TERMINALFONT);
  if ( ! availableFonts.some( (font) => font.postscriptName === userStoredConfig.terminalFont)) {
    userStoredConfig.terminalFont = DEFAULT_TERMINALFONT;
  }

  sanitizeField(userStoredConfig, "terminalFontSize", 13);
  userStoredConfig.terminalFontSize = Math.max(Math.min(1024, userStoredConfig.terminalFontSize), 4);

  sanitizeField(userStoredConfig, "terminalDisplayLigatures", true);

  sanitizeField(userStoredConfig, "themeTerminal", FALLBACK_TERMINAL_THEME);
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeTerminal), "terminal")) {
    userStoredConfig.themeTerminal = FALLBACK_TERMINAL_THEME;
  }

  const marginStyles: TerminalMarginStyle[] = ["normal", "none", "thick", "thin"];
  sanitizeStringEnumField(userStoredConfig, "terminalMarginStyle", marginStyles, "normal");

  sanitizeField(userStoredConfig, "themeSyntax", FALLBACK_SYNTAX_THEME);
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeSyntax), "syntax")) {
    userStoredConfig.themeSyntax = FALLBACK_SYNTAX_THEME;
  }

  sanitizeField(userStoredConfig, "themeGUI", "two-dark-ui");
  if (userStoredConfig.themeGUI === "default" || ! isThemeType(themeManager.getTheme(userStoredConfig.themeGUI), 'gui')) {
    userStoredConfig.themeGUI = "two-dark-ui";
  }

  sanitizeField(userStoredConfig, "tipCounter", 0);
  sanitizeField(userStoredConfig, "tipTimestamp", 0);

  const titleBarStyles: TitleBarStyle[] = ["compact", "native", "theme"];
  sanitizeStringEnumField(userStoredConfig, "titleBarStyle", titleBarStyles, "compact");

  sanitizeField(userStoredConfig, "uiScalePercent", 100);
  userStoredConfig.uiScalePercent = Math.min(500, Math.max(5, userStoredConfig.uiScalePercent || 100));

  const windowBackgroundModes: WindowBackgroundMode[] = ["opaque", "blur"];
  sanitizeStringEnumField(userStoredConfig, "windowBackgroundMode", windowBackgroundModes, "opaque");

  sanitizeField(userStoredConfig, "windowBackgroundTransparencyPercent", 50);
  userStoredConfig.windowBackgroundTransparencyPercent = Math.max(Math.min(100,
    userStoredConfig.windowBackgroundTransparencyPercent), 0);
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

function distributeUserStoredConfig(userStoredConfig: UserStoredConfig, configDatabase: ConfigDatabaseImpl,
    keybindingsIOManager: KeybindingsIOManager): void {

  configDatabase.setConfigNoWrite(SESSION_CONFIG, userStoredConfig.sessions);
  configDatabase.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, userStoredConfig.commandLineActions);

  delete userStoredConfig.sessions;
  delete userStoredConfig.commandLineActions;
  configDatabase.setConfig(GENERAL_CONFIG, userStoredConfig);

  configDatabase.onChange((event: ConfigChangeEvent): void => {
    if (event.key === GENERAL_CONFIG) {
      //Check if the selected keybindings changed. If so update and broadcast the system config.
      const oldGeneralConfig = <GeneralConfig> event.oldConfig;
      const newGeneralConfig = <GeneralConfig> event.newConfig;
      if (newGeneralConfig != null) {
        if (oldGeneralConfig == null || oldGeneralConfig.keybindingsName !== newGeneralConfig.keybindingsName) {
          const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
          systemConfig.keybindingsFile = keybindingsIOManager.readKeybindingsFileByName(newGeneralConfig.keybindingsName);
          configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
        }
      }
    }

    broadcastConfigToWindows(event);
  });
}

function broadcastConfigToWindows(event: ConfigChangeEvent): void {
  const newConfigMsg: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    key: event.key,
    config: event.newConfig
  };
  sendMessageToAllWindows(newConfigMsg);
}

function sendMessageToAllWindows(msg: Messages.Message): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (LOG_FINE) {
      _log.debug("Broadcasting message to all windows");
    }
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  }
}


export class ConfigDatabaseImpl implements ConfigDatabase {
  private _configDb = new Map<ConfigKey, any>();
  private _onChangeEventEmitter = new EventEmitter<ConfigChangeEvent>();
  onChange: Event<ConfigChangeEvent>;
  private _log: Logger;

  constructor() {
    this.onChange = this._onChangeEventEmitter.event;
    this._log = getLogger("ConfigDatabaseImpl", this);
  }

  getConfig(key: ConfigKey): any {
    if (key === "*") {
      // Wildcard fetch all.
      const result = {};

      for (const [dbKey, value] of this._configDb.entries()) {
        result[dbKey] = value;
      }
      freezeDeep(result);
      return result;
    } else {
      const result = this._configDb.get(key);
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
      this._configDb.set(key, newConfig);
    } else {
      this._configDb.set(key, freezeDeep(_.cloneDeep(newConfig)));
    }

    this._onChangeEventEmitter.fire({key, oldConfig, newConfig: this.getConfig(key)});
  }

  setConfig(key: ConfigKey, newConfig: any): void {
    if (newConfig == null) {
      this._log.warn("setConfig() newConfig is null for key ", key);
    }

    this.setConfigNoWrite(key, newConfig);
    if ([GENERAL_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, SESSION_CONFIG, "*"].indexOf(key) !== -1) {
      this._writeConfigurationFile();
    }
  }
  
  private _writeConfigurationFile(): void {
    const cleanConfig = <UserStoredConfig> this.getConfigCopy(GENERAL_CONFIG);
    cleanConfig.commandLineActions = this.getConfig(COMMAND_LINE_ACTIONS_CONFIG);
    cleanConfig.sessions = this.getConfig(SESSION_CONFIG);

    const filename = getConfigurationFilename();
    const formattedConfig = JSON.stringify(cleanConfig, null, "  ");
    fs.writeFileSync(filename, formattedConfig);
  }
}
