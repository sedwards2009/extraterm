/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as SourceMapSupport from "source-map-support";
import * as SourceDir from './SourceDir';
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { FileLogWriter, getLogger, addLogWriter, Logger, log } from "extraterm-logging";
import { CreateSessionOptions, SessionConfiguration} from '@extraterm/extraterm-extension-api';
import { QApplication, QFontDatabase, QStyleFactory } from "@nodegui/nodegui";

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
import { Tab } from "./Tab";
import { SettingsTab } from "./settings/SettingsTab";
import { LocalHttpServer } from "./local_http_server/LocalHttpServer";
import { BulkFileRequestHandler } from "./bulk_file_handling/BulkFileRequestHandler";
import { createUiStyle } from "./ui/styles/DarkTwo";
import { UiStyle } from "./ui/UiStyle";
import { CommandPalette } from "./CommandPalette";


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
  #extensionManager: ExtensionManager = null;
  #themeManager: ThemeManager = null;
  #keybindingsIOManager: KeybindingsIOManager = null;
  #uiStyle: UiStyle = null;

  #settingsTab: SettingsTab = null;

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
    const extensionManager = this.setupExtensionManager(configDatabase, packageJson.version);
    this.#extensionManager = extensionManager;

    this.#keybindingsIOManager = this.setupKeybindingsManager(configDatabase, extensionManager);

    const themeManager = this.setupThemeManager(extensionManager);
    this.#themeManager = themeManager;

    sanitizeAndInitializeConfigs(configDatabase, themeManager, availableFonts);
    const generalConfig = configDatabase.getGeneralConfig();
    const titleBarStyle = generalConfig.titleBarStyle;
    const systemConfig = this.systemConfiguration(availableFonts, packageJson, titleBarStyle);
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
    this.setupDesktopSupport();
    // TODO: setupGlobalKeybindingsManager()
    // TODO: registerInternalCommands()

    this.setupLocalHttpServer(bulkFileStorage);

    this.registerCommands(extensionManager);
    this.startUpSessions(configDatabase, extensionManager);

    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/extraicons.ttf"));
    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/fa-brands-400.ttf"));
    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/fa-solid-900.ttf"));

    this.#uiStyle = createUiStyle(path.posix.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"));
    QApplication.setStyle(QStyleFactory.create("Fusion"));
    QApplication.instance().setStyleSheet(this.#uiStyle.getApplicationStyleSheet());

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

  setupExtensionManager(configDatabase: ConfigDatabase, applicationVersion: string): ExtensionManager {
    const extensionPaths = [path.join(__dirname, "../../extensions" )];
    const userExtensionDirectory = getUserExtensionDirectory();
    this._log.info(`User extension directory is: ${userExtensionDirectory}`);
    if (fs.existsSync(userExtensionDirectory)) {
      extensionPaths.push(userExtensionDirectory);
    }

    const extensionManager = new ExtensionManager(configDatabase, extensionPaths, applicationVersion);
    extensionManager.startUpExtensions(configDatabase.getGeneralConfig().activeExtensions);
    return extensionManager;
  }

  setupKeybindingsManager(configDatabase: PersistentConfigDatabase,
      extensionManager: ExtensionManager): KeybindingsIOManager {
    const keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager,
      configDatabase);
    return keybindingsIOManager;
  }

  setupThemeManager(extensionManager: ExtensionManager): ThemeManager {
    const themeManager = new ThemeManager({ terminal: [getUserTerminalThemeDirectory()]}, extensionManager);
    return themeManager;
  }

  /**
   * Extra information about the system configuration and platform.
   */
  systemConfiguration(availableFonts: FontInfo[], packageJson: any, titleBarStyle: TitleBarStyle): SystemConfig {
    const homeDir = os.homedir();
    return {
      homeDir,
      applicationVersion: packageJson.version,
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

  async setupLocalHttpServer(bulkFileStorage: BulkFileStorage): Promise<LocalHttpServer> {
    const ipcFilePath = path.join(getUserSettingsDirectory(), IPC_FILENAME);
    const localHttpServer = new LocalHttpServer(ipcFilePath);
    await localHttpServer.start();

    bulkFileStorage.setLocalUrlBase(localHttpServer.getLocalUrlBase());
    const bulkFileRequestHandler = new BulkFileRequestHandler(bulkFileStorage);
    localHttpServer.registerRequestHandler("bulk", bulkFileRequestHandler);

    return localHttpServer;
  }

  registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").commands;
    commands.registerCommand("extraterm:application.openCommandPalette", () => this.commandOpenCommandPalette());
    commands.registerCommand("extraterm:window.newTerminal", (args: any) => this.commandNewTerminal(args));
    commands.registerCommand("extraterm:window.openSettings", () => this.commandOpenSettings());
    commands.registerCommand("extraterm:window.focusTabLeft", () => this.commandFocusTabLeft());
    commands.registerCommand("extraterm:window.focusTabRight", () => this.commandFocusTabRight());
    commands.registerCommand("extraterm:window.closeTab", () => this.commandCloseTab());
    commands.registerCommand("extraterm:terminal.scrollPageDown", () => this.commandTerminalScrollPageDown());
    commands.registerCommand("extraterm:terminal.scrollPageUp", () => this.commandTerminalScrollPageUp());
    commands.registerCommand("extraterm:terminal.pasteFromClipboard", () => this.commandPasteFromClipboard());
    commands.registerCommand("extraterm:terminal.copyToClipboard", () => this.commandCopyToClipboard());
  }

  setupDesktopSupport(): void {
    QApplication.instance().addEventListener('focusWindowChanged', () => {
      let activeWindow: Window = null;
      for (const window of this.#windows) {
        if (window.isActiveWindow()) {
          activeWindow = window;
        }
      }

      this.#extensionManager.setActiveWindow(activeWindow);
    });
  }

  commandOpenCommandPalette(): void {
    const win = this.#extensionManager.getActiveWindow();
    // const tab = this.#extensionManager.getActiveTab();
    const tab = win.getTab(win.getCurrentTabIndex());
    const commandPalette = new CommandPalette(this.#extensionManager, this.#keybindingsIOManager, this.#uiStyle);
    commandPalette.show(win, tab);
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

    const workingDirectory: string = null;
    // if (args.workingDirectory != null) {
    //   workingDirectory = args.workingDirectory;
    // } else {
    //   const activeTerminal = this.#extensionManager.getActiveTerminal();
    //   if (activeTerminal != null && activeTerminal.getSessionConfiguration().type === sessionConfiguration.type) {
    //     workingDirectory = await activeTerminal.getPty().getWorkingDirectory();
    //   }
    // }

    const newTerminal = new Terminal(this.#configDatabase, this.#extensionManager, this.#keybindingsIOManager);
    newTerminal.onSelectionChanged(() => {
      this.#handleTerminalSelectionChanged(newTerminal);
    });
    this.#windows[0].addTab(newTerminal);
    this.#windows[0].focusTab(newTerminal);

    const extraEnv = {
      [EXTRATERM_COOKIE_ENV]: newTerminal.getExtratermCookieValue(),
      "COLORTERM": "truecolor",   // Advertise that we support 24bit color
    };
    newTerminal.resizeEmulatorFromTerminalSize();

    const sessionOptions: CreateSessionOptions = {
      extraEnv,
      cols: newTerminal.getColumns(),
      rows: newTerminal.getRows()
    };

    if (workingDirectory != null) {
      sessionOptions.workingDirectory = workingDirectory;
    }

    // newTerminal.setTerminalVisualConfig(this.#terminalVisualConfig);
    // newTerminal.setSessionConfiguration(sessionConfiguration);

    // Set the default name of the terminal tab to the session name.
    // newTerminal.setTerminalTitle(sessionConfiguration.name);


    const pty = this.#ptyManager.createPty(sessionConfiguration, sessionOptions);
    pty.onExit(() => {
      this.#disposeTerminalTab(newTerminal);
    });
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

  #handleTerminalSelectionChanged(newTerminal: Terminal): void {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    if (generalConfig.autoCopySelectionToClipboard) {
      this.commandCopyToClipboard();
    }
  }

  #disposeTerminalTab(terminal: Terminal): void {
    terminal.dispose();

    for (const window of this.#windows) {
      window.removeTab(terminal);
    }
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
          icon: "fa-plus",
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
    const win = new Window(this.#configDatabase, this.#extensionManager, this.#keybindingsIOManager,
      this.#themeManager, this.#uiStyle);

    win.onTabCloseRequest((tab: Tab): void => {
      this.#closeTab(win, tab);
    });

    win.onTabChange((tab: Tab): void => {
      this.#extensionManager.setActiveTerminal(tab instanceof Terminal ? tab : null);
    });

    this.#windows.push(win);
    win.open();
  }

  #closeTab(win: Window, tab: Tab): void {
    if (tab instanceof Terminal) {
      this.#disposeTerminalTab(tab);
    }
    if (tab instanceof SettingsTab) {
      win.removeTab(this.#settingsTab);
    }
  }

  commandOpenSettings(): void {
    if (this.#settingsTab == null) {
      this.#settingsTab = new SettingsTab(this.#configDatabase, this.#extensionManager, this.#uiStyle);
    }
    const win = this.#extensionManager.getActiveWindow();
    win.addTab(this.#settingsTab);
    win.focusTab(this.#settingsTab);
  }

  commandFocusTabLeft(): void {
    const win = this.#extensionManager.getActiveWindow();
    const tabCount = win.getTabCount();
    const index = win.getCurrentTabIndex() - 1;
    win.setCurrentTabIndex(index < 0 ? tabCount - 1 : index);
  }

  commandFocusTabRight(): void {
    const win = this.#extensionManager.getActiveWindow();
    const tabCount = win.getTabCount();
    const index = win.getCurrentTabIndex() + 1;
    win.setCurrentTabIndex(index >= tabCount ? 0 : index);
  }

  commandCloseTab(): void {
    const win = this.#extensionManager.getActiveWindow();
    const tab = win.getTab(win.getCurrentTabIndex());
    this.#closeTab(win, tab);
  }

  commandTerminalScrollPageDown(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    terminal.scrollPageDown();
  }

  commandTerminalScrollPageUp(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    terminal.scrollPageUp();
  }

  commandCopyToClipboard(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    const text = terminal.getSelectionText();
    if (text == null || text === "") {
      return;
    }
    const clipboard = QApplication.clipboard();
    clipboard.setText(text);
  }

  commandPasteFromClipboard(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    const clipboard = QApplication.clipboard();
    const text = clipboard.text();
    terminal.pasteText(text);
  }
}

const main =  new Main();
main.init();
(global as any).main = main;
