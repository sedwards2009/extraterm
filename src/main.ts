/**
 * Copyright 2014-2015 Simon Edwards <simon@simonzone.com>
 */
///<reference path="typings/github-electron/github-electron-main.d.ts" />
/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
import sourceMapSupport = require('source-map-support');
import app = require('app');
import BrowserWindow = require('browser-window');
import path = require('path');
import fs = require('fs');
import im = require('immutable');
import _ = require('lodash');
import crashReporter = require('crash-reporter');
import ipc = require('ipc');
import pty = require('pty.js');

import Config = require('config');
import Theme = require('./theme');
import resourceLoader = require('./resourceloader');
import Messages = require('./windowmessages');

sourceMapSupport.install();
crashReporter.start(); // Report crashes

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: GitHubElectron.BrowserWindow = null;

const CONFIG_FILENAME = "config";
const THEME_CONFIG = "theme.json";
const THEMES_DIRECTORY = "themes";

let themes: im.Map<string, Theme>;
let config: Config;

function main(): void {
  config = readConfigurationFile();
  config.blinkingCursor = _.isBoolean(config.blinkingCursor) ? config.blinkingCursor : false;

  // Themes
  const themesdir = path.join(__dirname, THEMES_DIRECTORY);
  themes = scanThemes(themesdir);
  if (themes.get(config.theme) === undefined) {
    config.theme = "default";
  }
  
  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    if (process.platform !== 'darwin')
      app.quit();
  });

  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', function() {
    
    startIpc();
    
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 1200, height: 600});

    // and load the index.html of the app.
    mainWindow.loadUrl(resourceLoader.toUrl('main.html'));

    // Open the devtools.
    mainWindow.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', function() {
      mainWindow = null;
    });
  });
}

function log(msg: any, ...opts: any[]): void {
  console.log(msg, ...opts);
}

/**
 * Read the configuration.
 * 
 * @returns The configuration object.
 */
function readConfigurationFile(): Config {
  const filename = path.join(app.getPath('appData'), CONFIG_FILENAME);
  let config: Config = {};

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
  const filename = path.join(app.getPath('appData'), CONFIG_FILENAME);
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
  
  log("Main IPC incoming:",msg);
  
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
      
    case Messages.MessageType.PTY_CLOSE:
      handlePtyClose(<Messages.PtyClose> msg);
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
const ptyMap: Map<number, pty.Terminal> = new Map<number, pty.Terminal>();

function createPty(sender: GitHubElectron.WebContents, file: string, args: string[], cols: number, rows: number): number {
  const term = pty.spawn(file, args, {
      name: 'xterm-color',
      cols: cols,
      rows: rows,
  //    cwd: process.env.HOME,
      env: process.env});
      
  ptyCounter++;
  const ptyId = ptyCounter;
  ptyMap[ptyId] = term;
  
  term.on('data', (data) => {
    log("pty process got data.");
    log(data);
    
    const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: ptyId, data: data };
    sender.send(Messages.CHANNEL_NAME, msg);    
  });

  term.on('exit', () => {
    log("pty process exited.");
    const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
    sender.send(Messages.CHANNEL_NAME, msg);
    
    term.destroy();
    ptyMap.delete(ptyId);
  });

  return ptyId;
}

function handlePtyCreate(sender: GitHubElectron.WebContents, msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {
  const id = createPty(sender, msg.command, msg.args, msg.columns, msg.rows);
  const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: id };
  return reply;
}

function handlePtyInput(msg: Messages.PtyInput): void {
  const ptyTerminal: pty.Terminal = ptyMap[msg.id];
  if (ptyTerminal === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminal.write(msg.data);
}

function handlePtyResize(msg: Messages.PtyResize): void {
  const ptyTerminal: pty.Terminal = ptyMap[msg.id];
  if (ptyTerminal === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminal.resize(msg.columns, msg.rows);  
}

function handlePtyClose(msg: Messages.PtyClose): void {
  const ptyTerminal: pty.Terminal = ptyMap[msg.id];
  if (ptyTerminal === undefined) {
    log("WARNING: Input arrived for a terminal which doesn't exist.");
    return;
  }
  ptyTerminal.destroy();
  ptyMap.delete(msg.id);
}

main();
