/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import sourceMapSupport from "source-map-support";

import * as _ from "lodash-es";
import * as SourceDir from "./SourceDir.js";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { FileLogWriter, getLogger, addLogWriter, Logger, log } from "extraterm-logging";
import { CreateSessionOptions, SessionConfiguration, TerminalEnvironment} from '@extraterm/extraterm-extension-api';
import { Menu } from "qt-construct";
import { QAction, QApplication, QFontDatabase, QIcon, QRect, QSize, QStylePixelMetric, QSystemTrayIcon, setLogCreateQObject, setLogDestroyQObject, wrapperCache } from "@nodegui/nodegui";
import { StyleTweaker } from "nodegui-plugin-style-tweaker";
import { doLater } from "extraterm-timeoutqt";

import { PopOutClickedDetails, Window, WindowManager, setupWindowManager } from "./Window.js";
import { GENERAL_CONFIG, SESSION_CONFIG, WindowConfiguration } from "./config/Config.js";
import { ConfigChangeEvent, ConfigDatabase } from "./config/ConfigDatabase.js";
import { ExtensionCommandContribution } from "./extension/ExtensionMetadata.js";
import { DisposableHolder } from "./utils/DisposableUtils.js";
import { PersistentConfigDatabase } from "./config/PersistentConfigDatabase.js";
import { SharedMap } from "./shared_map/SharedMap.js";
import { getUserExtensionDirectory, getUserKeybindingsDirectory, getUserSettingsDirectory, getUserTerminalThemeDirectory, sanitizeAndInitializeConfigs, setupAppData } from "./config/MainConfig.js";
import { getFonts, installBundledFonts } from "./ui/FontList.js";
import { KeybindingsIOManager } from "./keybindings/KeybindingsIOManager.js";
import { FontInfo, GeneralConfig, SystemConfig, TitleBarStyle } from "./config/Config.js";
import { ThemeManager } from "./theme/ThemeManager.js";
import { PtyManager } from "./pty/PtyManager.js";
import { BulkFileStorage } from "./bulk_file_handling/BulkFileStorage.js";
import { ExtensionManager } from "./extension/ExtensionManager.js";
import { EXTRATERM_COOKIE_ENV, Terminal } from "./terminal/Terminal.js";
import { Tab } from "./Tab.js";
import { SettingsTab } from "./settings/SettingsTab.js";
import { LocalHttpServer } from "./local_http_server/LocalHttpServer.js";
import { BulkFileRequestHandler } from "./bulk_file_handling/BulkFileRequestHandler.js";
import { createUiStyle } from "./ui/styles/DarkTwo.js";
import { UiStyle } from "./ui/UiStyle.js";
import { CommandPalette } from "./CommandPalette.js";
import { PingHandler } from "./local_http_server/PingHandler.js";
import { FontAtlasCache } from "./terminal/FontAtlasCache.js";
import { DecoratedFrame } from "./terminal/DecoratedFrame.js";
import { TerminalBlock } from "./terminal/TerminalBlock.js";
import { BulkFile } from "./bulk_file_handling/BulkFile.js";
import { CommandRequestHandler } from "./local_http_server/CommandRequestHandler.js";


sourceMapSupport.install();

const __dirname = SourceDir.path;

const LOG_FILENAME = "extraterm.log";
const IPC_FILENAME = "ipc.run";

const PACKAGE_JSON_PATH = "../../package.json";

interface OpenSettingsArgs {
  select?: string;
}

interface WindowDescription {
  id: string;
}

/**
 * Main.
 *
 * This file is the main entry point for the node process and the whole application.
 */
class Main {

  private _log: Logger = null;
  #windowManager: WindowManager = null;
  #configDatabase: ConfigDatabase = null;
  #ptyManager: PtyManager = null;
  #extensionManager: ExtensionManager = null;
  #themeManager: ThemeManager = null;
  #keybindingsManager: KeybindingsIOManager = null;
  #uiStyle: UiStyle = null;
  #fontAtlasCache: FontAtlasCache = null;
  #bulkFileStorage: BulkFileStorage = null;

  #settingsTab: SettingsTab = null;

  #tweakerStyle: StyleTweaker = null;
  #tagCounter = 0;
  #tray: QSystemTrayIcon = null;

  constructor() {
    this._log = getLogger("main", this);
  }

  async init(): Promise<void> {
    setupAppData();
    QApplication.setApplicationDisplayName("Extraterm");

    const sharedMap = new SharedMap();
    const configDatabase = new PersistentConfigDatabase(getUserSettingsDirectory(), sharedMap);
    this.#configDatabase = configDatabase;
    configDatabase.start();

    this.setupLogging();

    // this._log.startRecording();

    await installBundledFonts();
    const availableFonts = getFonts();
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, PACKAGE_JSON_PATH), "utf8"));

    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/Twemoji.ttf"));
    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/extraicons.ttf"));
    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/fa-brands-400.ttf"));
    QFontDatabase.addApplicationFont(path.join(SourceDir.path, "../resources/fonts/fa-solid-900.ttf"));

    this.#uiStyle = createUiStyle(path.posix.join(SourceDir.posixPath, "../resources/theme_ui/DarkTwo/"));

    const themeManager = this.setupThemeManager();
    this.#themeManager = themeManager;

    // We have to start up the extension manager before we can scan themes (with the help of extensions)
    // and properly sanitize the config.
    const extensionManager = await this.setupExtensionManager(configDatabase, this.#themeManager, this.#uiStyle,
      packageJson.version);
    this.#extensionManager = extensionManager;
    this.#themeManager.init(this.#extensionManager);

    this.#keybindingsManager = this.setupKeybindingsManager(configDatabase, extensionManager);


    sanitizeAndInitializeConfigs(configDatabase, themeManager, availableFonts);
    const generalConfig = configDatabase.getGeneralConfig();
    const titleBarStyle = generalConfig.titleBarStyle;
    const systemConfig = this.systemConfiguration(availableFonts, packageJson, titleBarStyle);
    configDatabase.setSystemConfig(systemConfig);

    this.#fontAtlasCache = new FontAtlasCache();

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

    this.#bulkFileStorage = this.setupBulkFileStorage();
    this.setupDesktopSupport();
    this.#showTrayIcon(this.#configDatabase.getGeneralConfig().showTrayIcon);

    this.setupLocalHttpServer(extensionManager, this.#bulkFileStorage);

    this.registerCommands(extensionManager);
    this.startUpSessions(configDatabase, extensionManager);

    this.#windowManager = setupWindowManager(this.#extensionManager, this.#keybindingsManager, this.#configDatabase,
      this.#themeManager, this.#uiStyle);
    this.#windowManager.onNewWindow((win: Window) => {
      this.#handleNewWindow(win);
    });
    extensionManager.setWindowManager(this.#windowManager);

    this.#setApplicationStyle(generalConfig.uiScalePercent);

    configDatabase.onChange((e: ConfigChangeEvent) => {
      if (e.key !== GENERAL_CONFIG) {
        return;
      }
      const oldConfig = <GeneralConfig> e.oldConfig;
      const newConfig = <GeneralConfig> e.newConfig;
      if ((oldConfig?.uiScalePercent) !== newConfig.uiScalePercent) {
        this.#setApplicationStyle(newConfig.uiScalePercent);
      }
      if ((oldConfig?.showTrayIcon) !== newConfig.showTrayIcon) {
        this.#showTrayIcon(newConfig.showTrayIcon);
      }
    });

    this.#keybindingsManager.installGlobalShortcuts();

    QApplication.instance().addEventListener("lastWindowClosed", () => {
      this.#cleanupAndExit();
    });

    await this.openWindow();
  }

  #cleanupAndExit(): void {
    this.#keybindingsManager.uninstallGlobalShortcuts();
    doLater(() => {
      QApplication.instance().quit();
    });
  }

  #setApplicationStyle(uiScalePercent: number): void {
    let dpi = Math.min(0, ...this.#windowManager.getAllWindows().map(w => w.getDpi()));
    dpi = dpi === 0 ? QApplication.primaryScreen().logicalDotsPerInch() : dpi;  // TODO

    const qApplication = QApplication.instance();
    let uiScale = uiScalePercent / 100;
    if (process.platform === "darwin") {
      uiScale *= 1.5; // Make everything bigger on macOS to more closely match native apps.
                      // Note: This factor appears in Wndow.ts too
    }

    qApplication.setStyleSheet(this.#uiStyle.getApplicationStyleSheet(uiScale, dpi), false);
    this.#tweakerStyle = new StyleTweaker("Windows");

    const iconSize = this.#uiStyle.getMenuIconSize(uiScale, dpi);
    const buttonIconSize = this.#uiStyle.getButtonIconSize(uiScale, dpi);
    this.#tweakerStyle.setPixelMetric(QStylePixelMetric.PM_SmallIconSize, iconSize);
    this.#tweakerStyle.setPixelMetric(QStylePixelMetric.PM_ToolBarIconSize, iconSize);
    this.#tweakerStyle.setPixelMetric(QStylePixelMetric.PM_ButtonIconSize, buttonIconSize);
    this.#tweakerStyle.setPixelMetric(QStylePixelMetric.PM_TabCloseIndicatorHeight, iconSize);
    this.#tweakerStyle.setPixelMetric(QStylePixelMetric.PM_TabCloseIndicatorWidth, iconSize);
    this.#tweakerStyle.setStyleHint(0 /* QStyle::SH_EtchDisabledText */, 0);

    QApplication.setStyle(this.#tweakerStyle);
  };

  #handleNewWindow(window: Window): void {
    window.onTabCloseRequest((tab: Tab): void => {
      this.#closeTab(window, tab);
    });

    window.onTabChange((tab: Tab): void => {
      if (tab instanceof Terminal) {
        this.#extensionManager.setActiveTerminal(tab);
        const blockFrames = tab.getBlockFrames();
        this.#extensionManager.setActiveBlockFrame(blockFrames[blockFrames.length-1]);
      } else {
        this.#extensionManager.setActiveTerminal(null);
        this.#extensionManager.setActiveBlockFrame(null);
      }
      this.#extensionManager.setActiveTab(tab);
    });

    const onWindowGeometryChanged = _.debounce(() => {
      if (!this.#windowManager.getAllWindows().includes(window)) {
        return;
      }
      this.#saveWindowGeometry();
    }, 500);

    window.onWindowGeometryChanged(onWindowGeometryChanged);

    window.onPopOutClicked((details: PopOutClickedDetails) => {
      this.#handlePopOutClicked(details.window, details.terminal, details.frame);
    });

    window.onWindowDispose((win: Window): void => {
      doLater(() => {
        if (this.#windowManager.getAllWindows().length === 0) {
          this.#cleanupAndExit();
        }
      });
    });
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

  #nextTag(): number {
    return ++this.#tagCounter;
  }

  async setupExtensionManager(configDatabase: ConfigDatabase, themeManager: ThemeManager, uiStyle: UiStyle,
      applicationVersion: string): Promise<ExtensionManager> {

    const extensionPaths = [path.join(__dirname, "../../extensions" )];
    const userExtensionDirectory = getUserExtensionDirectory();
    this._log.info(`User extension directory is: ${userExtensionDirectory}`);
    if (fs.existsSync(userExtensionDirectory)) {
      extensionPaths.push(userExtensionDirectory);
    }

    const extensionManager = new ExtensionManager(configDatabase, themeManager, uiStyle, extensionPaths, applicationVersion);
    await extensionManager.startUpExtensions(configDatabase.getGeneralConfig().activeExtensions);
    return extensionManager;
  }

  setupKeybindingsManager(configDatabase: PersistentConfigDatabase,
      extensionManager: ExtensionManager): KeybindingsIOManager {
    const keybindingsIOManager = new KeybindingsIOManager(getUserKeybindingsDirectory(), extensionManager,
      configDatabase);
    return keybindingsIOManager;
  }

  setupThemeManager(): ThemeManager {
    const themeManager = new ThemeManager({ terminal: [getUserTerminalThemeDirectory()]});
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

  #frameFinder(frameIdStr: string): BulkFile {
    const frameId = Number.parseInt(frameIdStr, 10);
    if (isNaN(frameId)) {
      return null;
    }

    for (const win of this.#windowManager.getAllWindows()) {
      const tc = win.getTabCount();
      for (let i=0; i<tc; i++) {
        const tab = win.getTab(i);
        if (tab instanceof Terminal) {
          const bulkFile = tab.getFrameContents(frameId);
          if (bulkFile != null) {
            return bulkFile;
          }
        }
      }
    }
    return null;
  }

  async setupLocalHttpServer(extensionManager: ExtensionManager, bulkFileStorage: BulkFileStorage): Promise<LocalHttpServer> {
    const ipcFilePath = path.join(getUserSettingsDirectory(), IPC_FILENAME);
    const localHttpServer = new LocalHttpServer(ipcFilePath);
    await localHttpServer.start();

    bulkFileStorage.setLocalUrlBase(localHttpServer.getLocalUrlBase());
    const bulkFileRequestHandler = new BulkFileRequestHandler(bulkFileStorage);
    localHttpServer.registerRequestHandler("bulk", bulkFileRequestHandler);
    const pingHandler = new PingHandler();
    localHttpServer.registerRequestHandler("ping", pingHandler);

    const getWindowById = (id: number): Window => {
      for (const window of this.#windowManager.getAllWindows()) {
        if (window.getId() === id) {
          return window;
        }
      }
      return null;
    };
    const commandRequestHandler = new CommandRequestHandler(extensionManager, getWindowById);
    localHttpServer.registerRequestHandler("command", commandRequestHandler);

    return localHttpServer;
  }

  registerCommands(extensionManager: ExtensionManager): void {
    const commands = extensionManager.getExtensionContextByName("internal-commands").getExtensionContext().commands;
    commands.registerCommand("extraterm:global.globalMaximize", () => this.commandMaximizeAllWindows());
    commands.registerCommand("extraterm:global.globalShow", () => this.commandRestoreAllWindows());
    commands.registerCommand("extraterm:global.globalHide", () => this.commandMinimizeAllWindows());
    commands.registerCommand("extraterm:global.globalToggleShowHide", () => this.commandToggleAllWindows());
    commands.registerCommand("extraterm:application.openCommandPalette", () => this.commandOpenCommandPalette());
    commands.registerCommand("extraterm:application.newWindow", () => this.commandNewWindow());
    commands.registerCommand("extraterm:application.quit", () => this.commandQuit());
    commands.registerCommand("extraterm:window.newTerminal", (args: any) => this.commandNewTerminal(args));
    commands.registerCommand("extraterm:window.openSettings", (args: any) => this.commandOpenSettings(args));
    commands.registerCommand("extraterm:window.focusPaneLeft", () => this.commandFocusPaneLeft());
    commands.registerCommand("extraterm:window.focusPaneRight", () => this.commandFocusPaneRight());
    commands.registerCommand("extraterm:window.focusPaneAbove", () => this.commandFocusPaneAbove());
    commands.registerCommand("extraterm:window.focusPaneBelow", () => this.commandFocusPaneBelow());
    commands.registerCommand("extraterm:window.horizontalSplit", () => this.commandHorizontalSplit());
    commands.registerCommand("extraterm:window.verticalSplit", () => this.commandVerticalSplit());
    commands.registerCommand("extraterm:window.focusTabLeft", () => this.commandFocusTabLeft());
    commands.registerCommand("extraterm:window.focusTabRight", () => this.commandFocusTabRight());
    commands.registerCommand("extraterm:window.closeTab", () => this.commandCloseTab());
    commands.registerCommand("extraterm:window.close", () => this.commandCloseWindow());
    commands.registerCommand("extraterm:window.listAll", () => this.commandListWindows());
    commands.registerCommand("extraterm:window.moveTabToNewWindow", () => this.commandMoveTabToNewWindow());
    commands.registerCommand("extraterm:window.maximize", () => this.commandMaximizeWindow());
    commands.registerCommand("extraterm:window.minimize", () => this.commandMinimizeWindow());
    commands.registerCommand("extraterm:window.restore", () => this.commandRestoreWindow());
    commands.registerCommand("extraterm:window.show", () => this.commandShowWindow());
    commands.registerCommand("extraterm:window.showAll", () => this.commandShowAllWindows());
    commands.registerCommand("extraterm:terminal.openLastFrame",() => this.commandOpenLastFrame());

    Terminal.registerCommands(extensionManager);
  }

  setupDesktopSupport(): void {
//     QApplication.instance().addEventListener("focusWindowChanged", () => {
// this._log.debug(`focusWindowChanged`);
//       let activeWindow: Window = null;
//       for (const window of this.#windowManager.getAllWindows()) {
//         if (window.isActiveWindow()) {
//           activeWindow = window;
//         }
//       }

//       this.#extensionManager.setActiveWindow(activeWindow);
//     });

    const trayIcon = this.#createTrayIcon();
    this.#tray = new QSystemTrayIcon();
    this.#tray.setIcon(trayIcon);
    this.#tray.setToolTip("Extraterm Qt");
    const trayMenu = Menu({
      items: [
        { title: "Maximize", data: "maximize" },
        { title: "Minimize", data: "minimize" },
        { title: "Restore", data: "restore" },
      ],
      onTriggered: (nativeAction) => {
        const action = new QAction(nativeAction);
        switch (action.data().toString()) {
          case "maximize":
            this.commandMaximizeAllWindows();
            break;
          case "minimize":
            this.commandMinimizeAllWindows();
            break;
          case "restore":
            this.commandRestoreAllWindows();
            break;
        }
      }
    });
    this.#tray.setContextMenu(trayMenu);
    this.#tray.addEventListener("activated", () => {
      this.commandToggleAllWindows();
    });
  }

  #createTrayIcon(): QIcon {
    const windowIcon = new QIcon();
    for (const size of [16, 22, 32, 64, 256]) {
      const iconPath = path.join(SourceDir.path, `../resources/logo/extraterm_small_logo_${size}x${size}.png`);
      windowIcon.addFile(iconPath, new QSize(size, size));
    }
    return windowIcon;
  }

  #showTrayIcon(show: boolean): void {
    if (show) {
      this.#tray.show();
    } else {
      this.#tray.hide();
    }
  }

  commandOpenCommandPalette(): void {
    const win = this.#extensionManager.getActiveWindow();
    const tab = this.#extensionManager.getActiveTab();
    const commandPalette = new CommandPalette(this.#extensionManager, this.#keybindingsManager, this.#uiStyle);
    commandPalette.show(win, tab);
  }

  commandNewWindow(): void {
    this.openWindow();
  }

  commandQuit(): void {
    while (this.#windowManager.getAllWindows().length !== 0) {
      this.#windowManager.disposeWindow(this.#windowManager.getAllWindows()[0]);
    }
  }

  async commandNewTerminal(args: {sessionUuid?: string, sessionName?: string, workingDirectory?: string}): Promise<void> {
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

    const activeTab = this.#extensionManager.getActiveTab();
    const window = this.#extensionManager.getActiveWindow() ?? this.#windowManager.getAllWindows()[0];

    let workingDirectory: string = null;
    if (args.workingDirectory != null) {
      workingDirectory = args.workingDirectory;
    } else {
      const activeTerminal = this.#extensionManager.getActiveTerminal();
      if (activeTerminal != null && activeTerminal.getSessionConfiguration().type === sessionConfiguration.type) {
        workingDirectory = await activeTerminal.getPty().getWorkingDirectory();
      }
    }

    const newTerminal = new Terminal(this.#configDatabase, this.#uiStyle, this.#extensionManager,
      this.#keybindingsManager, this.#fontAtlasCache, this.#nextTag.bind(this), this.#frameFinder.bind(this),
      this.#bulkFileStorage);
    newTerminal.onSelectionChanged(() => {
      this.#handleTerminalSelectionChanged(newTerminal);
    });
    newTerminal.setSessionConfiguration(sessionConfiguration);

    window.addTab(newTerminal, () => {
      // Before the tab header widget can be added, we want to make sure
      // that the PTY etc is set up so that any extensions which want to
      // add a widget to the tab header see a properly initialised terminal.

      const extraEnv = {
        [EXTRATERM_COOKIE_ENV]: newTerminal.getExtratermCookieValue(),
        "COLORTERM": "truecolor",   // Advertise that we support 24bit color
      };
      newTerminal.resizeTerminalArea();

      const sessionOptions: CreateSessionOptions = {
        extraEnv,
        cols: newTerminal.getColumns(),
        rows: newTerminal.getRows()
      };

      if (workingDirectory != null) {
        sessionOptions.workingDirectory = workingDirectory;
      }

      // Set the default name of the terminal tab to the session name.
      // newTerminal.setTerminalTitle(sessionConfiguration.name);

      const pty = this.#ptyManager.createPty(sessionConfiguration, sessionOptions);
      pty.onExit(() => {
        this.#disposeTerminalTab(newTerminal);
      });
      newTerminal.setPty(pty);
    }, activeTab);

    window.focusTab(newTerminal);
    this.#extensionManager.newTerminalCreated(window, newTerminal);
    newTerminal.start();
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

    for (const window of this.#windowManager.getAllWindows()) {
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
        disposables.add(extensionContext.commands.registerCommandContribution(contrib));

        extensionContext.setCommandMenu(command, "contextMenu", false);
        extensionContext.setCommandMenu(command, "commandPalette", true);
        extensionContext.setCommandMenu(command, "newTerminal", true);
        extensionContext.setCommandMenu(command, "windowMenu", true);
      }
    };

    configDatabase.onChange((event: ConfigChangeEvent) => {
      if (event.key === SESSION_CONFIG) {
        disposables.dispose();
        createSessionCommands(event.newConfig);
      }
    });

    const sessionConfig = <SessionConfiguration[]> configDatabase.getSessionConfig();
    createSessionCommands(sessionConfig);
  }

  async openWindow(): Promise<Window> {
    const generalConfig = this.#configDatabase.getGeneralConfig();
    let geometry: QRect = null;
    let showMaximized = false;
    if (generalConfig.windowConfiguration != null) {
      const winConfig = generalConfig.windowConfiguration[this.#windowManager.getAllWindows().length];
      if (winConfig != null) {
        geometry = new QRect(winConfig.x, winConfig.y, winConfig.width, winConfig.height);
        showMaximized = winConfig.isMaximized === true;
      }
    }

    const win = this.#windowManager.createWindow(geometry);

    win.open();
    if (showMaximized) {
      win.maximize();
    }
    this.#extensionManager.newWindowCreated(win);
    return win;
  }

  #saveWindowGeometry(): void {
    const generalConfig = this.#configDatabase.getGeneralConfigCopy();
    const winConfig: WindowConfiguration = {};
    for (const [index, win] of this.#windowManager.getAllWindows().entries()) {
      const geo = win.getGeometry();
      winConfig[index] = {
        isMaximized: win.isMaximized(),
        x: geo.left(),
        y: geo.top(),
        width: geo.width(),
        height: geo.height(),
      };
    }
    generalConfig.windowConfiguration = winConfig;
    this.#configDatabase.setGeneralConfig(generalConfig);
  }

  #closeTab(win: Window, tab: Tab): void {
    win.removeTab(tab);
    tab.dispose();
  }

  commandOpenSettings(args: any): void {
    const window = this.#extensionManager.getActiveWindow();
    if (this.#settingsTab == null) {
      this.#settingsTab = new SettingsTab(this.#configDatabase, this.#extensionManager, this.#themeManager,
        this.#keybindingsManager, window, this.#uiStyle, this.#fontAtlasCache);
    }

    const openSettingsArgs: OpenSettingsArgs = args;
    if (openSettingsArgs.select !== undefined) {
      this.#settingsTab.selectPageByName(openSettingsArgs.select);
    }

    for (const win of this.#windowManager.getAllWindows()) {
      if (win.hasTab(this.#settingsTab)) {
        win.focus();
        win.focusTab(this.#settingsTab);
        return;
      }
    }
    window.addTab(this.#settingsTab);
    window.focusTab(this.#settingsTab);
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

  commandFocusPaneLeft(): void {
    this.#extensionManager.getActiveWindow().focusPaneLeft();
  }

  commandFocusPaneRight(): void {
    this.#extensionManager.getActiveWindow().focusPaneRight();
  }

  commandFocusPaneAbove(): void {
    this.#extensionManager.getActiveWindow().focusPaneAbove();
  }

  commandFocusPaneBelow(): void {
    this.#extensionManager.getActiveWindow().focusPaneBelow();
  }

  commandHorizontalSplit(): void {
    this.#extensionManager.getActiveWindow().horizontalSplit();
  }

  commandVerticalSplit(): void {
    this.#extensionManager.getActiveWindow().verticalSplit();
  }

  commandCloseTab(): void {
    const win = this.#extensionManager.getActiveWindow();
    const tab = win.getTab(win.getCurrentTabIndex());
    this.#closeTab(win, tab);
  }

  commandCloseWindow(): void {
    const win = this.#extensionManager.getActiveWindow();
    this.#windowManager.disposeWindow(win);
  }

  commandListWindows(): WindowDescription[] {
    return this.#windowManager.getAllWindows().map(w => ({
      id: `${w.getId()}`
    }));
  }

  async commandMoveTabToNewWindow(): Promise<void> {
    const win = this.#extensionManager.getActiveWindow();
    const tab = win.getTab(win.getCurrentTabIndex());
    this.#windowManager.moveTabIntoFloatingWindow(tab);
    tab.focus();
  }

  commandMaximizeWindow(): void {
    const win = this.#extensionManager.getActiveWindow();
    win.maximize();
  }

  commandMinimizeWindow(): void {
    const win = this.#extensionManager.getActiveWindow();
    win.minimize();
  }

  commandRestoreWindow(): void {
    const win = this.#extensionManager.getActiveWindow();
    win.restore();
  }

  commandShowWindow(): void {
    const win = this.#extensionManager.getActiveWindow();
    if (win.isMinimized()) {
      win.restore();
    }
    win.raise();
  }

  commandShowAllWindows(): void {
    for (const win of this.#windowManager.getAllWindows()) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.raise();
    }
  }

  commandMaximizeAllWindows(): void {
    for (const win of this.#windowManager.getAllWindows()) {
      win.maximize();
    }
  }

  commandMinimizeAllWindows(): void {
    for (const win of this.#windowManager.getAllWindows()) {
      win.minimize();
    }
  }

  commandRestoreAllWindows(): void {
    for (const win of this.#windowManager.getAllWindows()) {
      win.restore();
    }
  }

  commandToggleAllWindows(): void {
    if (this.#windowManager.getAllWindows().some((win) => win.isMinimized())) {
      this.commandRestoreAllWindows();
    } else {
      this.commandMinimizeAllWindows();
    }
  }

  commandCopyToClipboard(): void {
    const terminal = this.#extensionManager.getActiveTerminal();
    if (terminal == null) {
      return;
    }
    terminal.commandCopyToClipboard();
  }

  commandOpenLastFrame(): void {
    const win = this.#extensionManager.getActiveWindow();
    const terminal = this.#extensionManager.getActiveTerminal();
    if (win == null || terminal == null) {
      return;
    }

    const frame = terminal.findLastDecoratedFrame();
    if (frame == null) {
      return;
    }
    this.#handlePopOutClicked(win, terminal, frame);
  }

  #handlePopOutClicked(window: Window, terminal: Terminal, frame: DecoratedFrame): void {
    terminal.destroyFrame(frame);

    const newTerminal = new Terminal(this.#configDatabase, this.#uiStyle, this.#extensionManager,
      this.#keybindingsManager, this.#fontAtlasCache, this.#nextTag.bind(this), this.#frameFinder.bind(this),
      this.#bulkFileStorage);
    newTerminal.onSelectionChanged(() => {
      this.#handleTerminalSelectionChanged(newTerminal);
    });
    newTerminal.setSessionConfiguration(terminal.getSessionConfiguration());

    const block = frame.getBlock();
    if (block instanceof TerminalBlock) {
      const environment = newTerminal.environment;
      environment.set(TerminalEnvironment.EXTRATERM_EXIT_CODE, "" + block.getReturnCode());
      const commandLine = block.getCommandLine();
      environment.set(TerminalEnvironment.EXTRATERM_LAST_COMMAND_LINE, commandLine);
      const command = commandLine.trim().split(" ")[0];
      environment.set(TerminalEnvironment.EXTRATERM_LAST_COMMAND, command);
      block.deleteScrollbackLayers();
    }

    frame.setShowControls(false);
    newTerminal.appendBlockFrame(frame);

    window.addTab(newTerminal);
    window.focusTab(newTerminal);
    this.#extensionManager.newTerminalCreated(window, newTerminal);
  }
}

const main =  new Main();
main.init();
(global as any).main = main;
