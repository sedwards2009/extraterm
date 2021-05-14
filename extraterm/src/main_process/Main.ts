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
import { app, dialog } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { FileLogWriter, getLogger, addLogWriter } from "extraterm-logging";
import { later } from "extraterm-later";

import { BulkFileStorage } from "./bulk_file_handling/BulkFileStorage";
import { SystemConfig, FontInfo, GeneralConfig, TitleBarStyle, ConfigDatabase, SYSTEM_CONFIG } from "../Config";
import { PtyManager } from "./pty/PtyManager";
import { ThemeManager } from "../theme/ThemeManager";
import { MainExtensionManager } from "./extension/MainExtensionManager";
import { KeybindingsIOManager } from "./KeybindingsIOManager";
import { getFonts } from "./FontList";
import { GlobalKeybindingsManager } from "./GlobalKeybindings";
import { EXTRATERM_CONFIG_DIR, getUserSyntaxThemeDirectory, getUserTerminalThemeDirectory,
  getUserKeybindingsDirectory, setupAppData, sanitizeAndIinitializeConfigs as sanitizeAndInitializeConfigs,
  getUserExtensionDirectory, getUserSettingsDirectory } from "./MainConfig";
import { ConfigDatabaseImpl } from "./ConfigDatabaseImpl";
import { LocalHttpServer } from "./local_http_server/LocalHttpServer";
import { CommandRequestHandler } from "./local_http_server/CommandRequestHandler";
import { BulkFileRequestHandler } from "./bulk_file_handling/BulkFileRequestHandler";
import { MainIpc } from "./MainIpc";
import { MainDesktop } from "./MainDesktop";
import { registerInternalCommands } from "./InternalMainCommands";
import { SharedMap } from "../shared_map/SharedMap";


SourceMapSupport.install();

const isDarwin = process.platform === "darwin";

// crashReporter.start(); // Report crashes

const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";
const THEMES_DIRECTORY = "themes";
const PACKAGE_JSON_PATH = "../../../package.json";

const _log = getLogger("main");


async function main(): Promise<void> {
  let failed = false;
  const sharedMap = new SharedMap();
  const configDatabase = new ConfigDatabaseImpl(getUserSettingsDirectory());
  configDatabase.init();

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
  const normalizedArgv = process.argv[0].includes("extraterm") ? ["node", "extraterm", ...process.argv.slice(1)]
                            : process.argv;
  const parsedArgs = new Command("extraterm");

  // The extra fields which appear on the command object are declared in extra_commander.d.ts.
  parsedArgs.option("-c, --cygwinDir [cygwinDir]", "Location of the cygwin directory []")
    .option("-d, --dev-tools [devTools]", "Open the dev tools on start up")
    .option("--force-device-scale-factor []", "(This option is used by Electron)")
    .option("--bare [bare]", "Open the window but don't open a terminal session.")
    .parse(normalizedArgv);
  const options = parsedArgs.opts();

  const availableFonts = getFonts();
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "utf8"));

  // We have to start up the extension manager before we can scan themes (with the help of extensions)
  // and properly sanitize the config.
  const extensionManager = setupExtensionManager(configDatabase, packageJson.version);

  const keybindingsIOManager = setupKeybindingsIOManager(configDatabase, extensionManager);
  const themeManager = setupThemeManager(configDatabase, extensionManager);

  sanitizeAndInitializeConfigs(configDatabase, themeManager, keybindingsIOManager,
    availableFonts);
  const generalConfig = configDatabase.getGeneralConfig();
  const titleBarStyle = generalConfig.titleBarStyle;
  const systemConfig = systemConfiguration(generalConfig, keybindingsIOManager, availableFonts, packageJson,
    titleBarStyle);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);

  if ( ! generalConfig.isHardwareAccelerated) {
    app.disableHardwareAcceleration();
  }

  const ptyManager = setupPtyManager(configDatabase, extensionManager);
  if (ptyManager == null) {
    failed = true;
  }

  if (failed) {
    dialog.showErrorBox("Sorry, something went wrong",
      "Something went wrong while starting up Extraterm.\n" +
      "Message log is:\n" + _log.getFormattedLogMessages());
    process.exit(1);
  }

  _log.stopRecording();

  setupDefaultSessions(configDatabase, ptyManager);

  await electronReady();

  const bulkFileStorage = setupBulkFileStorage();

  const mainDesktop = new MainDesktop(app, configDatabase, themeManager);
  const globalKeybindingsManager = setupGlobalKeybindingsManager(configDatabase, keybindingsIOManager, mainDesktop);

  registerInternalCommands(extensionManager, mainDesktop);

  const mainIpc = setupIpc(configDatabase, bulkFileStorage, extensionManager, globalKeybindingsManager, mainDesktop,
    keybindingsIOManager, themeManager, ptyManager, sharedMap);

  const localHttpServer = await setupLocalHttpServer(bulkFileStorage);
  const commandRequestHandler = setupHttpCommandRequestHandler(mainDesktop, extensionManager, mainIpc, localHttpServer);

  // Quit when all windows are closed.
  app.on("window-all-closed", () => shutdown(bulkFileStorage, localHttpServer));

  mainDesktop.start();
  const newWindow = mainDesktop.openWindow({openDevTools: options.devTools, bareWindow: options.bare != null});

  await newWindow.ready();
  if (options.bare != null) {
    // After waiting a bit we just remove the splash image regardless of what happens.
    // If a remote command comes in (think: new tab from the launcher exe), then we can
    // remove the splash and avoid some flickering of the window contents.
    const disconnectHandler = commandRequestHandler.onCommandComplete(() => {
      disconnectHandler.dispose();
      mainIpc.sendCloseSplashToWindow(newWindow.id);
    });

    await later(10000);
  }
  mainIpc.sendCloseSplashToWindow(newWindow.id);
}

function electronReady(): Promise<void> {
  return new Promise<void>( (resolve, reject) => {
    app.on("ready", () => {
      resolve();
    });
  });
}

function setupExtensionManager(configDatabase: ConfigDatabase, applicationVersion: string): MainExtensionManager {
  const extensionPaths = [path.join(__dirname, "../../../extensions" )];
  const userExtensionDirectory = getUserExtensionDirectory();
  _log.info(`User extension directory is: ${userExtensionDirectory}`);
  if (fs.existsSync(userExtensionDirectory)) {
    extensionPaths.push(userExtensionDirectory);
  }

  const extensionManager = new MainExtensionManager(configDatabase, extensionPaths, applicationVersion);
  extensionManager.startUpExtensions(configDatabase.getGeneralConfig().activeExtensions);
  return extensionManager;
}

function setupKeybindingsIOManager(configDatabase: ConfigDatabaseImpl,
    extensionManager: MainExtensionManager): KeybindingsIOManager {

  const keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager);
  keybindingsIOManager.onUpdate(() => {
    updateSystemConfigKeybindings(configDatabase, keybindingsIOManager);
  });
  return keybindingsIOManager;
}

function updateSystemConfigKeybindings(configDatabase: ConfigDatabaseImpl,
    keybindingsIOManager: KeybindingsIOManager): void {

  // Broadcast the updated bindings.
  const generalConfig = <GeneralConfig> configDatabase.getGeneralConfig();
  const systemConfig = <SystemConfig> configDatabase.getSystemConfigCopy();
  systemConfig.flatKeybindingsSet = keybindingsIOManager.getFlatKeybindingsSet(generalConfig.keybindingsName);
  configDatabase.setConfigNoWrite(SYSTEM_CONFIG, systemConfig);
}

function setupThemeManager(configDatabase: ConfigDatabase, extensionManager: MainExtensionManager): ThemeManager {
  // Themes
  const themesDir = path.join(__dirname, "../../resources", THEMES_DIRECTORY);
  const themeManager = new ThemeManager({
    css: [themesDir],
    syntax: [getUserSyntaxThemeDirectory()],
    terminal: [getUserTerminalThemeDirectory()]}, extensionManager, configDatabase);
  return themeManager;
}


async function setupLocalHttpServer(bulkFileStorage: BulkFileStorage): Promise<LocalHttpServer> {
  const ipcFilePath = path.join(app.getPath("appData"), EXTRATERM_CONFIG_DIR, IPC_FILENAME);
  const localHttpServer = new LocalHttpServer(ipcFilePath);
  await localHttpServer.start();

  bulkFileStorage.setLocalUrlBase(localHttpServer.getLocalUrlBase());
  const bulkFileRequestHandler = new BulkFileRequestHandler(bulkFileStorage);
  localHttpServer.registerRequestHandler("bulk", bulkFileRequestHandler);

  return localHttpServer;
}

function setupHttpCommandRequestHandler(mainDesktop: MainDesktop, extensionManager: MainExtensionManager,
    mainIpc: MainIpc, localHttpServer: LocalHttpServer): CommandRequestHandler {
  const commandRequestHandler = new CommandRequestHandler(mainDesktop, extensionManager, mainIpc);
  localHttpServer.registerRequestHandler("command", commandRequestHandler);
  return commandRequestHandler;
}

function setupBulkFileStorage(): BulkFileStorage {
  const bulkFileStorage = new BulkFileStorage(os.tmpdir());
  return bulkFileStorage;
}

function shutdown(bulkFileStorage: BulkFileStorage, localHttpServer: LocalHttpServer): void {
  if (localHttpServer != null) {
    localHttpServer.dispose();
  }
  if (bulkFileStorage !== null) {
    bulkFileStorage.dispose();
  }
  app.quit();
}

function setupGlobalKeybindingsManager(configDatabase: ConfigDatabaseImpl, keybindingsIOManager: KeybindingsIOManager,
    mainDesktop: MainDesktop): GlobalKeybindingsManager {

  const globalKeybindingsManager = new GlobalKeybindingsManager(keybindingsIOManager, configDatabase);
  globalKeybindingsManager.onMaximizeWindow(mainDesktop.maximizeAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onToggleShowHideWindow(mainDesktop.toggleAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onShowWindow(mainDesktop.restoreAllWindows.bind(mainDesktop));
  globalKeybindingsManager.onHideWindow(mainDesktop.minimizeAllWindows.bind(mainDesktop));
  return globalKeybindingsManager;
}

function setupLogging(): void {
  const logFilePath = path.join(app.getPath("appData"), EXTRATERM_CONFIG_DIR, LOG_FILENAME);
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
    availableFonts: FontInfo[], packageJson: any, titleBarStyle: TitleBarStyle): SystemConfig {

  const homeDir = app.getPath("home");

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

function setupIpc(configDatabase: ConfigDatabaseImpl, bulkFileStorage: BulkFileStorage,
  extensionManager: MainExtensionManager, globalKeybindingsManager: GlobalKeybindingsManager, mainDesktop: MainDesktop,
  keybindingsIOManager: KeybindingsIOManager, themeManager: ThemeManager, ptyManager: PtyManager,
  sharedMap: SharedMap): MainIpc {

  const mainIpc = new MainIpc(configDatabase, bulkFileStorage, extensionManager, ptyManager,keybindingsIOManager,
    mainDesktop, themeManager, globalKeybindingsManager, sharedMap);

  mainIpc.start();
  return mainIpc;
}

function setupPtyManager(configDatabase: ConfigDatabaseImpl, extensionManager: MainExtensionManager): PtyManager {
  try {
    return new PtyManager(extensionManager, configDatabase);
  } catch(err) {
    _log.severe("Error occured while creating the PTY connector factory: " + err.message);
    return null;
  }
}

function setupDefaultSessions(configDatabase: ConfigDatabaseImpl, ptyManager: PtyManager): void {
  const sessions = configDatabase.getSessionConfigCopy();
  if (sessions == null || sessions.length === 0) {
    const newSessions = ptyManager.getDefaultSessions();
    configDatabase.setSessionConfig(newSessions);
  }
}

main();
