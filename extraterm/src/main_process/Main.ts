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
import * as SourceMapSupport from "source-map-support";

import * as child_process from "child_process";
import { Command } from "commander";
import { app, BrowserWindow, ipcMain as ipc, clipboard, dialog, screen, webContents, Tray, Menu, MenuItemConstructorOptions } from "electron";
import fontInfo = require("fontinfo");
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import * as os from "os";

import { BulkFileState } from '@extraterm/extraterm-extension-api';
import { doLater } from "extraterm-later";
import { FileLogWriter, getLogger, addLogWriter, log } from "extraterm-logging";

import {BulkFileStorage, BufferSizeEvent, CloseEvent} from "./bulk_file_handling/BulkFileStorage";
import { SystemConfig, FontInfo, injectConfigDatabase, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG, TitleBarStyle, ConfigChangeEvent, SingleWindowConfiguration, UserStoredConfig, ConfigDatabase } from "../Config";
import { PtyManager } from "./pty/PtyManager";
import * as ResourceLoader from "../ResourceLoader";
import * as ThemeTypes from "../theme/Theme";
import {ThemeManager, GlobalVariableMap} from "../theme/ThemeManager";
import * as Messages from "../WindowMessages";
import { MainExtensionManager } from "./extension/MainExtensionManager";
import { KeybindingsIOManager } from "./KeybindingsIOManager";

import { getAvailableFontsSync } from "./FontList";
import { GlobalKeybindingsManager } from "./GlobalKeybindings";
import { ConfigDatabaseImpl, isThemeType, EXTRATERM_CONFIG_DIR, getUserSyntaxThemeDirectory,
  getUserTerminalThemeDirectory, getUserKeybindingsDirectory, setupAppData,
  sanitizeAndIinitializeConfigs, readUserStoredConfigFile, getUserExtensionDirectory } from "./MainConfig";
import { bestOverlap } from "./RectangleMatch";
import { focusElement } from "../render_process/DomUtils";

const LOG_FINE = false;

SourceMapSupport.install();

const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const isDarwin = process.platform === "darwin";

// crashReporter.start(); // Report crashes

let appWindowIds: number[] = [];

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
let keybindingsIOManager: KeybindingsIOManager = null;
let globalKeybindingsManager: GlobalKeybindingsManager = null;

let SetWindowCompositionAttribute: any = null;
let AccentState: any = null;

if (isWindows) {
  SetWindowCompositionAttribute = require("windows-swca").SetWindowCompositionAttribute;
  AccentState = require("windows-swca").ACCENT_STATE;
}

function main(): void {
  let failed = false;
  configDatabase = new ConfigDatabaseImpl();

  setupAppData();
  setupLogging();

  app.commandLine.appendSwitch("disable-smooth-scrolling"); // Turn off the sluggish scrolling.
  app.commandLine.appendSwitch("high-dpi-support", "true");
  app.commandLine.appendSwitch("disable-color-correct-rendering");

  // Needed to allow WebGL context restores. See https://github.com/electron/electron/issues/11934
  app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
  app.disableDomainBlockingFor3DAPIs();

  if (isDarwin) {
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

  const availableFonts = getFonts();

  const userStoredConfig = readUserStoredConfigFile();

  // We have to start up the extension manager before we can scan themes (with the help of extensions)
  // and properly sanitize the config.
  extensionManager = setupExtensionManager(configDatabase, userStoredConfig.activeExtensions);

  keybindingsIOManager = setupKeybindingsIOManager(extensionManager);
  themeManager = setupThemeManager(configDatabase, extensionManager);

  sanitizeAndIinitializeConfigs(userStoredConfig, themeManager, configDatabase, keybindingsIOManager,
    availableFonts);
  titleBarStyle = userStoredConfig.titleBarStyle;
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "UTF-8"));
  const systemConfig = systemConfiguration(userStoredConfig, keybindingsIOManager, availableFonts, packageJson);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  if ( ! userStoredConfig.isHardwareAccelerated) {
    app.disableHardwareAcceleration();
  }

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

function setupExtensionManager(configDatabase: ConfigDatabase,
    initialActiveExtensions: {[name: string]: boolean;}): MainExtensionManager {

  const extensionPaths = [path.join(__dirname, "../../../extensions" )];
  const userExtensionDirectory = getUserExtensionDirectory();
  _log.info(`User extension directory is: ${userExtensionDirectory}`);
  if (fs.existsSync(userExtensionDirectory)) {
    extensionPaths.push(userExtensionDirectory);
  }

  const extensionManager = new MainExtensionManager(extensionPaths);
  injectConfigDatabase(extensionManager, configDatabase);
  extensionManager.startUpExtensions(initialActiveExtensions);
  extensionManager.onDesiredStateChanged(() => {
    sendMessageToAllWindows(handleExtensionDesiredStateRequest());
  });
  return extensionManager;
}

function setupKeybindingsIOManager(extensionManager: MainExtensionManager): KeybindingsIOManager {
  const keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager);

  keybindingsIOManager.onUpdate(() => {
    updateSystemConfigKeybindings();
  });

  return keybindingsIOManager;
}

function updateSystemConfigKeybindings(): void {
  // Broadcast the updated bindings.
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const systemConfig = <SystemConfig> configDatabase.getConfigCopy(SYSTEM_CONFIG);
  systemConfig.flatKeybindingsSet = keybindingsIOManager.getFlatKeybindingsSet(generalConfig.keybindingsName);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function setupThemeManager(configDatabase: ConfigDatabase, extensionManager: MainExtensionManager): ThemeManager {
  // Themes
  const themesDir = path.join(__dirname, '../../resources', THEMES_DIRECTORY);
  const themeManager = new ThemeManager({
    css: [themesDir],
    syntax: [getUserSyntaxThemeDirectory()],
    terminal: [getUserTerminalThemeDirectory()]}, extensionManager);
  injectConfigDatabase(themeManager, configDatabase);
  return themeManager;
}

function electronReady(parsedArgs: Command): void {
  setupBulkFileStorage();
  setupIpc();
  setupTrayIcon();
  setupGlobalKeybindingsManager();
  setUpMenu();
  openWindow({openDevTools: parsedArgs.devTools});
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
      if (isDarwin) {
        iconFilename = path.join(__dirname, "../../resources/tray/macOSTrayIconTemplate.png");
      } else if (isLinux) {
        iconFilename = path.join(__dirname, "../../resources/tray/extraterm_tray.png");
      } else {
        iconFilename = path.join(__dirname, "../../resources/tray/extraterm_small_logo.ico");
      }

      tray = new Tray(iconFilename);
      tray.setToolTip("Extraterm");

      if (isDarwin) {
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
    if ( ! isLinux) {
      window.moveTop();
    }
  }
}

function minimizeAllWindows(): void {
  saveAllWindowDimensions();

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
  let i = 0;
  for (const window of BrowserWindow.getAllWindows()) {
    const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);

    const bounds = generalConfig.windowConfiguration[i];
    if (isLinux) {
      // On Linux, if a window is the width or height of the screen then
      // Electron (2.0.13) resizes them (!) to be smaller for some annoying
      // reason. This is a hack to make sure that windows are restored with
      // the correct dimensions.
      if (bounds != null) {
        window.setBounds(bounds);
        window.setMinimumSize(bounds.width, bounds.height);
      }

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
        if (bounds != null) {
          if (bounds.isMaximized === true) {
            window.maximize();
          }
          checkWindowBoundsLater(window, bounds);
        }

        window.show();
      }
      window.restore();

      doLater(() => {
        window.moveTop();
        window.focus();
      });
    }
    i++;
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
  if (process.platform === "darwin") {
    setupOSXMenus();
  } else {
    Menu.setApplicationMenu(null);
  }
}

function setupOSXMenus(): void {
  const template: MenuItemConstructorOptions[] = [{
    label: "Extraterm",
    submenu: [
      {
        label: 'About Extraterm',
        click: async () => {
          sendCommandToWindow("extraterm:window.openAbout");
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'Preferences...',
        click: async () => {
          sendCommandToWindow("extraterm:window.openSettings");
        },
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: async () =>  {
          handleQuitApplicationRequest();
        },
        accelerator: 'Command+Q'
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
    ]
  }
  ];

  const topMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(topMenu);
}

function sendCommandToWindow(commandName: string): void {
  const msg: Messages.ExecuteCommandMessage = {
    type: Messages.MessageType.EXECUTE_COMMAND,
    commandName
  };
  for (const windowId of appWindowIds) {
    const window = BrowserWindow.fromId(windowId);
    window.webContents.send(Messages.CHANNEL_NAME, msg);
  }
}

interface OpenWindowOptions {
  openDevTools?: boolean;
}

function openWindow(options: OpenWindowOptions=null): void {
  const generalConfig = <GeneralConfig> configDatabase.getConfig(GENERAL_CONFIG);
  const themeInfo = themeManager.getTheme(generalConfig.themeGUI);

  // Create the browser window.
  const newBrowserWindowOptions = <Electron.BrowserWindowConstructorOptions> {
    width: 1200,
    height: 600,
    webPreferences: {
      experimentalFeatures: true,
      nodeIntegration: true
    },
    title: "Extraterm",
    backgroundColor: "#00000000",
    show: false,
  };

  if (isDarwin) {
    if (generalConfig.titleBarStyle === "native") {
      newBrowserWindowOptions.frame = true;
    } else {
      if (generalConfig.titleBarStyle === "theme") {
        newBrowserWindowOptions.titleBarStyle = "hidden";
      } else {
        // Compact
        newBrowserWindowOptions.titleBarStyle = "hiddenInset";
      }
    }
  } else {
    newBrowserWindowOptions.frame = generalConfig.titleBarStyle === "native";
  }

  // Restore the window position and size from the last session.
  const dimensions = getWindowDimensionsFromConfig(appWindowIds.length);
  if (dimensions != null) {
    newBrowserWindowOptions.x = dimensions.x;
    newBrowserWindowOptions.y = dimensions.y;
    newBrowserWindowOptions.width = dimensions.width;
    newBrowserWindowOptions.height = dimensions.height;
  }

  if (isWindows) {
    newBrowserWindowOptions.icon = path.join(__dirname, ICO_ICON_PATH);
  } else if (isLinux) {
    newBrowserWindowOptions.icon = path.join(__dirname, PNG_ICON_PATH);
  }

  const newWindow = new BrowserWindow(newBrowserWindowOptions);

  if (options?.openDevTools) {
    newWindow.webContents.openDevTools();
  }

  newWindow.setMenu(null);

  // Emitted when the window is closed.
  const mainWindowWebContentsId = newWindow.webContents.id;
  const newWindowId = newWindow.id;
  newWindow.on("closed", () => {
    cleanUpPtyWindow(mainWindowWebContentsId);

    appWindowIds = appWindowIds.filter(wId => wId !== newWindowId);
  });

  newWindow.on("close", saveAllWindowDimensions);
  newWindow.on("resize", saveAllWindowDimensions);
  newWindow.on("maximize", saveAllWindowDimensions);
  newWindow.on("unmaximize", saveAllWindowDimensions);

  setupTransparentBackground(newWindow);
  checkWindowBoundsLater(newWindow, dimensions);

  const params = "?loadingBackgroundColor=" + themeInfo.loadingBackgroundColor.replace("#", "") +
    "&loadingForegroundColor=" + themeInfo.loadingForegroundColor.replace("#", "");

  // and load the index.html of the app.
  newWindow.loadURL(ResourceLoader.toUrl("render_process/main.html") + params);

  newWindow.webContents.on('devtools-closed', () => {
    sendDevToolStatus(newWindow, false);
  });

  newWindow.webContents.on('devtools-opened', () => {
    sendDevToolStatus(newWindow, true);
  });

  appWindowIds.push(newWindow.id);
}

function checkWindowBoundsLater(window: BrowserWindow, desiredConfig: SingleWindowConfiguration): void {
  window.once("ready-to-show", () => {
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
      window.setBounds(newDimensions);
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
  for (let i=0; i<appWindowIds.length; i++) {
    const window = BrowserWindow.fromId(appWindowIds[i]);

    const rect = window.getNormalBounds();
    const isMaximized = window.isMaximized();

    const newGeneralConfig = <GeneralConfig> configDatabase.getConfigCopy(GENERAL_CONFIG);

    if (newGeneralConfig.windowConfiguration == null) {
      newGeneralConfig.windowConfiguration = {};
    }
    newGeneralConfig.windowConfiguration[i] = {
      isMaximized,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
    configDatabase.setConfig(GENERAL_CONFIG, newGeneralConfig);
  }
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
  try {
    logWriter.open();
  } catch (error) {
    // The primary reason why this may happen is if an instance of Extraterm is already running.
    _log.warn(error);
    _log.warn("Unable to write to log file ", logFilePath);
    return;
  }

  addLogWriter(logWriter);
  _log.info("Recording logs to ", logFilePath);
}

function setupTransparentBackground(window: BrowserWindow): void {
  const setWindowComposition = () => {
    const generalConfig = <GeneralConfig> configDatabase.getConfig("general");
    const isWindowOpaque = generalConfig.windowBackgroundMode === "opaque";
    if (isWindows) {
      const accent = isWindowOpaque
                      ? AccentState.ACCENT_DISABLED
                      : AccentState.ACCENT_ENABLE_BLURBEHIND;
      SetWindowCompositionAttribute(window.getNativeWindowHandle(), accent, 0);
    }
    if (isDarwin) {
      if ( ! isWindowOpaque) {
        window.setVibrancy("dark");
      }
    }
  };

  configDatabase.onChange(event => {
    if (event.key === "general" &&
        event.oldConfig.windowBackgroundMode !== event.newConfig.windowBackgroundMode) {
      setWindowComposition();
    }
  });

  window.once("ready-to-show", () => {
    setWindowComposition();
    window.show();
  });
}

const _log = getLogger("main");

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(config: GeneralConfig, keybindingsIOManager: KeybindingsIOManager, availableFonts: FontInfo[], packageJson: any): SystemConfig {
  const homeDir = app.getPath('home');

  const flatKeybindingsFile = keybindingsIOManager.getFlatKeybindingsSet(config.keybindingsName);
  return {
    homeDir,
    applicationVersion: packageJson.version,
    flatKeybindingsSet: flatKeybindingsFile,
    availableFonts: availableFonts,
    titleBarStyle,
    userTerminalThemeDirectory: getUserTerminalThemeDirectory(),
    userSyntaxThemeDirectory: getUserSyntaxThemeDirectory(),
    isHardwareAccelerated: config.isHardwareAccelerated,
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
  if (isWindows) {
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

function handleIpc(event: Electron.IpcMainEvent, arg: any): void {
  const msg: Messages.Message = arg;
  let reply: Messages.Message = null;

  if (LOG_FINE) {
    _log.debug(`Main IPC incoming: ${Messages.MessageType[msg.type]} => `,msg);
  }

  switch(msg.type) {
    case Messages.MessageType.BULK_FILE_CLOSE:
      handleCloseBulkFile(<Messages.BulkFileCloseMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_CREATE:
      const createBulkFileReply = handleCreateBulkFile(<Messages.BulkFileCreateMessage> msg);
      event.returnValue = createBulkFileReply;
      break;

    case Messages.MessageType.BULK_FILE_DEREF:
      handleDerefBulkFile(<Messages.BulkFileDerefMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_REF:
      handleRefBulkFile(<Messages.BulkFileRefMessage> msg);
      break;

    case Messages.MessageType.BULK_FILE_WRITE:
      handleWriteBulkFile(<Messages.BulkFileWriteMessage> msg);
      break;

    case Messages.MessageType.CLIPBOARD_READ_REQUEST:
      reply = handleClipboardReadRequest(<Messages.ClipboardReadRequestMessage> msg);
      break;

    case Messages.MessageType.CLIPBOARD_WRITE:
      handleClipboardWrite(<Messages.ClipboardWriteMessage> msg);
      break;

    case Messages.MessageType.CONFIG:
      handleConfig(<Messages.ConfigMessage> msg);
      break;

    case Messages.MessageType.CONFIG_REQUEST:
      reply = handleConfigRequest(<Messages.ConfigRequestMessage> msg);
      break;

    case Messages.MessageType.DEV_TOOLS_REQUEST:
      handleDevToolsRequest(event.sender, <Messages.DevToolsRequestMessage> msg);
      break;

    case Messages.MessageType.EXTENSION_DESIRED_STATE_REQUEST:
      event.returnValue = handleExtensionDesiredStateRequest();
      return;

    case Messages.MessageType.EXTENSION_DISABLE:
      extensionManager.disableExtension((<Messages.ExtensionDisableMessage>msg).extensionName);
      break;

    case Messages.MessageType.EXTENSION_ENABLE:
      extensionManager.enableExtension((<Messages.ExtensionEnableMessage>msg).extensionName);
      break;

    case Messages.MessageType.EXTENSION_METADATA_REQUEST:
      event.returnValue = handleExtensionMetadataRequest();
      return;

    case Messages.MessageType.FRAME_DATA_REQUEST:
      _log.debug('Messages.MessageType.FRAME_DATA_REQUEST is not implemented.');
      break;

    case Messages.MessageType.GLOBAL_KEYBINDINGS_ENABLE:
      handleGlobalKeybindingsEnable(<Messages.GlobalKeybindingsEnableMessage>msg);
      break;

    case Messages.MessageType.KEYBINDINGS_READ_REQUEST:
      reply = handleKeybindingsReadRequest(<Messages.KeybindingsReadRequestMessage>msg);
      break;

    case Messages.MessageType.KEYBINDINGS_UPDATE:
      handleKeybindingsUpdate(<Messages.KeybindingsUpdateMessage>msg);
      break;

    case Messages.MessageType.NEW_TAG_REQUEST:
      const ntrm = <Messages.NewTagRequestMessage> msg;
      reply = handleNewTagRequest(ntrm);
      if (ntrm.async === false) {
        event.returnValue = reply;
        return;
      }
      break;

    case Messages.MessageType.NEW_WINDOW:
      handleNewWindow();
      break;

    case Messages.MessageType.PTY_CLOSE_REQUEST:
      handlePtyCloseRequest(<Messages.PtyClose> msg);
      break;

    case Messages.MessageType.PTY_CREATE:
      reply = handlePtyCreate(event.sender, <Messages.CreatePtyRequestMessage> msg);
      break;

    case Messages.MessageType.PTY_INPUT:
      handlePtyInput(<Messages.PtyInput> msg);
      break;

    case Messages.MessageType.PTY_OUTPUT_BUFFER_SIZE:
      handlePtyOutputBufferSize(<Messages.PtyOutputBufferSize> msg);
      break;

    case Messages.MessageType.PTY_RESIZE:
      handlePtyResize(<Messages.PtyResize> msg);
      break;

    case Messages.MessageType.PTY_GET_WORKING_DIRECTORY_REQUEST:
      handlePtyGetWorkingDirectory(<Messages.PtyGetWorkingDirectoryRequest> msg, event.sender);
      break;

    case Messages.MessageType.QUIT_APPLICATION_REQUEST:
      handleQuitApplicationRequest();
      break;

    case Messages.MessageType.THEME_CONTENTS_REQUEST:
      handleThemeContentsRequest(event.sender, <Messages.ThemeContentsRequestMessage> msg);
      break;

    case Messages.MessageType.THEME_LIST_REQUEST:
      reply = handleThemeListRequest();
      break;

    case Messages.MessageType.THEME_RESCAN:
      reply = handleThemeRescan();
      break;

    case Messages.MessageType.WINDOW_CLOSE_REQUEST:
      const window = BrowserWindow.fromWebContents(event.sender);
      window.close();
      break;

    case Messages.MessageType.WINDOW_MAXIMIZE_REQUEST:
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;

    case Messages.MessageType.WINDOW_MINIMIZE_REQUEST:
      minimizeAllWindows();
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

function handleConfig(msg: Messages.ConfigMessage): void {
  if (LOG_FINE) {
    _log.debug("Incoming new config: ", msg);
  }
  configDatabase.setConfig(msg.key, msg.config);
}

function handleConfigRequest(msg: Messages.ConfigRequestMessage): Messages.ConfigMessage {
  const reply: Messages.ConfigMessage = {
    type: Messages.MessageType.CONFIG,
    key: msg.key,
    config: configDatabase.getConfig(msg.key)
  };
  return reply;
}

function handleQuitApplicationRequest(): void {
  const msg: Messages.QuitApplicationMessage = {
    type: Messages.MessageType.QUIT_APPLICATION,
  };
  sendMessageToAllWindows(msg);
}

function handleNewWindow(): void {
  openWindow();
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
  const ptyId = ptyManager.createPty(msg.sessionUuid, msg.sessionOptions);
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

async function handlePtyGetWorkingDirectory(msg: Messages.PtyGetWorkingDirectoryRequest,
    sender: Electron.WebContents): Promise<void> {
  const workingDirectory = await ptyManager.ptyGetWorkingDirectory(msg.id);

  const reply: Messages.PtyGetWorkingDirectory = {
    type: Messages.MessageType.PTY_GET_WORKING_DIRECTORY,
    id: msg.id,
    workingDirectory
  };

  if (LOG_FINE) {
    _log.debug("Replying: ", reply);
  }
  sender.send(Messages.CHANNEL_NAME, reply);
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
  const text = clipboard.readText(msg.clipboardType);
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

function handleExtensionDesiredStateRequest(): Messages.ExtensionDesiredStateMessage {
  return {type: Messages.MessageType.EXTENSION_DESIRED_STATE, desiredState: extensionManager.getDesiredState()};
}

function handleKeybindingsReadRequest(msg: Messages.KeybindingsReadRequestMessage): Messages.KeybindingsReadMessage {
  const stackedKeybindingsFile = keybindingsIOManager.getStackedKeybindings(msg.name);
  const reply: Messages.KeybindingsReadMessage = {
    type: Messages.MessageType.KEYBINDINGS_READ,
    stackedKeybindingsFile
  };
  return reply;
}

function handleKeybindingsUpdate(msg: Messages.KeybindingsUpdateMessage): void {
  keybindingsIOManager.updateCustomKeybindingsFile(msg.customKeybindingsSet);
}

function handleGlobalKeybindingsEnable(msg: Messages.GlobalKeybindingsEnableMessage): void {
  globalKeybindingsManager.setEnabled(msg.enabled);
}

main();
