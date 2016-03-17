/*
 * Copyright 2014-2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
import sourceMapSupport = require('source-map-support');

import electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const crashReporter = electron.crashReporter;
const ipc = electron.ipcMain;
const clipboard = electron.clipboard;

import path = require('path');
import fs = require('fs');
import im = require('immutable');
import _ = require('lodash');
import commander = require('commander');
import ptyconnector = require('./ptyconnector');
import resourceLoader = require('./resourceloader');
import Messages = require('./windowmessages');

import ThemeTypes = require('./theme');
type ThemeInfo = ThemeTypes.ThemeInfo;
import ThemeManager = require('./thememanager');

import child_process = require('child_process');
import util = require('./gui/util');
import Logger = require('./logger');

type PtyConnector  = ptyconnector.PtyConnector;
type Pty = ptyconnector.Pty;
type PtyOptions = ptyconnector.PtyOptions;
type EnvironmentMap = ptyconnector.EnvironmentMap;

// Our special 'fake' module which selects the correct pty connector factory implementation.
const PtyConnectorFactory = require("./ptyconnectorfactory");

// Interfaces.
import configInterfaces = require('./config');
type Config = configInterfaces.Config;
type CommandLineAction = configInterfaces.CommandLineAction;
type SessionProfile = configInterfaces.SessionProfile;
type SystemConfig = configInterfaces.SystemConfig;


const LOG_FINE = false;

sourceMapSupport.install();

// crashReporter.start(); // Report crashes

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: GitHubElectron.BrowserWindow = null;

const MAIN_CONFIG = "extraterm.json";
const THEMES_DIRECTORY = "themes";

let themeManager: ThemeManager.ThemeManager;
let config: Config;
let ptyConnector: PtyConnector;
let tagCounter = 1;

function main(): void {

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  commander.option('-c, --cygwinDir [cygwinDir]', 'Location of the cygwin directory []').parse(process.argv);
  
  config = readConfigurationFile();
  config.systemConfig = systemConfiguration(config.sessionProfiles);
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;
  config.expandedProfiles = expandSessionProfiles(config.sessionProfiles, commander);

  ptyConnector = PtyConnectorFactory.factory(config);

  // Themes
  const themesdir = path.join(__dirname, THEMES_DIRECTORY);
  themeManager = ThemeManager.makeThemeManager(themesdir);
  if (themeManager.getTheme(config.theme) === null) {
    config.theme = "default";
  }

  themeManager.registerChangeListener(config.theme, () => {
    sendThemeContents(mainWindow.webContents, config.theme);
  });

  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    ptyConnector.destroy();
    app.quit();
  });

  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', function() {
    
    startIpc();
    
    // Create the browser window.
    const options = {width: 1200, height: 600, "web-preferences": { "experimental-features": true }};
    mainWindow = new BrowserWindow(options);
    mainWindow.setMenu(null);

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      cleanUpPtyWindow(mainWindow);
      mainWindow = null;
    });
    
    // and load the index.html of the app.
    mainWindow.loadURL(resourceLoader.toUrl('main.html'));

    mainWindow.on('devtools-closed', function() {
      sendDevToolStatus(mainWindow, false);
    });
    
    mainWindow.on('devtools-opened', function() {
      sendDevToolStatus(mainWindow, true);
    });

  });
}

const _log = new Logger("main");
function log(msg: any, ...opts: any[]): void {
  _log.debug(msg, ...opts);
}

function mapBadChar(m: string): string {
  const c = m.charCodeAt(0);
  switch (c) {
    case 8:
      return "\\b";
    case 12:
      return "\\f";
    case 13:
      return "\\r";
    case 11:
      return "\\v";
    case 0x22:
      return '\\"';
    default:
      if (c <= 255) {
        return "\\x" + util.to2DigitHex(c);
      } else {
        return "\\u" + util.to2DigitHex( c >> 8) + util.to2DigitHex(c & 0xff);
      }
  }
}

function substituteBadChars(data: string): string {
  return data.replace(/[^ /{},.:;<>!@#$%^&*()+=_'"a-zA-Z0-9-]/g, mapBadChar);
}

function logData(data: string): void {
  log(substituteBadChars(data));
}
// Format a string as a series of JavaScript string literals.
function formatJSData(data: string, maxLen: number = 60): string {
  let buf = "";
  let result = "";
  for (let i=0; i<data.length; i++) {
    buf += substituteBadChars(data[i]);
    if (buf.length+6 >= maxLen) {
      result += "\"" + buf + "\"\n";
      buf = "";
    }
  }
  
  if (buf !== "") {
    result += "\"" + buf + "\"\n";
  }
  return result;
}

function logJSData(data: string): void {
  log(formatJSData(data));
}

/**
 * Expands a list of partial profiles.
 *
 * @param profiles List of user configurable partially filled in profiles.
 * @return List where the profiles are completed and a default is added.
 */
function expandSessionProfiles(profiles: SessionProfile[], options: { cygwinDir?: string }): SessionProfile[] {
  if (process.platform === "win32") {
    // Check for the existance of the user specified cygwin installation.
    let cygwinDir = findOptionCygwinInstallation(options.cygwinDir);
    if (cygwinDir === null) {
      // Find a default cygwin installation.
      let cygwinDir = findCygwinInstallation();
      if (cygwinDir === null) {
        cygwinDir = findBabunCygwinInstallation();
      }
    }
    let canonicalCygwinProfile = cygwinDir !== null ? defaultCygwinProfile(cygwinDir) : null;
    
    const expandedProfiles: SessionProfile[] = [];
    if (profiles !== undefined && profiles !== null) {
      profiles.forEach( profile => {
        switch (profile.type) {
          case configInterfaces.SESSION_TYPE_CYGWIN:
            let templateProfile = canonicalCygwinProfile;
            
            if (profile.cygwinDir !== undefined && profile.cygwinDir !== null) {
              // This profile specifies the location of a cygwin installation.
              templateProfile = defaultCygwinProfile(profile.cygwinDir);
            }
          
            if (templateProfile !== null) {
              const expandedProfile: SessionProfile = {
                name: profile.name,
                type: configInterfaces.SESSION_TYPE_CYGWIN,
                command: profile.command !== undefined ? profile.command : templateProfile.command,
                arguments: profile.arguments !== undefined ? profile.arguments : templateProfile.arguments,
                extraEnv: profile.extraEnv !== undefined ? profile.extraEnv : templateProfile.extraEnv,
                cygwinDir: profile.cygwinDir !== undefined ? profile.cygwinDir : templateProfile.cygwinDir              
              };
              expandedProfiles.push(expandedProfile);
            } else {
              log(`Ignoring session profile '${profile.name}' with type '${profile.type}'. ` +
                `The cygwin installation couldn't be found.`);
            }
          
            break;
            
          case configInterfaces.SESSION_TYPE_BABUN:
            break;
            
          default:
            log(`Ignoring session profile '${profile.name}' with type '${profile.type}'. ` +
              `It is neither ${configInterfaces.SESSION_TYPE_CYGWIN} nor ${configInterfaces.SESSION_TYPE_BABUN}.`);
            break;
        }

      });
    }
    expandedProfiles.push(canonicalCygwinProfile);
    return expandedProfiles;
    
  } else {
    // A 'nix style system.
    const expandedProfiles: SessionProfile[] = [];
    let canonicalProfile = defaultProfile();
    if (profiles !== undefined && profiles !== null) {
      profiles.forEach( profile => {
        switch (profile.type) {
          case undefined:
          case null:
          case configInterfaces.SESSION_TYPE_UNIX:
            let templateProfile = canonicalProfile;
            const expandedProfile: SessionProfile = {
              name: profile.name,
              type: configInterfaces.SESSION_TYPE_UNIX,
              command: profile.command !== undefined ? profile.command : templateProfile.command,
              arguments: profile.arguments !== undefined ? profile.arguments : templateProfile.arguments,
              extraEnv: profile.extraEnv !== undefined ? profile.extraEnv : templateProfile.extraEnv
            };
            expandedProfiles.push(expandedProfile);
            break;
            
          default:
            log(`Ignoring session profile '${profile.name}' with type '${profile.type}'.`);
            break;
        }
      });
    }
    
    expandedProfiles.push(canonicalProfile);
    return expandedProfiles;
  }
}

function defaultProfile(): SessionProfile {
  let shell = "/bin/bash";
  const passwdDb = readPasswd("/etc/passwd");  
  const userRecords = passwdDb.filter( row => row.username === process.env.USER);
  if (userRecords.length !== 0) {
    shell = userRecords[0].shell;
  }

  return {
    name: "Default",
    type: configInterfaces.SESSION_TYPE_UNIX,
    command: shell,
    arguments: ["-l"],
    extraEnv: { }
  };
}

function defaultCygwinProfile(cygwinDir: string): SessionProfile {
  const passwdDb = readPasswd(path.join(cygwinDir, "etc", "passwd"));
  const username = process.env["USERNAME"];
  const userRecords = passwdDb.filter( row => row.username === username);
  if (userRecords.length !== 0) {
    const defaultShell = userRecords[0].shell;
    const homeDir = userRecords[0].homeDir;

    return {
      name: "Cygwin",
      type: configInterfaces.SESSION_TYPE_CYGWIN,
      command: defaultShell,
      arguments: ["-l"],
      extraEnv: { HOME: homeDir },
      cygwinDir: cygwinDir
    };
  } else {
    return null;
  }
}

function findOptionCygwinInstallation(cygwinDir: string): string {
  if (cygwinDir == null) {
    return null;
  }
  if (fs.existsSync(cygwinDir)) {
    log("Found user specified cygwin installation: " + cygwinDir);
    return cygwinDir;
  } else {
    log("Couldn't find the user specified cygwin installation at " + cygwinDir);
    return null;
  }
}
  
function findCygwinInstallation(): string {
  try {
    const regResult: string = <any> child_process.execFileSync("REG",
      ["query","HKLM\\SOFTWARE\\Cygwin\\setup","/v","rootdir"],
      {encoding: "utf8"});
    const parts = regResult.split(/\r/g);
    const regsz = parts[2].indexOf("REG_SZ");
    const cygwinDir = parts[2].slice(regsz+6).trim();
    
    if (fs.existsSync(cygwinDir)) {
      log("Found cygwin installation: " + cygwinDir);
      return cygwinDir;
    } else {
      log("The registry reported the cygwin installation directory at '" + cygwinDir +
        "', but the directory does not exist.");
      return null;
    }
  } catch(e) {
    log("Couldn't find a cygwin installation.");
    return null;
  }
}

function findBabunCygwinInstallation(): string {
  const cygwinDir = path.join(app.getPath('home'), ".babun/cygwin");
  if (fs.existsSync(cygwinDir)) {
    log("Found babun cygwin installation: " + cygwinDir);
    return cygwinDir;
  } else {
    log("Couldn't find a Babun cygwin installation.");
    return null;
  }
}

interface PasswdLine {
  username: string;
  homeDir: string;
  shell: string;
}

function readPasswd(filename: string): PasswdLine[] {
  const fileText = fs.readFileSync(filename, {encoding: 'utf8'});
  const lines = fileText.split(/\n/g);
  return lines.map<PasswdLine>( line => {
    const fields = line.split(/:/g);
    return { username: fields[0], homeDir: fields[5], shell: fields[6] };
  });
}

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(profiles: SessionProfile[]): SystemConfig {
  let homeDir = app.getPath('home');
  return { homeDir: homeDir };
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): Config {
  const filename = path.join(app.getPath('appData'), MAIN_CONFIG);
  let config: Config = { systemConfig: null, expandedProfiles: null };

  if (fs.existsSync(filename)) {
    log("Reading user configuration from " + filename);
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  } else {
    log("Couldn't find user configuration file at " + filename);
  }
  setConfigDefaults(config);
  // FIXME freeze this.
  return config;
}

function setConfigDefaults(config: Config): void {
  config.systemConfig = config.systemConfig === undefined ? null : config.systemConfig;
  config.expandedProfiles = config.expandedProfiles === undefined ? null : config.expandedProfiles;
  config.blinkingCursor = config.blinkingCursor === undefined ? false : config.blinkingCursor;
  config.scrollbackLines = config.scrollbackLines === undefined ? 500000 : config.scrollbackLines;

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
}

/**
 * Write out the configuration to disk.
 * 
 * @param {Object} config The configuration to write.
 */
function writeConfiguration(config: Config): void {
  const cleanConfig = <Config> _.cloneDeep(config);
  cleanConfig.systemConfig = null;
  
  const filename = path.join(app.getPath('appData'), MAIN_CONFIG);
  fs.writeFileSync(filename, JSON.stringify(config));
}

function getConfig(): Config {
  return config;
}

function getFullConfig(): Config {
  const fullConfig = _.cloneDeep(config);
  const themesDir = path.join(__dirname, THEMES_DIRECTORY);
  fullConfig.themePath = path.join(themesDir, config.theme);
  _log.debug("Full config: ",fullConfig);
  return fullConfig;
}

function getThemes(): ThemeInfo[] {
  return themeManager.getAllThemes();
}

//-------------------------------------------------------------------------
// IPC
//-------------------------------------------------------------------------

function startIpc(): void {
  ipc.on(Messages.CHANNEL_NAME, handleIpc);
}

function handleIpc(event: GitHubElectron.IPCMainEvent, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;
  
  if (LOG_FINE) {
    log("Main IPC incoming: ",msg);
  }
  
  switch(msg.type) {
    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;
      
    case Messages.MessageType.FRAME_DATA_REQUEST:
      log('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;
      
    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest(<Messages.ThemeListRequestMessage> msg);
      break;
      
    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      sendThemeContents(event.sender, (<Messages.ThemeContentsRequestMessage> msg).id);
      break;
      
    case Messages.MessageType.PTY_CREATE:
      reply = handlePtyCreate(event.sender, <Messages.CreatePtyRequestMessage> msg);
      break;
      
    case Messages.MessageType.PTY_RESIZE:
      handlePtyResize(<Messages.PtyResize> msg);
      break;
      
    case Messages.MessageType.PTY_INPUT:
      handlePtyInput(<Messages.PtyInput> msg);
      break;
      
    case Messages.MessageType.PTY_CLOSE_REQUEST:
      handlePtyCloseRequest(<Messages.PtyClose> msg);
      break;
      
    case Messages.MessageType.DEV_TOOLS_REQUEST:
      handleDevToolsRequest(event.sender, <Messages.DevToolsRequestMessage> msg);
      break;
      
    case Messages.MessageType.CLIPBOARD_WRITE:
      handleClipboardWrite(<Messages.ClipboardWriteMessage> msg);
      break;
      
    case Messages.MessageType.CLIPBOARD_READ_REQUEST:
      reply = handleClipboardReadRequest(<Messages.ClipboardReadRequestMessage> msg);
      break;
      
    case Messages.MessageType.WINDOW_CLOSE_REQUEST:
      mainWindow.close();
      break;
      
    case Messages.MessageType.CONFIG:
      handleConfig(<Messages.ConfigMessage> msg);
      break;
      
    case Messages.MessageType.NEW_TAG_REQUEST:
      const ntrm = <Messages.NewTagRequestMessage> msg;
      reply = handleNewTagRequest(ntrm);
      if (ntrm.async === false) {
        event.returnValue = reply;
        return;
      }
      break;
    
    default:
      break;
  }
  
  if (reply !== null) {
    if (LOG_FINE) {
      log("Replying: ", reply);
    }
    event.sender.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  const reply: Messages.ConfigMessage = { type: Messages.MessageType.CONFIG, config: getFullConfig() };
  return reply;
}

function handleConfig(msg: Messages.ConfigMessage): void {
  if (LOG_FINE) {
    log("Incoming new config: ",msg);
  }
  
  // Copy in the updated fields.
  const incomingConfig = msg.config;
  config.blinkingCursor = incomingConfig.blinkingCursor;
  config.scrollbackLines = incomingConfig.scrollbackLines;
  config.commandLineActions = incomingConfig.commandLineActions;

  // Write it to disk.
  writeConfiguration(config);

  const newConfigMsg: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    config: getFullConfig()
  };
  
  BrowserWindow.getAllWindows().forEach( (window) => {
    if (LOG_FINE) {
      log("Transmitting new config to window ", window.id);
    }
    window.webContents.send(Messages.CHANNEL_NAME, newConfigMsg);
  });
}

function handleThemeListRequest(msg: Messages.ThemeListRequestMessage): Messages.ThemeListMessage {
  const reply: Messages.ThemeListMessage = { type: Messages.MessageType.THEME_LIST, themeInfo: getThemes() };
  return reply;
}

function sendThemeContents(webContents: GitHubElectron.WebContents, themeId: string): void {
  themeManager.getThemeContents(themeId).then( (themeContents) => {
    const msg: Messages.ThemeContentsMessage = { type: Messages.MessageType.THEME_CONTENTS, 
      id: themeId,
      themeContents: themeContents
    };
    webContents.send(Messages.CHANNEL_NAME, msg);
  });
}

//-------------------------------------------------------------------------

let ptyCounter = 0;
interface PtyTuple {
  windowId: number;
  ptyTerm: Pty;
};

const ptyMap: Map<number, PtyTuple> = new Map<number, PtyTuple>();

function createPty(sender: GitHubElectron.WebContents, file: string, args: string[], env: EnvironmentMap,
    cols: number, rows: number): number {
    
  const ptyEnv = _.clone(env);
  ptyEnv["TERM"] = 'xterm';

  const term = ptyConnector.spawn(file, args, {
      name: 'xterm',
      cols: cols,
      rows: rows,
  //    cwd: process.env.HOME,
      env: ptyEnv } );
      
  ptyCounter++;
  const ptyId = ptyCounter;
  ptyMap.set(ptyId, { windowId: BrowserWindow.fromWebContents(sender).id, ptyTerm: term });
  
  term.onData( (data) => {
    if (LOG_FINE) {
      log("pty process got data for ptyID="+ptyId);
      logJSData(data);
    }
    const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: ptyId, data: data };
    sender.send(Messages.CHANNEL_NAME, msg);    
  });

  term.onExit( () => {
    if (LOG_FINE) {
      log("pty process exited.");
    }
    const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
    sender.send(Messages.CHANNEL_NAME, msg);
    
    term.destroy();
    ptyMap.delete(ptyId);
  });

  return ptyId;
}

function handlePtyCreate(sender: GitHubElectron.WebContents, msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {
  const id = createPty(sender, msg.command, msg.args, msg.env, msg.columns, msg.rows);
  const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: id };
  return reply;
}

function handlePtyInput(msg: Messages.PtyInput): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }

  ptyTerminalTuple.ptyTerm.write(msg.data);
}

function handlePtyResize(msg: Messages.PtyResize): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminalTuple.ptyTerm.resize(msg.columns, msg.rows);  
}

function handlePtyCloseRequest(msg: Messages.PtyCloseRequest): void {
  const ptyTerminalTuple = ptyMap.get(msg.id);
  if (ptyTerminalTuple === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminalTuple.ptyTerm.destroy();
  ptyMap.delete(msg.id);
}

function handleDevToolsRequest(sender: GitHubElectron.WebContents, msg: Messages.DevToolsRequestMessage): void {
  if (msg.open) {
    sender.openDevTools();
  } else {
    sender.closeDevTools();
  }
}

function cleanUpPtyWindow(window: GitHubElectron.BrowserWindow): void {
  mapKeys(ptyMap).forEach( k => {
    const tup = ptyMap.get(k);
    if (tup.windowId === window.id) {
      tup.ptyTerm.destroy();
      ptyMap.delete(k);
    }
  });
}

function sendDevToolStatus(window: GitHubElectron.BrowserWindow, open: boolean): void {
  const msg: Messages.DevToolsStatusMessage = { type: Messages.MessageType.DEV_TOOLS_STATUS, open: open };
  window.webContents.send(Messages.CHANNEL_NAME, msg);
}

function handleClipboardWrite(msg: Messages.ClipboardWriteMessage): void {
  if (msg.text.length !== 0) {
    clipboard.writeText(msg.text);
  }
}

function handleClipboardReadRequest(msg: Messages.ClipboardReadRequestMessage): Messages.ClipboardReadMessage {
  const text = clipboard.readText();
  const reply: Messages.ClipboardReadMessage = { type: Messages.MessageType.CLIPBOARD_READ, text: text };
  return reply;
}

function handleNewTagRequest(msg: Messages.NewTagRequestMessage): Messages.NewTagMessage {
  const reply: Messages.NewTagMessage = { type: Messages.MessageType.NEW_TAG, tag: "" + tagCounter };
  tagCounter++;
  return reply;
}

// FIXME use for-of when it become available instead of this.
function mapKeys<K,V>(map: Map<K,V>): K[] {
  const it = map.keys();
  const keys: K[] = [];
  let iterResult = it.next();
  while (!iterResult.done) {
    keys.push(iterResult.value);
    iterResult = it.next();
  }
  return keys;
}

main();
