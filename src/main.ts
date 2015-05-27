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
    mainWindow = new BrowserWindow({width: 800, height: 600});

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
      
    default:
      break;
  }
  
  event.sender.send(Messages.CHANNEL_NAME, reply);
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  let reply: Messages.ConfigMessage = { type: Messages.MessageType.CONFIG, config: getConfig() };
  return reply;
}

function handleThemesRequest(msg: Messages.ThemesRequestMessage): Messages.ThemesMessage {
  let reply: Messages.ThemesMessage = { type: Messages.MessageType.THEMES, themes: getThemes() };
  return reply;
}

main();
