/*
 * Copyright 2014-2021 Simon Edwards <simon@simonzone.com>
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
import { app, BrowserWindow, dialog } from "electron";
import fontInfo = require("fontinfo");
import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import * as os from "os";
import { FileLogWriter, getLogger, addLogWriter } from "extraterm-logging";

import { BulkFileStorage, BufferSizeEvent, CloseEvent } from "./bulk_file_handling/BulkFileStorage";
import { SystemConfig, FontInfo, injectConfigDatabase, GENERAL_CONFIG, SYSTEM_CONFIG, GeneralConfig, SESSION_CONFIG,
  TitleBarStyle, ConfigDatabase } from "../Config";
import { PtyManager } from "./pty/PtyManager";
import { ThemeManager } from "../theme/ThemeManager";
import * as Messages from "../WindowMessages";
import { MainExtensionManager } from "./extension/MainExtensionManager";
import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { getAvailableFontsSync } from "./FontList";
import { GlobalKeybindingsManager } from "./GlobalKeybindings";
import { ConfigDatabaseImpl, EXTRATERM_CONFIG_DIR, getUserSyntaxThemeDirectory, getUserTerminalThemeDirectory,
  getUserKeybindingsDirectory, setupAppData, sanitizeAndIinitializeConfigs as sanitizeAndInitializeConfigs,
  readUserStoredConfigFile, getUserExtensionDirectory } from "./MainConfig";
import { LocalHttpServer } from "./local_http_server/LocalHttpServer";
import { CommandRequestHandler } from "./local_http_server/CommandRequestHandler";
import { BulkFileRequestHandler } from "./bulk_file_handling/BulkFileRequestHandler";
import { MainIpc } from "./MainIpc";
import { MainDesktop } from "./MainDesktop";


SourceMapSupport.install();

const isWindows = process.platform === "win32";
const isDarwin = process.platform === "darwin";

// crashReporter.start(); // Report crashes

const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";
const THEMES_DIRECTORY = "themes";
const TERMINAL_FONTS_DIRECTORY = "../../resources/terminal_fonts";
const PACKAGE_JSON_PATH = "../../../package.json";

const _log = getLogger("main");

let themeManager: ThemeManager;
let ptyManager: PtyManager;
let configDatabase: ConfigDatabaseImpl;
let titleBarStyle: TitleBarStyle = "compact";
let localHttpServer: LocalHttpServer = null;
let bulkFileStorage: BulkFileStorage = null;
let extensionManager: MainExtensionManager = null;
let keybindingsIOManager: KeybindingsIOManager = null;
let globalKeybindingsManager: GlobalKeybindingsManager = null;
let mainIpc: MainIpc = null;


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

  sanitizeAndInitializeConfigs(userStoredConfig, themeManager, configDatabase, keybindingsIOManager,
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
  app.on('window-all-closed', shutdown);

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
    mainIpc.sendExtensionDesiredStateMessage();
  });

  const commands = extensionManager.getExtensionContextByName("internal-main-commands").commands;
  commands.registerCommand("extraterm:window.listAll", (args: any) => commandWindowListAll());

  return extensionManager;
}

function commandWindowListAll(): void {
  _log.debug("commandWindowListAll()");
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

async function electronReady(parsedArgs: Command): Promise<void> {
  setupBulkFileStorage();
  await setupLocalHttpServer();

  const mainDesktop = new MainDesktop(configDatabase, themeManager);
  setupGlobalKeybindingsManager(mainDesktop);

  mainIpc = setupIpc(mainDesktop);

  mainDesktop.onAboutSelected(() => {
    mainIpc.sendCommandToWindow("extraterm:window.openAbout");
  });
  mainDesktop.onPreferencesSelected(() => {
    mainIpc.sendCommandToWindow("extraterm:window.openSettings");
  });
  mainDesktop.onQuitSelected(() => {
    mainIpc.sendQuitApplicationRequest();
  });
  mainDesktop.onDevToolsClosed((devToolsWindow: BrowserWindow)=> {
    sendDevToolStatus(devToolsWindow, false);
  });
  mainDesktop.onDevToolsOpened((devToolsWindow: BrowserWindow)=> {
    sendDevToolStatus(devToolsWindow, true);
  });

  mainDesktop.onWindowClosed((webContentsId: number) => {
    mainIpc.cleanUpPtyWindow(webContentsId);
  });

  mainDesktop.start();
  mainDesktop.openWindow({openDevTools: parsedArgs.devTools});
}

async function setupLocalHttpServer(): Promise<void> {
  const ipcFilePath = path.join(app.getPath("appData"), EXTRATERM_CONFIG_DIR, IPC_FILENAME);
  localHttpServer = new LocalHttpServer(ipcFilePath);
  await localHttpServer.start();

  bulkFileStorage.setLocalUrlBase(localHttpServer.getLocalUrlBase());
  const bulkFileRequestHandler = new BulkFileRequestHandler(bulkFileStorage);
  localHttpServer.registerRequestHandler("bulk", bulkFileRequestHandler);

  const commandRequestHandler = new CommandRequestHandler(extensionManager);
  localHttpServer.registerRequestHandler("command", commandRequestHandler);
}

function setupBulkFileStorage(): void {
  bulkFileStorage = new BulkFileStorage(os.tmpdir());
  bulkFileStorage.onWriteBufferSize(
    (event: BufferSizeEvent) => {
      mainIpc.sendBulkFileWriteBufferSizeEvent(event);
    }
  );
  bulkFileStorage.onClose(
    (event: CloseEvent) => {
      mainIpc.sendBulkFileStateChangeEvent(event);
    }
  );
}

function shutdown(): void {
  if (localHttpServer != null) {
    localHttpServer.dispose();
  }
  if (bulkFileStorage !== null) {
    bulkFileStorage.dispose();
  }
  app.quit();
}

function setupGlobalKeybindingsManager(mainDesktop: MainDesktop): void {
  globalKeybindingsManager = new GlobalKeybindingsManager(keybindingsIOManager, configDatabase);
  globalKeybindingsManager.onMaximizeWindow(mainDesktop.maximizeAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onToggleShowHideWindow(mainDesktop.toggleAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onShowWindow(mainDesktop.restoreAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onHideWindow(mainDesktop.minimizeAllWindows.bind(mainDesktop));
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

/**
 * Extra information about the system configuration and platform.
 */
function systemConfiguration(config: GeneralConfig, keybindingsIOManager: KeybindingsIOManager,
    availableFonts: FontInfo[], packageJson: any): SystemConfig {

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

function setupIpc(mainDesktop: MainDesktop): MainIpc {
  const mainIpc = new MainIpc(configDatabase, bulkFileStorage,
    extensionManager, ptyManager,keybindingsIOManager,
    mainDesktop, themeManager, globalKeybindingsManager);
  mainIpc.start();
  return mainIpc;
}

function setupPtyManager(): boolean {
  try {
    ptyManager = new PtyManager(extensionManager, configDatabase);
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

function sendDevToolStatus(window: Electron.BrowserWindow, open: boolean): void {
  const msg: Messages.DevToolsStatusMessage = { type: Messages.MessageType.DEV_TOOLS_STATUS, open: open };
  window.webContents.send(Messages.CHANNEL_NAME, msg);
}

main();
