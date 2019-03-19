/*
 * Copyright 2014-2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';

import {app, BrowserWindow } from 'electron';
import { ThemeInfo, ThemeType, FALLBACK_TERMINAL_THEME, FALLBACK_SYNTAX_THEME } from '../theme/Theme';

import { Event, SessionConfiguration } from 'extraterm-extension-api';

import { Logger, getLogger } from "extraterm-logging";
import { freezeDeep } from 'extraterm-readonly-toolbox';
import { EventEmitter } from '../utils/EventEmitter';

import {CommandLineAction, SystemConfig, ShowTipsStrEnum, ConfigDatabase, ConfigKey, UserStoredConfig, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG, COMMAND_LINE_ACTIONS_CONFIG, ConfigChangeEvent, FontInfo } from '../Config';

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

export function setupUserConfig(themeManager: ThemeManager, configDatabase: ConfigDatabaseImpl, keybindingsIOManager: KeybindingsIOManager, availableFonts: FontInfo[]): UserStoredConfig {

  const userStoredConfig = readConfigurationFile();

  userStoredConfig.blinkingCursor = _.isBoolean(userStoredConfig.blinkingCursor) ? userStoredConfig.blinkingCursor : false;
  
  if (userStoredConfig.terminalFontSize == null || typeof userStoredConfig.terminalFontSize !== 'number') {
    userStoredConfig.terminalFontSize = 13;
  } else {
    userStoredConfig.terminalFontSize = Math.max(Math.min(1024, userStoredConfig.terminalFontSize), 4);
  }

  if (userStoredConfig.terminalFont == null) {
    userStoredConfig.terminalFont = DEFAULT_TERMINALFONT;
  }

  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeTerminal), 'terminal')) {
    userStoredConfig.themeTerminal = FALLBACK_TERMINAL_THEME;
  }
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeSyntax), 'syntax')) {
    userStoredConfig.themeSyntax = FALLBACK_SYNTAX_THEME;
  }
  if (userStoredConfig.themeGUI === "default" || ! isThemeType(themeManager.getTheme(userStoredConfig.themeGUI), 'gui')) {
    userStoredConfig.themeGUI = "two-dark-ui";
  }

  userStoredConfig.uiScalePercent = Math.min(500, Math.max(5, userStoredConfig.uiScalePercent || 100));

  if (userStoredConfig.terminalMarginStyle == null) {
    userStoredConfig.terminalMarginStyle = "normal";
  }

  if (userStoredConfig.titleBarStyle == null) {
    userStoredConfig.titleBarStyle = "compact";
  }

  if (userStoredConfig.showTrayIcon == null) {
    userStoredConfig.showTrayIcon = false;
  }

  if (userStoredConfig.minimizeToTray == null) {
    userStoredConfig.minimizeToTray = false;
  }

  if (userStoredConfig.autoCopySelectionToClipboard == null) {
    userStoredConfig.autoCopySelectionToClipboard = true;
  }

  if (userStoredConfig.frameByDefault !== true && userStoredConfig.frameByDefault !== false) {
    userStoredConfig.frameByDefault = true;
  }

  // Validate the selected keybindings config value.
  if ( ! keybindingsIOManager.hasKeybindingsName(userStoredConfig.keybindingsName)) {
    userStoredConfig.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  if (userStoredConfig.sessions == null) {
    configDatabase.setConfigNoWrite(SESSION_CONFIG, []);
  } else {
    configDatabase.setConfigNoWrite(SESSION_CONFIG, userStoredConfig.sessions);
  }

  if (userStoredConfig.commandLineActions == null) {
    configDatabase.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, []);
  } else {
    configDatabase.setConfigNoWrite(COMMAND_LINE_ACTIONS_CONFIG, userStoredConfig.commandLineActions);
  }

  if ( ! availableFonts.some( (font) => font.postscriptName === userStoredConfig.terminalFont)) {
    userStoredConfig.terminalFont = DEFAULT_TERMINALFONT;
  }
  
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

  return userStoredConfig;
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


/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): UserStoredConfig {
  const filename = getConfigurationFilename();
  let config: UserStoredConfig = { };

  if (fs.existsSync(filename)) {
    _log.info("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <UserStoredConfig>JSON.parse(configJson);
  } else {
    _log.info("Couldn't find user configuration file at " + filename);
  }
  setConfigDefaults(config);
  return config;
}

function defaultValue<T>(value: T, defaultValue: T): T {
  return value == null ? defaultValue : value;
}

function setConfigDefaults(config: UserStoredConfig): void {
  config.blinkingCursor = defaultValue(config.blinkingCursor, false);
  config.scrollbackMaxLines = defaultValue(config.scrollbackMaxLines, 500000);
  config.scrollbackMaxFrames = defaultValue(config.scrollbackMaxFrames, 100);
  config.showTips = defaultValue<ShowTipsStrEnum>(config.showTips, 'always');
  config.tipTimestamp = defaultValue(config.tipTimestamp, 0);
  config.tipCounter = defaultValue(config.tipCounter, 0);
  
  config.themeTerminal = defaultValue(config.themeTerminal, "default");
  config.themeSyntax = defaultValue(config.themeSyntax, "default");
  config.themeGUI = defaultValue(config.themeGUI, "two-dark-ui");
  config.titleBarStyle = defaultValue(config.titleBarStyle, "compact");
  config.terminalMarginStyle = defaultValue(config.terminalMarginStyle, "normal");
  config.frameByDefault = defaultValue(config.frameByDefault, true);

  if (config.commandLineActions === undefined) {
    const defaultCLA: CommandLineAction[] = [
      { match: 'cd', matchType: 'name', frame: false },      
      { match: 'rm', matchType: 'name', frame: false },
      { match: 'mkdir', matchType: 'name', frame: false },
      { match: 'rmdir', matchType: 'name', frame: false },
      { match: 'mv', matchType: 'name', frame: false },
      { match: 'cp', matchType: 'name', frame: false },
      { match: 'chmod', matchType: 'name', frame: false },
      { match: 'show', matchType: 'name', frame: false }
    ];
    config.commandLineActions = defaultCLA;
  }
  
  if (config.keybindingsName === undefined || config.keybindingsName === "") {
    config.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
  }

  config.sessions = defaultValue(config.sessions, []);

  // Ensure that when reading a config file where args is not defined, we define it as an empty string
  let sessionConfiguration: SessionConfiguration = null;
  for (sessionConfiguration of config.sessions) {
    if (sessionConfiguration.args === undefined) {
      sessionConfiguration.args = "";
    }
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
