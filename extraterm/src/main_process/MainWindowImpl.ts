/*
 * Copyright 2021 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as path from "path";
import { Event } from "@extraterm/extraterm-extension-api";
import { later } from "extraterm-later";
import { Logger, getLogger, log } from "extraterm-logging";
import { BrowserWindow, screen } from "electron";

import { ConfigDatabase, GeneralConfig, GENERAL_CONFIG, SingleWindowConfiguration } from "../Config";
import * as ResourceLoader from "../ResourceLoader";
import { MainWindow, OpenWindowOptions } from "./MainWindow";
import { ThemeManager } from "../theme/ThemeManager";
import { bestOverlap } from "./RectangleMatch";
import { EventEmitter } from "../utils/EventEmitter";

const PNG_ICON_PATH = "../../resources/logo/extraterm_small_logo_256x256.png";
const ICO_ICON_PATH = "../../resources/logo/extraterm_small_logo.ico";

const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";
const isDarwin = process.platform === "darwin";


let SetWindowCompositionAttribute: any = null;
let AccentState: any = null;

if (isWindows) {
  SetWindowCompositionAttribute = require("windows-swca").SetWindowCompositionAttribute;
  AccentState = require("windows-swca").ACCENT_STATE;
}

/**
 * Main process side representation of an Extraterm window.
 */
export class MainWindowImpl implements MainWindow {
  private _log: Logger = null;

  #id = -1;
  #configDatabase: ConfigDatabase = null;
  #themeManager: ThemeManager = null;
  #configIndex = -1;

  #onWindowClosedEventEmitter = new EventEmitter<number>();
  onWindowClosed: Event<number>;

  #onWindowDimensionChangedEventEmitter = new EventEmitter<void>();
  onWindowDimensionChanged: Event<void>;

  #onDevToolsOpenedEventEmitter = new EventEmitter<BrowserWindow>();
  onDevToolsOpened: Event<BrowserWindow>;

  #onDevToolsClosedEventEmitter = new EventEmitter<BrowserWindow>();
  onDevToolsClosed: Event<BrowserWindow>;

  #isReady = false;
  #readyPromise: Promise<void> = null;
  #readyResolve: () => void = null;

  constructor(configDatabase: ConfigDatabase, themeManager: ThemeManager, configIndex: number) {
    this._log = getLogger("MainWindowImpl", this);

    this.#configDatabase = configDatabase;
    this.#themeManager = themeManager;
    this.#configIndex = configIndex;

    this.onWindowClosed = this.#onWindowClosedEventEmitter.event;
    this.onDevToolsOpened = this.#onDevToolsOpenedEventEmitter.event;
    this.onDevToolsClosed = this.#onDevToolsClosedEventEmitter.event;
    this.onWindowDimensionChanged = this.#onWindowDimensionChangedEventEmitter.event;

    this.#readyPromise = new Promise((resolve, reject) => {
      this.#readyResolve = resolve;
    });
  }

  get id(): number {
    return this.#id;
  }

  get browserId(): number {
    return this.#id;
  }

  get configIndex(): number {
    return this.#configIndex;
  }

  open(options: OpenWindowOptions=null): void {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    const themeInfo = this.#themeManager.getTheme(generalConfig.themeGUI);

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
    const dimensions = this._getWindowDimensionsFromConfig();
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

    newWindow.on("closed", () => {
      this.#onWindowClosedEventEmitter.fire(mainWindowWebContentsId);
    });

    const emitDimensionChanged = () => {
      this.#onWindowDimensionChangedEventEmitter.fire();
    };

    newWindow.on("close", emitDimensionChanged);
    newWindow.on("resize", emitDimensionChanged);
    newWindow.on("maximize", emitDimensionChanged);
    newWindow.on("unmaximize", emitDimensionChanged);

    this._setupTransparentBackground(newWindow);
    this._checkWindowBoundsLater(newWindow, dimensions);

    let params = "?loadingBackgroundColor=" + themeInfo.loadingBackgroundColor.replace("#", "") +
      "&loadingForegroundColor=" + themeInfo.loadingForegroundColor.replace("#", "");
    if (options.bareWindow) {
      params += "&bareWindow=true";
    }

    // and load the index.html of the app.
    newWindow.loadURL(ResourceLoader.toUrl("render_process/main.html") + params);

    newWindow.webContents.on("devtools-closed", () => {
      this.#onDevToolsClosedEventEmitter.fire(newWindow);
    });
    newWindow.webContents.on("devtools-opened", () => {
      this.#onDevToolsOpenedEventEmitter.fire(newWindow);
    });

    this.#id = newWindow.id;
  }

  async handleWindowReady(): Promise<void> {
    await later();

    this.#isReady = true;
    this._log.debug(`#readyResolve`);
    this.#readyResolve();
    this.#readyResolve = null;
  }

  /**
   * Async wait until the window is fully open and finished initialization.
   */
  async ready(): Promise<void> {
    if (this.#isReady) {
      return;
    }
    await this.#readyPromise;
  }

  private _getBrowserWindow(): BrowserWindow {
    return BrowserWindow.fromId(this.#id);
  }

  private _checkWindowBoundsLater(window: BrowserWindow, desiredConfig: SingleWindowConfiguration): void {
    window.once("ready-to-show", () => {
      const windowBounds = window.getNormalBounds();

      // Figure out which Screen this window is meant to be on.
      const windowDisplay = this._matchWindowToDisplay(window);
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

  private _matchWindowToDisplay(window: BrowserWindow): Electron.Display {
    const displays = screen.getAllDisplays();
    const displayAreas = displays.map(d => d.workArea);

    const matchIndex = bestOverlap(window.getNormalBounds(), displayAreas);
    if (matchIndex === -1) {
      return screen.getPrimaryDisplay();
    }
    return displays[matchIndex];
  }

  private _getWindowDimensionsFromConfig(): SingleWindowConfiguration {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    if (generalConfig.windowConfiguration == null) {
      return null;
    }
    const singleWindowConfig = generalConfig.windowConfiguration[this.#configIndex];
    if (singleWindowConfig == null) {
      return null;
    }
    return singleWindowConfig;
  }

  private _setupTransparentBackground(window: BrowserWindow): void {
    const setWindowComposition = () => {
      const generalConfig = <GeneralConfig> this.#configDatabase.getConfig("general");
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

    this.#configDatabase.onChange(event => {
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

  async restore(): Promise<void> {
    const generalConfig = <GeneralConfig> this.#configDatabase.getConfig(GENERAL_CONFIG);
    const window = this._getBrowserWindow();

    const bounds = generalConfig.windowConfiguration[this.#configIndex];
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

      await later(100);
      window.setMinimumSize(10, 10);

    } else {

      // Windows and macOS
      if (generalConfig.showTrayIcon && generalConfig.minimizeToTray) {
        if (bounds != null) {
          if (bounds.isMaximized === true) {
            window.maximize();
          }
          this._checkWindowBoundsLater(window, bounds);
        }

        window.show();
      }
      window.restore();

      await later();
      window.moveTop();
      window.focus();
    }
  }

  getNormalBounds() {
    return this._getBrowserWindow().getNormalBounds();
  }

  isMinimized(): boolean {
    return this._getBrowserWindow().isMinimized();
  }

  isVisible(): boolean {
    return this._getBrowserWindow().isVisible();
  }

  isMaximized(): boolean {
    return this._getBrowserWindow().isMaximized();
  }

  hide(): void {
    this._getBrowserWindow().hide();
  }

  maximize(): void {
    this._getBrowserWindow().maximize();
  }

  minimize(): void {
    this._getBrowserWindow().minimize();
  }

  moveTop(): void {
    this._getBrowserWindow().moveTop();
  }

  show(): void {
    this._getBrowserWindow().show();
  }
}
