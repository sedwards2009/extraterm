/*
 * Copyright 2014-2019 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
import * as SourceMapSupport from 'source-map-support';

import * as child_process from 'child_process';
import { Command } from 'commander';
import {app, BrowserWindow, ipcMain as ipc, clipboard, dialog, screen, webContents, Tray, Menu} from 'electron';
import { BulkFileState } from 'extraterm-extension-api';
import fontInfo = require('fontinfo');
import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as os from 'os';

import {BulkFileStorage, BufferSizeEvent, CloseEvent} from './bulk_file_handling/BulkFileStorage';
import { SystemConfig, FontInfo, injectConfigDatabase, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG, TitleBarStyle, ConfigChangeEvent, SingleWindowConfiguration, UserStoredConfig } from '../Config';
import {FileLogWriter, getLogger, addLogWriter} from "extraterm-logging";
import { PtyManager } from './pty/PtyManager';
import * as ResourceLoader from '../ResourceLoader';
import * as ThemeTypes from '../theme/Theme';
import {ThemeManager, GlobalVariableMap} from '../theme/ThemeManager';
import * as Messages from '../WindowMessages';
import { MainExtensionManager } from './extension/MainExtensionManager';
import { log } from "extraterm-logging";
import { KeybindingsIOManager } from './KeybindingsIOManager';

import { ConfigDatabaseImpl, isThemeType, EXTRATERM_CONFIG_DIR, getUserSyntaxThemeDirectory, getUserTerminalThemeDirectory, getUserKeybindingsDirectory, readAndInitializeConfigs, setupAppData, KEYBINDINGS_OSX, KEYBINDINGS_PC } from './MainConfig';
import { GlobalKeybindingsManager } from './GlobalKeybindings';
import { doLater } from 'extraterm-later';
import { getAvailableFontsSync } from './FontList';
import { bestOverlap } from './RectangleMatch';

const LOG_FINE = false;

SourceMapSupport.install();

// crashReporter.start(); // Report crashes

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: Electron.BrowserWindow = null;

const LOG_FILENAME = "extraterm.log";
const THEMES_DIRECTORY = "themes";
const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";
const PNG_ICON_PATH = "../../resources/logo/extraterm_small_logo_256x256.png";
const ICO_ICON_PATH = "../../resources/logo/extraterm_small_logo.ico";
const PACKAGE_JSON_PATH = "../../../package.json";


let themeManager: ThemeManager;
let ptyManager: PtyManager;
let configDatabase: ConfigDatabaseImpl;
let tagCounter = 1;
let titleBarStyle: TitleBarStyle = "compact";
let bulkFileStorage: BulkFileStorage = null;
let extensionManager: MainExtensionManager = null;
let packageJson: any = null;
let keybindingsIOManager: KeybindingsIOManager = null;
let globalKeybindingsManager: GlobalKeybindingsManager = null;


function main(): void {
  let failed = false;
  configDatabase = new ConfigDatabaseImpl();

  setupAppData();
  setupLogging();

  app.commandLine.appendSwitch("disable-smooth-scrolling"); // Turn off the sluggish scrolling.
  app.commandLine.appendSwitch("high-dpi-support", "true");
  app.commandLine.appendSwitch("disable-color-correct-rendering");

  if (process.platform === "darwin") {
    setupOSX();
  }

  _log.startRecording();

  // commander assumes that the first two values in argv are 'node' and 'blah.js' and then followed by the args.
  // This is not the case when running from a packaged Electron app. Here you have first value 'appname' and then args.
  const normalizedArgv = process.argv[0].includes('extraterm') ? ["node", "extraterm", ...process.argv.slice(1)]
                            : process.argv;
  const parsedArgs = new Command("extraterm");

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  parsedArgs.option('-c, --cygwinDir [cygwinDir]', 'Location of the cygwin directory []')
    .option('-d, --dev-tools [devTools]', 'Open the dev tools on start up')
    .option('--force-device-scale-factor []', '(This option is used by Electron)')
    .parse(normalizedArgv);

  setupExtensionManager();
  setupKeybindingsIOManager();
  setupThemeManager();

  const userStoredConfig = readAndInitializeConfigs(themeManager, configDatabase, keybindingsIOManager, getFonts());
  titleBarStyle = userStoredConfig.titleBarStyle;
  packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "UTF-8"));
  const systemConfig = systemConfiguration(userStoredConfig, null);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  if ( ! setupPtyManager()) {
    failed = true;
  }

  if (failed) {
    dialog.showErrorBox("Sorry, something went wrong",
      "Something went wrong while starting up Extraterm.\n" +
      "Message log is:\n" + _log.getFormattedLogMessages());
    process.exit(1);
    return;
  }
  
  _log.stopRecording();

  setupDefaultSessions();
  
  // Quit when all windows are closed.
  app.on('window-all-closed', function() {
    if (bulkFileStorage !== null) {
      bulkFileStorage.dispose();
    }
    app.quit();
  });

  // This method will be called when Electron has done everything
  // initialization and ready for creating browser windows.
  app.on('ready', () => electronReady(parsedArgs));
}

function setupExtensionManager(): void {
  extensionManager = new MainExtensionManager([path.join(__dirname, "../../../extensions" )]);
  extensionManager.scan();
  extensionManager.startUp();
}

function setupKeybindingsIOManager(): void {
  keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager);
  keybindingsIOManager.scan();
}

function setupThemeManager(): void {
  // Themes
  const themesDir = path.join(__dirname, '../../resources', THEMES_DIRECTORY);
  themeManager = new ThemeManager({
    css: [themesDir],
    syntax: [getUserSyntaxThemeDirectory()],
    terminal: [getUserTerminalThemeDirectory()]}, extensionManager);
  injectConfigDatabase(themeManager, configDatabase);
}

function electronReady(parsedArgs: Command): void {
  setupBulkFileStorage();
  setupIpc();
  setupTrayIcon();
  setupGlobalKeybindingsManager();
  setUpMenu();
  openWindow(parsedArgs);
}

function setupBulkFileStorage(): void {
  bulkFileStorage = new BulkFileStorage(os.tmpdir());
  bulkFileStorage.onWriteBufferSize(sendBulkFileWriteBufferSizeEvent);
  bulkFileStorage.onClose(sendBulkFileStateChangeEvent);
}

//-------------------------------------------------------------------------

let tray: Tray = null;

function setupTrayIcon(): void {
  createTrayIcon();
  configDatabase.onChange((e: ConfigChangeEvent) => {
    if (e.key === "general") {
      createTrayIcon();
    }
  });
}

function createTrayIcon(): void {
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);

  if (generalConfig.showTrayIcon) {
    if (tray == null) {
      let iconFilename = "";
      if (process.platform === "darwin") {
        iconFilename = path.join(__dirname, "../../resources/tray/macOSTrayIconTemplate.png");
      } else if (process.platform === "linux") {
        iconFilename = path.join(__dirname, "../../resources/tray/extraterm_tray.png");
      } else {
        iconFilename = path.join(__dirname, "../../resources/tray/extraterm_small_logo.ico");
      }

      tray = new Tray(iconFilename);
      tray.setToolTip("Extraterm");

      if (process.platform === "darwin") {
        tray.setPressedImage(path.join(__dirname, "../../resources/tray/macOSTrayIconHighlight.png"));
      }

      const contextMenu = Menu.buildFromTemplate([
        {label: "Maximize", type: "normal", click: maximizeAllWindows},
        {label: "Minimize", type: "normal", click: minimizeAllWindows},
        {label: "Restore", type: "normal", click: restoreAllWindows},
      ]);
      tray.setContextMenu(contextMenu);

      tray.on("click", toggleAllWindows);
    }
  } else {
    if (tray != null) {
      tray.destroy();
      tray = null;
    }
  }
}

function toggleAllWindows(): void {
  if (anyWindowsMinimized()) {
    restoreAllWindows();
  } else {
    minimizeAllWindows();
  }
}

function anyWindowsMinimized(): boolean {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isMinimized() || ! window.isVisible()) {
      return true;
    }
  }
  return false;
}

function maximizeAllWindows(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.show();
    window.maximize();
    if (process.platform !== "linux") {
      window.moveTop();
    }
  }
}

function minimizeAllWindows(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
    if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
      window.hide();
    } else {
      window.minimize();
    }
  }
}

function restoreAllWindows(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);

    const bounds = generalConfig.windowConfiguration[0];
    if (process.platform === "linux") {
      // On Linux, if a window is the width or height of the screen then
      // Electron (2.0.13) resizes them (!) to be smaller for some annoying
      // reason. This is a hack to make sure that windows are restored with
      // the correct dimensions.
      window.setBounds(bounds);
      window.setMinimumSize(bounds.width, bounds.height);
      if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
        window.show();
      }
      window.restore();
  
      doLater(() => {
        window.setMinimumSize(10, 10);
      }, 100);
    } else {

      // Windows and macOS
      if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
        if (bounds.isMaximized === true) {
          window.maximize();
        }
        checkWindowBoundsLater(mainWindow, bounds);

        window.show();
      }
      window.restore();
      
      doLater(() => {
        window.moveTop();
        window.focus();
      });
  }
  }
}

function setupGlobalKeybindingsManager(): void {
  globalKeybindingsManager = new GlobalKeybindingsManager(keybindingsIOManager, configDatabase);
  globalKeybindingsManager.onMaximizeWindow(maximizeAllWindows);
  globalKeybindingsManager.onToggleShowHideWindow(toggleAllWindows);
  globalKeybindingsManager.onShowWindow(restoreAllWindows);
  globalKeybindingsManager.onHideWindow(minimizeAllWindows);
}

function setUpMenu(): void {
  Menu.setApplicationMenu(null);
}

function openWindow(parsedArgs: Command): void {
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const themeInfo = themeManager.getTheme(generalConfig.themeGUI);

  // Create the browser window.
  const options = <Electron.BrowserWindowConstructorOptions> {
    width: 1200,
    height: 600,
    webPreferences: {
      experimentalFeatures: true,
      nodeIntegration: true
    },
    title: "Extraterm",
    backgroundColor: themeInfo.loadingBackgroundColor,
  };

  if (process.platform === "darwin") {
    if (generalConfig.titleBarStyle === "native") {
      options.frame = true;
    } else {
      if (generalConfig.titleBarStyle === "theme") {
        options.titleBarStyle = "hidden";
      } else {
        // Compact
        options.titleBarStyle = "hiddenInset";
      }
    }
  } else {
    options.frame = generalConfig.titleBarStyle === "native";
  }

  // Restore the window position and size from the last session.
  const dimensions = getWindowDimensionsFromConfig(0);
  if (dimensions != null) {
    options.x = dimensions.x;
    options.y = dimensions.y;
    options.width = dimensions.width;
    options.height = dimensions.height;
  }

  if (process.platform === "win32") {
    options.icon = path.join(__dirname, ICO_ICON_PATH);
  } else if (process.platform === "linux") {
    options.icon = path.join(__dirname, PNG_ICON_PATH);
  }
  mainWindow = new BrowserWindow(options);

  if ((<any>parsedArgs).devTools) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.setMenu(null);

  // Emitted when the window is closed.
  const mainWindowWebContentsId = mainWindow.webContents.id;
  mainWindow.on("closed", () => {
    cleanUpPtyWindow(mainWindowWebContentsId);
    mainWindow = null;
  });
  
  mainWindow.on("close", saveAllWindowDimensions);
  mainWindow.on("resize", saveAllWindowDimensions);
  mainWindow.on("maximize", saveAllWindowDimensions);
  mainWindow.on("unmaximize", saveAllWindowDimensions);

  checkWindowBoundsLater(mainWindow, dimensions);

  const params = "?loadingBackgroundColor=" + themeInfo.loadingBackgroundColor.replace("#", "") +
    "&loadingForegroundColor=" + themeInfo.loadingForegroundColor.replace("#", "");

  // and load the index.html of the app.
  mainWindow.loadURL(ResourceLoader.toUrl("render_process/main.html") + params);

  mainWindow.webContents.on('devtools-closed', () => {
    sendDevToolStatus(mainWindow, false);
  });
  
  mainWindow.webContents.on('devtools-opened', () => {
    sendDevToolStatus(mainWindow, true);
  });
}

function checkWindowBoundsLater(window: BrowserWindow, desiredConfig: SingleWindowConfiguration): void {
  doLater(() => {
    const windowBounds = window.getNormalBounds();

    // Figure out which Screen this window is meant to be on.
    const windowDisplay = matchWindowToDisplay(window);
    const newDimensions: Electron.Rectangle = { ...windowBounds };

    let updateNeeded = false;

    if (desiredConfig != null && desiredConfig.isMaximized === true) {
      if (windowBounds.x !== windowDisplay.workArea.x ||
          windowBounds.y !== windowDisplay.workArea.y ||
          windowBounds.width !== windowDisplay.workArea.width ||
          windowBounds.height !== windowDisplay.workArea.height) {

        window.maximize();
      }
    } else {

      if (desiredConfig != null) {
        if (newDimensions.width < desiredConfig.width) {
          newDimensions.width = desiredConfig.width;
          updateNeeded = true;
        }
        if (newDimensions.height < desiredConfig.height) {
          newDimensions.height = desiredConfig.height;
          updateNeeded = true;
        }
      }

      // Clamp the width/height to fit on the display.
      if (newDimensions.width > windowDisplay.workArea.width) {
        newDimensions.width = windowDisplay.workArea.width;
        updateNeeded = true;
      }
      if (newDimensions.height > windowDisplay.workArea.height) {
        newDimensions.height = windowDisplay.workArea.height;
        updateNeeded = true;
      }

      // Slide the window to avoid being half off the display.
      if (newDimensions.x < windowDisplay.workArea.x) {
        newDimensions.x = windowDisplay.workArea.x;
        updateNeeded = true;
      }
      if (newDimensions.y < windowDisplay.workArea.y) {
        newDimensions.y = windowDisplay.workArea.y;
        updateNeeded = true;
      }

      const displayRightEdgeX = windowDisplay.workArea.width + windowDisplay.workArea.x;
      if (newDimensions.width + newDimensions.x > displayRightEdgeX) {
        newDimensions.x = displayRightEdgeX - newDimensions.width;
        updateNeeded = true;
      }

      const displayBottomEdgeY = windowDisplay.workArea.height + windowDisplay.workArea.y;
      if (newDimensions.height + newDimensions.y > displayBottomEdgeY) {
        newDimensions.y = displayBottomEdgeY - newDimensions.height;
        updateNeeded = true;
      }

      if (updateNeeded) {
        // Enforce minimum and sane width/height values.
        newDimensions.height = Math.max(100, newDimensions.height);
        newDimensions.width = Math.max(100, newDimensions.width);
      }
    }

    if (updateNeeded) {
      mainWindow.setBounds(newDimensions);
    }
  });
}

function matchWindowToDisplay(window: BrowserWindow): Electron.Display {
  const displays = screen.getAllDisplays();
  const displayAreas = displays.map(d => d.workArea);

  const matchIndex = bestOverlap(window.getNormalBounds(), displayAreas);
  if (matchIndex === -1) {
    return screen.getPrimaryDisplay();
  }
  return displays[matchIndex];
}

function saveAllWindowDimensions(): void {
  const windowId = 0; 
  const rect = mainWindow.getNormalBounds();
  const isMaximized = mainWindow.isMaximized();

  const newGeneralConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);

  if (newGeneralConfig.windowConfiguration == null) {
    newGeneralConfig.windowConfiguration = {};
  }
  newGeneralConfig.windowConfiguration[windowId] = {
    isMaximized,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
  configDatabase.setConfig(GENERAL_CONFIG, newGeneralConfig);
}

function getWindowDimensionsFromConfig(windowId: number): SingleWindowConfiguration {
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  if (generalConfig.windowConfiguration == null) {
    return null;
  }
  const singleWindowConfig = generalConfig.windowConfiguration[windowId];
  if (singleWindowConfig == null) {
    return null;
  }
  return singleWindowConfig;
}

function setupLogging(): void {
  const logFilePath = path.join(app.getPath('appData'), EXTRATERM_CONFIG_DIR, LOG_FILENAME);
  if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath);
  }

  const logWriter = new FileLogWriter(logFilePath);
  addLogWriter(logWriter);
  _log.info("Recording logs to ", logFilePath);
}

const _log = getLogger("main");

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(config: GeneralConfig, systemConfig: SystemConfig): SystemConfig {
  let homeDir = app.getPath('home');
  
  const keybindingsFile = keybindingsIOManager.readKeybindingsFileByName(config.keybindingsName);
  return {
    homeDir,
    applicationVersion: packageJson.version,
    keybindingsFile,
    keybindingsInfoList: keybindingsIOManager.getInfoList(),
    availableFonts: getFonts(),
    titleBarStyle,
    userTerminalThemeDirectory: getUserTerminalThemeDirectory(),
    userSyntaxThemeDirectory: getUserSyntaxThemeDirectory()
  };
}

function setupOSX(): void {
  child_process.execFileSync("defaults", ["write",
    "com.electron.extraterm", "ApplePressAndHoldEnabled", "-bool", "false"]);
}

function getFonts(): FontInfo[] {
  const allAvailableFonts = getAvailableFontsSync();
  const usableFonts = allAvailableFonts.filter(fontInfo => {
    const path = fontInfo.path.toLowerCase();
    if ( ! path.endsWith(".ttf") && ! path.endsWith(".otf") && ! path.endsWith(".dfont")) {
      return false;
    }
    if (fontInfo.italic || fontInfo.style.indexOf("Oblique") !== -1) {
      return false;
    }
    if (fontInfo.weight > 600) {
      return false;
    }

    return true;
  });

  const systemFonts = usableFonts.map(result => {
    const name = result.family + (result.style==="Regular" ? "" : " " + result.style) +
      (result.italic && result.style.indexOf("Italic") === -1 ? " Italic" : "");
    const fontInfo: FontInfo = {
      name: name,
      path: pathToUrl(result.path),
      postscriptName: result.postscriptName
    };
    return fontInfo;
  } );
  
  const allFonts = [...getBundledFonts(), ...systemFonts];
  const fonts = _.uniqBy(allFonts, x => x.postscriptName);
  return fonts;
}

function getBundledFonts(): FontInfo[] {
  const fontsDir = path.join(__dirname, TERMINAL_FONTS_DIRECTORY);
  const result: FontInfo[] = [];
  if (fs.existsSync(fontsDir)) {
    const contents = fs.readdirSync(fontsDir);
    contents.forEach( (item) => {
      if (item.endsWith(".ttf")) {
        const ttfPath = path.join(fontsDir, item);
        const fi = fontInfo(ttfPath);
        result.push( {
          path: pathToUrl(ttfPath),
          name: fi.name.fontName,
          postscriptName: fi.name.postscriptName
        });
      }
    });
  }
  
  return result;
}

function pathToUrl(path: string): string {
  if (process.platform === "win32") {
    return path.replace(/\\/g, "/");
  }
  return path;
}

//-------------------------------------------------------------------------
// 
//  ### ######   #####  
//   #  #     # #     # 
//   #  #     # #       
//   #  ######  #       
//   #  #       #       
//   #  #       #     # 
//  ### #        #####  
//
//-------------------------------------------------------------------------

function setupIpc(): void {
  ipc.on(Messages.CHANNEL_NAME, handleIpc);
}

function handleIpc(event: Electron.Event, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;
  
  if (LOG_FINE) {
    _log.debug("Main IPC incoming: ",msg);
  }
  
  switch(msg.type) {
    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;
      
    case Messages.MessageType.CONFIG:
      handleConfig(<Messages.ConfigMessage> msg);
      break;
      
    case Messages.MessageType.FRAME_DATA_REQUEST:
      _log.debug('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;
      
    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest();
      break;
      
    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      handleThemeContentsRequest(event.sender, <Messages.ThemeContentsRequestMessage> msg);
      break;
      
    case Messages.MessageType.THEME_RESCAN:
      reply = handleThemeRescan();
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
      
    case Messages.MessageType.PTY_OUTPUT_BUFFER_SIZE:
      handlePtyOutputBufferSize(<Messages.PtyOutputBufferSize> msg);
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
      
    case Messages.MessageType.WINDOW_MINIMIZE_REQUEST:
      minimizeAllWindows();
      break;

    case Messages.MessageType.WINDOW_MAXIMIZE_REQUEST:
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;

    case Messages.MessageType.NEW_TAG_REQUEST:
      const ntrm = <Messages.NewTagRequestMessage> msg;
      reply = handleNewTagRequest(ntrm);
      if (ntrm.async === false) {
        event.returnValue = reply;
        return;
      }
      break;

    case Messages.MessageType.BULK_FILE_CREATE:
      const createBulkFileReply = handleCreateBulkFile(<Messages.BulkFileCreateMessage> msg);
      event.returnValue = createBulkFileReply;
      break;

    case Messages.MessageType.BULK_FILE_WRITE:
      handleWriteBulkFile(<Messages.BulkFileWriteMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_CLOSE:
      handleCloseBulkFile(<Messages.BulkFileCloseMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_REF:
      handleRefBulkFile(<Messages.BulkFileRefMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_DEREF:
      handleDerefBulkFile(<Messages.BulkFileDerefMessage> msg);
      break;

    case Messages.MessageType.EXTENSION_METADATA_REQUEST:
      event.returnValue = handleExtensionMetadataRequest();
      return;

    case Messages.MessageType.COPY_KEYBINDINGS:
      handleKeybindingsCopy(<Messages.KeybindingsCopyMessage> msg);
      break;

    case Messages.MessageType.DELETE_KEYBINDINGS:
      handleKeybindingsDelete(<Messages.KeybindingsDeleteMessage> msg);
      break;

    case Messages.MessageType.RENAME_KEYBINDINGS:
      handleKeybindingsRename(<Messages.KeybindingsRenameMessage> msg);
      break;

    case Messages.MessageType.READ_KEYBINDINGS_REQUEST:
      reply = handleKeybindingsReadRequest(<Messages.KeybindingsReadRequestMessage>msg);
      break;

    case Messages.MessageType.UPDATE_KEYBINDINGS:
      handleKeybindingsUpdate(<Messages.KeybindingsUpdateMessage>msg);
      break;

    case Messages.MessageType.GLOBAL_KEYBINDINGS_ENABLE:
      handleGlobalKeybindingsEnable(<Messages.GlobalKeybindingsEnableMessage>msg);
      break;

    case Messages.MessageType.TERMINAL_THEME_REQUEST:
      handleTerminalThemeRequest(event.sender, <Messages.TerminalThemeRequestMessage>msg);
      break;

    default:
      break;
  }
  
  if (reply !== null) {
    if (LOG_FINE) {
      _log.debug("Replying: ", reply);
    }
    event.sender.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  const reply: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    key: msg.key,
    config: configDatabase.getConfig(msg.key)
  };
  return reply;
}

function handleConfig(msg: Messages.ConfigMessage): void {
  if (LOG_FINE) {
    _log.debug("Incoming new config: ", msg);
  }
  configDatabase.setConfig(msg.key, msg.config);
}

function handleThemeListRequest(): Messages.ThemeListMessage {
  const reply: Messages.ThemeListMessage = { type: Messages.MessageType.THEME_LIST, themeInfo: themeManager.getAllThemes() };
  return reply;
}

async function handleThemeContentsRequest(webContents: Electron.WebContents, 
  msg: Messages.ThemeContentsRequestMessage): Promise<void> {

  const globalVariables: GlobalVariableMap = new Map();

  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  globalVariables.set("extraterm-gpu-driver-workaround", generalConfig.gpuDriverWorkaround);
  globalVariables.set("extraterm-titlebar-style", generalConfig.titleBarStyle);
  globalVariables.set("extraterm-platform", process.platform);
  globalVariables.set("extraterm-margin-style", generalConfig.terminalMarginStyle);
  globalVariables.set("extraterm-window-background-mode", generalConfig.windowBackgroundMode);
  globalVariables.set("extraterm-window-background-transparency-percent", generalConfig.windowBackgroundTransparencyPercent);

  try {
    const renderResult = await themeManager.render(msg.themeType, globalVariables);

    const themeContents = renderResult.themeContents;
    const reply: Messages.ThemeContentsMessage = {
      type: Messages.MessageType.THEME_CONTENTS,
      themeType: msg.themeType,
      themeContents: themeContents,
      success: true,
      errorMessage: renderResult.errorMessage
    };
    webContents.send(Messages.CHANNEL_NAME, reply);

  } catch(err) {
    const reply: Messages.ThemeContentsMessage = {
      type: Messages.MessageType.THEME_CONTENTS, 
      themeType: msg.themeType,
      themeContents: null,
      success: false,
      errorMessage: err.message
    };
    webContents.send(Messages.CHANNEL_NAME, reply);
  }
}

function handleThemeRescan(): Messages.ThemeListMessage {
  themeManager.rescan();

  const userStoredConfig = configDatabase.getConfigCopy(GENERAL_CONFIG);
  if ( ! isThemeType(themeManager.getTheme(userStoredConfig.themeSyntax), 'syntax')) {
    userStoredConfig.themeSyntax = ThemeTypes.FALLBACK_SYNTAX_THEME;
    configDatabase.setConfig(GENERAL_CONFIG, userStoredConfig);
  }

  return handleThemeListRequest();
}

function handleTerminalThemeRequest(webContents: Electron.WebContents, msg: Messages.TerminalThemeRequestMessage): void {
  const terminalTheme = themeManager.getTerminalTheme(msg.id);
  const reply: Messages.TerminalThemeMessage = {
    type: Messages.MessageType.TERMINAL_THEME,
    terminalTheme
  };

  webContents.send(Messages.CHANNEL_NAME, reply);
}

const ptyToSenderMap = new Map<number, number>();

function setupPtyManager(): boolean {
  try {
    ptyManager = new PtyManager(extensionManager);
    injectConfigDatabase(ptyManager, configDatabase);

    ptyManager.onPtyData(event => {
      const senderId = ptyToSenderMap.get(event.ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }
      const msg: Messages.PtyOutput = { type: Messages.MessageType.PTY_OUTPUT, id: event.ptyId, data: event.data };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    ptyManager.onPtyExit(ptyId => {
      const senderId = ptyToSenderMap.get(ptyId);
      if (senderId == null) {
        return;
      }
      const sender = webContents.fromId(senderId);
      if (sender == null || sender.isDestroyed()) {
        return;
      }

      const msg: Messages.PtyClose = { type: Messages.MessageType.PTY_CLOSE, id: ptyId };
      sender.send(Messages.CHANNEL_NAME, msg);
    });

    ptyManager.onPtyAvailableWriteBufferSizeChange(event => {
      const senderId = ptyToSenderMap.get(event.ptyId);
      const sender = webContents.fromId(senderId);
      if (sender != null && ! sender.isDestroyed()) {
        const msg: Messages.PtyInputBufferSizeChange = {
          type: Messages.MessageType.PTY_INPUT_BUFFER_SIZE_CHANGE,
          id: event.ptyId,
          totalBufferSize: event.bufferSizeChange.totalBufferSize,
          availableDelta:event.bufferSizeChange.availableDelta
        };
        sender.send(Messages.CHANNEL_NAME, msg);
      }
    });

    return true;
  } catch(err) {
    _log.severe("Error occured while creating the PTY connector factory: " + err.message);
    return false;
  }
}

function setupDefaultSessions(): void {
  const sessions = configDatabase.getConfigCopy(SESSION_CONFIG);
  if (sessions == null || sessions.length === 0) {
    const newSessions = ptyManager.getDefaultSessions();
    configDatabase.setConfig(SESSION_CONFIG, newSessions);
  }
}

function handlePtyCreate(sender: Electron.WebContents, msg: Messages.CreatePtyRequestMessage): Messages.CreatedPtyMessage {
  const ptyId = ptyManager.createPty(msg.sessionUuid, msg.env, msg.columns, msg.rows);
  _log.debug(`handlePtyCreate ptyId: ${ptyId}, sender.id: ${sender.id}`);
  ptyToSenderMap.set(ptyId, sender.id);
  const reply: Messages.CreatedPtyMessage = { type: Messages.MessageType.PTY_CREATED, id: ptyId };
  return reply;
}

function handlePtyInput(msg: Messages.PtyInput): void {
  ptyManager.ptyInput(msg.id, msg.data);
}

function handlePtyOutputBufferSize(msg: Messages.PtyOutputBufferSize): void {
  ptyManager.ptyOutputBufferSize(msg.id, msg.size);
}

function handlePtyResize(msg: Messages.PtyResize): void {
  ptyManager.ptyResize(msg.id, msg.columns, msg.rows);
}

function handlePtyCloseRequest(msg: Messages.PtyCloseRequest): void {
  ptyManager.closePty(msg.id);
}

function cleanUpPtyWindow(webContentsId: number): void {
  const closedPtyList: number[] = [];

  for (const [ptyId, senderId] of ptyToSenderMap) {
    if (webContentsId === senderId) {
      ptyManager.closePty(ptyId);
      closedPtyList.push(ptyId);
    }
  }

  for (const ptyId of closedPtyList) {
    ptyToSenderMap.delete(ptyId);
  }
}

//-------------------------------------------------------------------------

function handleDevToolsRequest(sender: Electron.WebContents, msg: Messages.DevToolsRequestMessage): void {
  if (msg.open) {
    sender.openDevTools();
  } else {
    sender.closeDevTools();
  }
}

function sendDevToolStatus(window: Electron.BrowserWindow, open: boolean): void {
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

//-------------------------------------------------------------------------

function handleCreateBulkFile(msg: Messages.BulkFileCreateMessage): Messages.BulkFileCreatedResponseMessage {
  const {identifier, url}  = bulkFileStorage.createBulkFile(msg.metadata, msg.size);
  const reply: Messages.BulkFileCreatedResponseMessage = {type: Messages.MessageType.BULK_FILE_CREATED, identifier, url};
  return reply;
}

function handleWriteBulkFile(msg: Messages.BulkFileWriteMessage): void {
  bulkFileStorage.write(msg.identifier, msg.data);
}

function sendBulkFileWriteBufferSizeEvent(event: BufferSizeEvent): void {
  const msg: Messages.BulkFileBufferSizeMessage = {
    type: Messages.MessageType.BULK_FILE_BUFFER_SIZE,
    identifier: event.identifier,
    totalBufferSize: event.totalBufferSize,
    availableDelta: event.availableDelta
  };
  sendMessageToAllWindows(msg);
}

function sendBulkFileStateChangeEvent(event: CloseEvent): void {
  const msg: Messages.BulkFileStateMessage = {
    type: Messages.MessageType.BULK_FILE_STATE,
    identifier: event.identifier,
    state: event.success ? BulkFileState.COMPLETED : BulkFileState.FAILED
  };
  sendMessageToAllWindows(msg);
}

function sendMessageToAllWindows(msg: Messages.Message): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (LOG_FINE) {
      _log.debug("Broadcasting message to all windows");
    }
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  }
}

function handleCloseBulkFile(msg: Messages.BulkFileCloseMessage): void {
  bulkFileStorage.close(msg.identifier, msg.success);
}

function handleRefBulkFile(msg: Messages.BulkFileRefMessage): void {
  bulkFileStorage.ref(msg.identifier);
}

function handleDerefBulkFile(msg: Messages.BulkFileDerefMessage): void {
  bulkFileStorage.deref(msg.identifier); 
}

function handleExtensionMetadataRequest(): Messages.ExtensionMetadataMessage {
  return {type: Messages.MessageType.EXTENSION_METADATA, extensionMetadata: extensionManager.getExtensionMetadata()};
}

function handleKeybindingsCopy(msg: Messages.KeybindingsCopyMessage): void {
  keybindingsIOManager.copyKeybindings(msg.sourceName, msg.destName);

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function handleKeybindingsDelete(msg: Messages.KeybindingsDeleteMessage): void {
  deleteKeybindings(msg.name);
}

function deleteKeybindings(targetName: string): void {
  keybindingsIOManager.deleteKeybindings(targetName);

  const generalConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);
  if (generalConfig.keybindingsName === targetName) {
    generalConfig.keybindingsName = process.platform === "darwin" ? KEYBINDINGS_OSX : KEYBINDINGS_PC;
    configDatabase.setConfig(GENERAL_CONFIG, generalConfig);
  }

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function handleKeybindingsRename(msg: Messages.KeybindingsCopyMessage): void {
  keybindingsIOManager.copyKeybindings(msg.sourceName, msg.destName);

  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsInfoList = keybindingsIOManager.getInfoList();
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  const generalConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);
  generalConfig.keybindingsName = msg.destName;
  configDatabase.setConfig(GENERAL_CONFIG, generalConfig);

  deleteKeybindings(msg.sourceName);
}

function handleKeybindingsReadRequest(msg: Messages.KeybindingsReadRequestMessage): Messages.KeybindingsReadMessage {
  const keybindings = keybindingsIOManager.readKeybindingsFileByName(msg.name);
  const reply: Messages.KeybindingsReadMessage = {
    type: Messages.MessageType.READ_KEYBINDINGS,
    name: msg.name,
    keybindings
  };
  return reply;
}

function handleKeybindingsUpdate(msg: Messages.KeybindingsUpdateMessage): void {
  keybindingsIOManager.updateKeybindings(msg.name, msg.keybindings);

  // Broadcast the updated bindings.
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.keybindingsFile = keybindingsIOManager.readKeybindingsFileByName(generalConfig.keybindingsName);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function handleGlobalKeybindingsEnable(msg: Messages.GlobalKeybindingsEnableMessage): void {
  globalKeybindingsManager.setEnabled(msg.enabled);
}

main();
