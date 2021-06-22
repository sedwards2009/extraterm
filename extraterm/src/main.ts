/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as SourceMapSupport from "source-map-support";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { FileLogWriter, getLogger, addLogWriter, Logger } from "extraterm-logging";
import { CreateSessionOptions, SessionConfiguration} from '@extraterm/extraterm-extension-api';

import { Window } from "./Window";
import { SESSION_CONFIG } from './config/Config';
import { ConfigDatabase } from "./config/ConfigDatabase";
import { ExtensionCommandContribution } from './extension/ExtensionMetadata';
import { DisposableHolder } from "./utils/DisposableUtils";
import { PersistentConfigDatabase } from "./config/PersistentConfigDatabase";
import { SharedMap } from "./shared_map/SharedMap";
import { getUserExtensionDirectory, getUserKeybindingsDirectory, getUserSettingsDirectory, getUserTerminalThemeDirectory, sanitizeAndInitializeConfigs, setupAppData } from "./config/MainConfig";
import { getFonts, installBundledFonts } from "./ui/FontList";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager";
import { FontInfo, GeneralConfig, SystemConfig, TitleBarStyle } from "./config/Config";
import { ThemeManager } from "./theme/ThemeManager";
import { PtyManager } from "./pty/PtyManager";
import { BulkFileStorage } from "./bulk_file_handling/BulkFileStorage";
import { ExtensionManager } from "./extension/ExtensionManager";
import { EXTRATERM_COOKIE_ENV, Terminal } from "./terminal/Terminal";


const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";

const PACKAGE_JSON_PATH = "../../package.json";


/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
class Main {

  private _log: Logger = null;
  #windows: Window[] = [];
  #configDatabase: ConfigDatabase = null;
  #ptyManager: PtyManager = null;
  #themeManager: ThemeManager = null;

  constructor() {
    this._log = getLogger("main", this);
  }

  init(): void {
    setupAppData();

    const sharedMap = new SharedMap();
    const configDatabase = new PersistentConfigDatabase(getUserSettingsDirectory(), sharedMap);
    this.#configDatabase = configDatabase;
    configDatabase.start();

    this.setupLogging();

    // this._log.startRecording();

    installBundledFonts();
    const availableFonts = getFonts();
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "utf8"));

    // We have to start up the extension manager before we can scan themes (with the help of extensions)
    // and properly sanitize the config.
    const extensionManager = this.setupExtensionManager(configDatabase, sharedMap, packageJson.version);

    const keybindingsIOManager = this.setupKeybindingsIOManager(configDatabase, extensionManager);
    const themeManager = this.setupThemeManager(extensionManager);
    this.#themeManager = themeManager;

    sanitizeAndInitializeConfigs(configDatabase, themeManager, keybindingsIOManager, availableFonts);
    const generalConfig = configDatabase.getGeneralConfig();
    const titleBarStyle = generalConfig.titleBarStyle;
    const systemConfig = this.systemConfiguration(generalConfig, keybindingsIOManager, availableFonts, packageJson,
      titleBarStyle);
    configDatabase.setSystemConfig(systemConfig);

    const ptyManager = this.setupPtyManager(extensionManager);
    this.#ptyManager = ptyManager;

    // if (failed) {
    //   dialog.showErrorBox("Sorry, something went wrong",
    //     "Something went wrong while starting up Extraterm.\n" +
    //     "Message log is:\n" + _log.getFormattedLogMessages());
    //   process.exit(1);
    // }

    // _log.stopRecording();

    this.setupDefaultSessions(configDatabase, ptyManager);

    const bulkFileStorage = this.setupBulkFileStorage();
    // TODO: MainDesktop()
    // TODO: setupGlobalKeybindingsManager()
    // TODO: registerInternalCommands()

    // TODO: setupLocalHttpServer()

    this.registerCommands(extensionManager);
    this.startUpSessions(configDatabase, extensionManager);

    this.openWindow();
    this.commandNewTerminal({});
  }

  setupLogging(): void {
    const logFilePath = path.join(getUserSettingsDirectory(), LOG_FILENAME);
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath);
    }

    const logWriter = new FileLogWriter(logFilePath);
    try {
      logWriter.open();
    } catch (error) {
      // The primary reason why this may happen is if an instance of Extraterm is already running.
      this._log.warn(error);
      this._log.warn("Unable to write to log file ", logFilePath);
      return;
    }

    addLogWriter(logWriter);
    this._log.info("Recording logs to ", logFilePath);
  }

  setupExtensionManager(configDatabase: ConfigDatabase, sharedMap: SharedMap, applicationVersion: string): ExtensionManager {
    const extensionPaths = [path.join(__dirname, "../../extensions" )];
    const userExtensionDirectory = getUserExtensionDirectory();
    this._log.info(`User extension directory is: ${userExtensionDirectory}`);
    if (fs.existsSync(userExtensionDirectory)) {
      extensionPaths.push(userExtensionDirectory);
    }

    const extensionManager = new ExtensionManager(configDatabase, sharedMap, extensionPaths, applicationVersion);
    extensionManager.startUpExtensions(configDatabase.getGeneralConfig().activeExtensions);
    return extensionManager;
  }

  setupKeybindingsIOManager(configDatabase: PersistentConfigDatabase,
    extensionManager: ExtensionManager): KeybindingsIOManager {

    const keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager);
    keybindingsIOManager.onUpdate(() => {
      this.updateSystemConfigKeybindings(configDatabase, keybindingsIOManager);
    });
    return keybindingsIOManager;
  }

  updateSystemConfigKeybindings(configDatabase: PersistentConfigDatabase,
      keybindingsIOManager: KeybindingsIOManager): void {

    // Broadcast the updated bindings.
    const generalConfig = <GeneralConfig> configDatabase.getGeneralConfig();
    const systemConfig = <SystemConfig> configDatabase.getSystemConfigCopy();
    systemConfig.flatKeybindingsSet = keybindingsIOManager.getFlatKeybindingsSet(generalConfig.keybindingsName);
    configDatabase.setSystemConfig(systemConfig);
  }

  setupThemeManager(extensionManager: ExtensionManager): ThemeManager {
    const themeManager = new ThemeManager({ terminal: [getUserTerminalThemeDirectory()]}, extensionManager);
    return themeManager;
  }

  /**
   * Extra information about the system configuration and platform.
   */
  systemConfiguration(config: GeneralConfig, keybindingsIOManager: KeybindingsIOManager,
      availableFonts: FontInfo[], packageJson: any, titleBarStyle: TitleBarStyle): SystemConfig {
    const homeDir = os.homedir();
    const flatKeybindingsFile = keybindingsIOManager.getFlatKeybindingsSet(config.keybindingsName);
    return {
      homeDir,
      applicationVersion: packageJson.version,
      flatKeybindingsSet: flatKeybindingsFile,
      availableFonts: availableFonts,
      titleBarStyle,
      userTerminalThemeDirectory: getUserTerminalThemeDirectory()
    };
  }

  setupPtyManager(extensionManager: ExtensionManager): PtyManager {
    try {
      return new PtyManager(extensionManager);
    } catch(err) {
      this._log.severe("Error occured while creating the PTY connector factory: " + err.message);
      return null;
    }
  }

  setupDefaultSessions(configDatabase: PersistentConfigDatabase, ptyManager: PtyManager): void {
    const sessions = configDatabase.getSessionConfigCopy();
    if (sessions == null || sessions.length === 0) {
      const newSessions = ptyManager.getDefaultSessions();
      configDatabase.setSessionConfig(newSessions);
    }
  }

  setupBulkFileStorage(): BulkFileStorage {
    const bulkFileStorage = new BulkFileStorage(os.tmpdir());
    return bulkFileStorage;
  }

  registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
    commands.registerCommand("extraterm:window.newTerminal", (args: any) => this.commandNewTerminal(args));
  }

  commandNewTerminal(args: {sessionUuid?: string, sessionName?: string, workingDirectory?: string}): void {
    let sessionConfiguration: SessionConfiguration = this.#configDatabase.getSessionConfig()[0];
    if (args.sessionUuid != null) {
      sessionConfiguration = this.#getSessionByUuid(args.sessionUuid);
      if (sessionConfiguration == null) {
        throw new Error(`Unable to find session with UUID ${args.sessionUuid}`);
      }
    } else if (args.sessionName != null) {
      sessionConfiguration = this.#getSessionByName(args.sessionName);
      if (sessionConfiguration == null) {
        throw new Error(`Unable to find session with name ${args.sessionName}`);
      }
    }

    let workingDirectory: string = null;
    // if (args.workingDirectory != null) {
    //   workingDirectory = args.workingDirectory;
    // } else {
    //   const activeTerminal = this.#extensionManager.getActiveTerminal();
    //   if (activeTerminal != null && activeTerminal.getSessionConfiguration().type === sessionConfiguration.type) {
    //     workingDirectory = await activeTerminal.getPty().getWorkingDirectory();
    //   }
    // }

    const newTerminal = new Terminal();

    const extraEnv = {
      [EXTRATERM_COOKIE_ENV]: newTerminal.getExtratermCookieValue(),
      "COLORTERM": "truecolor",   // Advertise that we support 24bit color
    };

    const sessionOptions: CreateSessionOptions = {
      extraEnv,
      cols: newTerminal.getColumns(),
      rows: newTerminal.getRows()
    };

    if (workingDirectory != null) {
      sessionOptions.workingDirectory = workingDirectory;
    }

    const pty = this.#ptyManager.createPty(sessionConfiguration, sessionOptions);

    // newTerminal.setTerminalVisualConfig(this.#terminalVisualConfig);
    // newTerminal.setSessionConfiguration(sessionConfiguration);

    // Set the default name of the terminal tab to the session name.
    // newTerminal.setTerminalTitle(sessionConfiguration.name);

    this.#windows[0].addTab(newTerminal);
    newTerminal.setPty(pty);

    // this._setUpNewTerminalEventHandlers(newTerminal);
    // this._sendTabOpenedEvent();

    // this.focusTab(newTerminal);
    // this.#extensionManager.newTerminalCreated(newTerminal, this._getAllTerminals());
  }

  #getSessionByUuid(sessionUuid: string): SessionConfiguration {
    const sessions = this.#configDatabase.getSessionConfigCopy();
    for (const session of sessions) {
      if (session.uuid === sessionUuid) {
        return session;
      }
    }
    return null;
  }

  #getSessionByName(sessionName: string): SessionConfiguration {
    const sessions = this.#configDatabase.getSessionConfigCopy();
    for (const session of sessions) {
      if (session.name === sessionName) {
        return session;
      }
    }
    return null;
  }

  startUpSessions(configDatabase: ConfigDatabase, extensionManager: ExtensionManager): void {
    const disposables = new DisposableHolder();

    const createSessionCommands = (sessionConfigs: SessionConfiguration[]): void => {
      const extensionContext = extensionManager.getExtensionContextByName("internal-commands");

      for (const session of sessionConfigs) {
        const args = {
          sessionUuid: session.uuid
        };
        const command = "extraterm:window.newTerminal?" + encodeURIComponent(JSON.stringify(args));
        const contrib: ExtensionCommandContribution = {
          command,
          title: "New Terminal: " + session.name,
          category: "window",
          order: 1000,
          when: "",
          icon: "fa fa-plus",
        };
        disposables.add(extensionContext._registerCommandContribution(contrib));

        extensionContext._setCommandMenu(command, "contextMenu", false);
        extensionContext._setCommandMenu(command, "commandPalette", true);
        extensionContext._setCommandMenu(command, "newTerminal", true);
        extensionContext._setCommandMenu(command, "windowMenu", true);
      }
    };

    configDatabase.onChange(event => {
      if (event.key === SESSION_CONFIG) {
        disposables.dispose();
        createSessionCommands(event.newConfig);
      }
    });

    const sessionConfig = <SessionConfiguration[]> configDatabase.getSessionConfig();
    createSessionCommands(sessionConfig);
  }


  openWindow(): void {
    const win = new Window(this.#configDatabase, this.#themeManager);
    this.#windows.push(win);
    win.open();
  }
}

const main =  new Main();
main.init();
(global as any).main = main;
