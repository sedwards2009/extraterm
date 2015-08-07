/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
///<reference path="typings/github-electron/github-electron-main.d.ts" />
/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
import * as sourceMapSupport from 'source-map-support';
import * as app from 'app';
import * as BrowserWindow from 'browser-window';
import * as path from 'path';
import * as fs from 'fs';
import * as im from 'immutable';
import * as _ from 'lodash';
import * as crashReporter from 'crash-reporter';
import * as ipc from 'ipc';
import {PtyConnector as PtyConnector, Pty as Pty, PtyOptions as PtyOptions, EnvironmentMap as EnvironmentMap} from './ptyconnector';
import * as resourceLoader from './resourceloader';
import * as Messages from './windowmessages';
import * as clipboard from 'clipboard';

// Our special 'fake' module which selects the correct pty connector factory implementation.
var PtyConnectorFactory = require("./ptyconnectorfactory");

// Interfaces.
import configInterfaces = require('./config');
type Config = configInterfaces.Config;
type SessionProfile = configInterfaces.SessionProfile;
type SystemConfig = configInterfaces.SystemConfig;

import Theme = require('theme');

sourceMapSupport.install();
crashReporter.start(); // Report crashes

const LOG_FINE = false;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: GitHubElectron.BrowserWindow = null;

const MAIN_CONFIG = "extraterm.json";
const THEME_CONFIG = "theme.json";
const THEMES_DIRECTORY = "themes";

let themes: im.Map<string, Theme>;
let config: Config;
let ptyConnector: PtyConnector;

function main(): void {
  config = readConfigurationFile();
  config.systemConfig = systemConfiguration();
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;

  ptyConnector = PtyConnectorFactory.factory();
  
  // Themes
  const themesdir = path.join(__dirname, THEMES_DIRECTORY);
  themes = scanThemes(themesdir);
  if (themes.get(config.theme) === undefined) {
    config.theme = "default";
  }
  
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
    mainWindow = new BrowserWindow({width: 1200, height: 600});
    mainWindow.setMenu(null);

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      cleanUpPtyWindow(mainWindow);
      mainWindow = null;
    });
    
    // and load the index.html of the app.
    mainWindow.loadUrl(resourceLoader.toUrl('main.html'));

    mainWindow.on('devtools-closed', function() {
      sendDevToolStatus(mainWindow, false);
    });
    
    mainWindow.on('devtools-opened', function() {
      sendDevToolStatus(mainWindow, true);
    });

  });
}



function log(msg: any, ...opts: any[]): void {
  console.log(msg, ...opts);
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
    default:
      return "\\x" + (c < 16 ? "0" : "") + c.toString(16);
  }
}

function substituteBadChars(data: string): string {
  return data.replace(/[^ /{},.:;<>!@#$%^&*()+=_'"a-zA-Z0-9-]/g, mapBadChar);
}

function logData(data: string): void {
  log(substituteBadChars(data));
}

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(): SystemConfig {
  return { homeDir: app.getPath('home') };
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): Config {
  const filename = path.join(app.getPath('appData'), MAIN_CONFIG);
  let config: Config = { systemConfig: null };

  if (fs.existsSync(filename)) {
    const configJson = fs.readFileSync(filename, {encoding: "utf8"});
    config = <Config>JSON.parse(configJson);
  }
  return config;
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

/**
 * Scan for themes.
 * 
 * @param themesdir The directory to scan for themes.
 * @returns Map of found theme config objects.
 */
function scanThemes(themesdir: string): im.Map<string, Theme> {
  let thememap = im.Map<string, Theme>();
  if (fs.existsSync(themesdir)) {
    const contents = fs.readdirSync(themesdir);
    contents.forEach(function(item) {
      var infopath = path.join(themesdir, item, THEME_CONFIG);
      try {
        const infostr = fs.readFileSync(infopath, {encoding: "utf8"});
        const themeinfo = <Theme>JSON.parse(infostr);

        if (validateThemeInfo(themeinfo)) {
          thememap = thememap.set(item, themeinfo);
        }

      } catch(err) {
        console.log("Warning: Unable to read file ",infopath);
      }
    });
    return thememap;
  }
}

/**
 * 
 */
function validateThemeInfo(themeinfo: Theme): boolean {
  return _.isString(themeinfo.name) && themeinfo.name !== "";
}

function getConfig(): Config {
  return config;
}

function getFullConfig(): Config {
  const fullConfig = _.cloneDeep(config);
  const themesDir = path.join(__dirname, THEMES_DIRECTORY);
  fullConfig.themePath = path.join(themesDir, config.theme);
  console.log("Full config: ",fullConfig);
  return fullConfig;
}

function getThemes(): Theme[] {
  return themes.toArray();
}

//-------------------------------------------------------------------------
// IPC
//-------------------------------------------------------------------------

function startIpc(): void {
  ipc.on(Messages.CHANNEL_NAME, handleAsyncIpc);
}

function handleAsyncIpc(event: any, arg: any): void {
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
      
    case Messages.MessageType.THEMES_REQUEST:
      reply = handleThemesRequest(<Messages.ThemesRequestMessage> msg);
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
      
    default:
      break;
  }
  
  if (reply !== null) {
    event.sender.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  const reply: Messages.ConfigMessage = { type: Messages.MessageType.CONFIG, config: getFullConfig() };
  return reply;
}

function handleThemesRequest(msg: Messages.ThemesRequestMessage): Messages.ThemesMessage {
  const reply: Messages.ThemesMessage = { type: Messages.MessageType.THEMES, themes: getThemes() };
  return reply;
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
  ptyEnv["TERM"] = 'xterm-color';

  const term = ptyConnector.spawn(file, args, {
      name: 'xterm-color',
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
      logData(data);
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
  const senderWindow = BrowserWindow.fromWebContents(sender);
  if (msg.open) {
    senderWindow.openDevTools();
  } else {
    senderWindow.closeDevTools();
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
